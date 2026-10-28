// EVE's brief: the "what is Chris building, and when" layer of her prompt, kept
// as Markdown that Chris edits in a private GitHub repo. This module is the
// pure part: a small cache with stale-while-revalidate semantics, and a loader
// for the GitHub Contents API. Both take their collaborators as arguments
// (fetch, clock, event sink) so they are unit-tested without network or env;
// app/api/chat/brief.ts wires them to process.env, the bundled fallback file
// and Sentry.
//
// Behaviour, in one place:
//   - No loader (no token configured): the fallback is served, nothing fetched.
//   - Cold start: one load is awaited, bounded by loadTimeoutMs. On failure the
//     fallback is served and the next attempt waits retryMs.
//   - Warm: the cached text is served immediately. Once it is older than ttlMs
//     a refresh runs in the background; a failed refresh keeps the last good
//     copy (never regresses to the fallback) and retries after retryMs.
//   - Concurrent callers share one in-flight load.
//   - The loader may answer "not modified" (ETag) to make refreshes cheap.

import { readTextWithLimit } from './eve-validation';

export type BriefLoadResult =
  | { kind: 'loaded'; text: string; etag: string | null }
  | { kind: 'not-modified' };

export type BriefLoader = (options: {
  etag: string | null;
  signal: AbortSignal;
}) => Promise<BriefLoadResult>;

export type BriefOrigin = 'remote' | 'fallback';

export type Brief = {
  text: string;
  origin: BriefOrigin;
  /** Milliseconds since the text was last confirmed current (0 for the fallback). */
  ageMs: number;
};

export type BriefEvent =
  | { type: 'disabled' }
  | { type: 'loaded'; chars: number; etag: string | null; ms: number }
  | { type: 'not-modified'; ms: number }
  | { type: 'failed'; error: unknown; ms: number; hadCached: boolean; failures: number }
  | { type: 'refreshing'; ageMs: number }
  | { type: 'served-fallback'; reason: 'disabled' | 'cold-failure' | 'backing-off' };

export type BriefCacheOptions = {
  /** null disables remote loading: the fallback is served and nothing is fetched. */
  load: BriefLoader | null;
  fallback: string;
  /** How long a loaded brief is served without checking for a newer one. */
  ttlMs: number;
  /** How long to wait after a failed load before trying again. */
  retryMs: number;
  /** Upper bound on one load; a slower source counts as failed. */
  loadTimeoutMs: number;
  now?: () => number;
  onEvent?: (event: BriefEvent) => void;
};

export type BriefCache = {
  get(): Promise<Brief>;
};

type Cached = { text: string; etag: string | null; checkedAt: number };

export function createBriefCache(options: BriefCacheOptions): BriefCache {
  const { load, fallback, ttlMs, retryMs, loadTimeoutMs } = options;
  const now = options.now ?? (() => Date.now());
  const emit = options.onEvent ?? (() => {});

  // Read through functions, not the variables, after an await: TypeScript keeps
  // narrowing a captured `let` across awaits, which would hide the update.
  let cached: Cached | null = null;
  let inFlight: Promise<void> | null = null;
  let nextAttemptAt = 0;
  let failures = 0;
  let disabledReported = false;
  const current = (): Cached | null => cached;

  // Starts a load unless one is already running. Never rejects: failures are
  // recorded and reported, and the caller decides what to serve.
  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight;
    if (!load) return Promise.resolve();
    const started = now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The loader gets the abort signal, but the deadline does not depend on it
    // honouring one: the race settles on time either way, and an answer that
    // arrives after it is dropped (its own late rejection is swallowed below).
    const attempt = (async () =>
      load({ etag: current()?.etag ?? null, signal: controller.signal }))();
    attempt.catch(() => {});
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`brief load exceeded ${loadTimeoutMs}ms`);
        controller.abort(error);
        reject(error);
      }, loadTimeoutMs);
    });
    const task = (async () => {
      try {
        const result = await Promise.race([attempt, deadline]);
        const ms = now() - started;
        if (result.kind === 'not-modified') {
          const existing = current();
          if (!existing) {
            throw new Error('brief source answered not-modified with nothing cached');
          }
          cached = { ...existing, checkedAt: now() };
          emit({ type: 'not-modified', ms });
        } else {
          cached = { text: result.text, etag: result.etag, checkedAt: now() };
          emit({ type: 'loaded', chars: result.text.length, etag: result.etag, ms });
        }
        failures = 0;
        nextAttemptAt = 0;
      } catch (error) {
        failures += 1;
        nextAttemptAt = now() + retryMs;
        emit({
          type: 'failed',
          error,
          ms: now() - started,
          hadCached: current() !== null,
          failures,
        });
      } finally {
        clearTimeout(timer);
      }
    })();
    inFlight = task;
    // Cleared asynchronously so a loader that fails synchronously can't leave a
    // settled promise behind as "in flight" forever.
    void task.finally(() => {
      if (inFlight === task) inFlight = null;
    });
    return task;
  };

  const fallbackBrief = (reason: 'disabled' | 'cold-failure' | 'backing-off'): Brief => {
    emit({ type: 'served-fallback', reason });
    return { text: fallback, origin: 'fallback', ageMs: 0 };
  };

  return {
    async get(): Promise<Brief> {
      if (!load) {
        if (!disabledReported) {
          disabledReported = true;
          emit({ type: 'disabled' });
        }
        return { text: fallback, origin: 'fallback', ageMs: 0 };
      }

      const warm = current();
      if (warm) {
        const ageMs = now() - warm.checkedAt;
        if (ageMs >= ttlMs && now() >= nextAttemptAt && !inFlight) {
          emit({ type: 'refreshing', ageMs });
          void refresh();
        }
        return { text: warm.text, origin: 'remote', ageMs };
      }

      // Cold: nothing cached yet. Wait for one load (bounded by loadTimeoutMs)
      // unless a recent failure says not to bother yet.
      if (now() < nextAttemptAt) return fallbackBrief('backing-off');
      await refresh();
      const loaded = current();
      if (!loaded) return fallbackBrief('cold-failure');
      return { text: loaded.text, origin: 'remote', ageMs: now() - loaded.checkedAt };
    },
  };
}

// ---------------------------------------------------------------------------
// GitHub Contents API loader
// ---------------------------------------------------------------------------

export type GitHubBriefSource = {
  /** "owner/name" */
  repo: string;
  /** Path inside the repo, e.g. "brief.md" or "docs/brief.md". */
  path: string;
  /** Branch, tag or commit. */
  ref: string;
  /** Fine-grained token with read-only Contents on that one repo. */
  token: string;
};

export const GITHUB_API_VERSION = '2022-11-28';
// A brief is a few KB; this just stops a wrong path (a binary, a huge file)
// from being buffered in full before sanitizeBrief caps it.
export const MAX_BRIEF_BYTES = 256 * 1024;

export class BriefSourceError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(`GitHub responded ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'BriefSourceError';
  }
}

export function isValidRepoName(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}

/**
 * Loads the brief through the Contents API with the raw media type, so the
 * response body is the file itself. Sends If-None-Match when it has an ETag,
 * and GitHub answers 304 (not counted against the rate limit) when unchanged.
 */
export function createGitHubBriefLoader(
  source: GitHubBriefSource,
  fetchImpl: typeof fetch = fetch,
  userAgent = 'chrisleebergstrom.com (EVE brief)',
): BriefLoader {
  if (!isValidRepoName(source.repo)) {
    throw new Error(`EVE brief repo must look like owner/name, got "${source.repo}"`);
  }
  if (!source.path || source.path.startsWith('/') || source.path.includes('..')) {
    throw new Error(`EVE brief path must be a relative file path, got "${source.path}"`);
  }
  const encodedPath = source.path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${source.repo}/contents/${encodedPath}?ref=${encodeURIComponent(source.ref)}`;

  return async ({ etag, signal }) => {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${source.token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': userAgent,
    };
    if (etag) headers['If-None-Match'] = etag;

    // cache: 'no-store' keeps Next's fetch patching out of it; the brief cache
    // above is the only cache this should have.
    const res = await fetchImpl(url, { headers, signal, cache: 'no-store' });
    if (res.status === 304) {
      await res.body?.cancel().catch(() => {});
      return { kind: 'not-modified' };
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
      throw new BriefSourceError(res.status, detail);
    }
    const text = await readTextWithLimit(res.body, MAX_BRIEF_BYTES);
    if (text.trim().length === 0) {
      throw new Error('brief source returned an empty file');
    }
    return { kind: 'loaded', text, etag: res.headers.get('etag') };
  };
}
