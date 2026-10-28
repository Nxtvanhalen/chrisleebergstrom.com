import { describe, expect, test } from 'bun:test';
import {
  type BriefEvent,
  type BriefLoader,
  type BriefLoadResult,
  BriefSourceError,
  createBriefCache,
  createGitHubBriefLoader,
  GITHUB_API_VERSION,
  isValidRepoName,
  MAX_BRIEF_BYTES,
} from '../../lib/eve-brief';

const FALLBACK = '# fallback';
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// A manual clock plus a loader whose answers are queued up front.
function harness(answers: Array<BriefLoadResult | Error | 'hang'>, overrides = {}) {
  let t = 1_000_000;
  const events: BriefEvent[] = [];
  const calls: Array<{ etag: string | null }> = [];
  const load: BriefLoader = ({ etag, signal }) => {
    calls.push({ etag });
    const answer = answers.shift();
    if (answer === undefined) throw new Error('loader called more often than expected');
    if (answer === 'hang') {
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    }
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(answer);
  };
  const cache = createBriefCache({
    load,
    fallback: FALLBACK,
    ttlMs: 10_000,
    retryMs: 5_000,
    loadTimeoutMs: 1_000,
    now: () => t,
    onEvent: (event) => events.push(event),
    ...overrides,
  });
  return { cache, events, calls, advance: (ms: number) => (t += ms) };
}

const loaded = (text: string, etag: string | null = null): BriefLoadResult => ({
  kind: 'loaded',
  text,
  etag,
});

describe('createBriefCache', () => {
  test('with no loader it serves the fallback and reports once', async () => {
    const events: BriefEvent[] = [];
    const cache = createBriefCache({
      load: null,
      fallback: FALLBACK,
      ttlMs: 1,
      retryMs: 1,
      loadTimeoutMs: 1,
      onEvent: (e) => events.push(e),
    });
    expect(await cache.get()).toEqual({ text: FALLBACK, origin: 'fallback', ageMs: 0 });
    expect(await cache.get()).toEqual({ text: FALLBACK, origin: 'fallback', ageMs: 0 });
    expect(events).toEqual([{ type: 'disabled' }]);
  });

  test('cold start waits for the first load and then serves it', async () => {
    const h = harness([loaded('# v1', '"e1"')]);
    expect(await h.cache.get()).toEqual({ text: '# v1', origin: 'remote', ageMs: 0 });
    expect(h.calls).toEqual([{ etag: null }]);
    expect(h.events).toEqual([{ type: 'loaded', chars: 4, etag: '"e1"', ms: 0 }]);
  });

  test('a fresh copy is served without reloading', async () => {
    const h = harness([loaded('# v1')]);
    await h.cache.get();
    h.advance(9_999);
    expect(await h.cache.get()).toEqual({ text: '# v1', origin: 'remote', ageMs: 9_999 });
    expect(h.calls).toHaveLength(1);
  });

  test('a stale copy is served at once and refreshed in the background', async () => {
    const h = harness([loaded('# v1'), loaded('# v2', '"e2"')]);
    await h.cache.get();
    h.advance(10_000);
    expect(await h.cache.get()).toEqual({ text: '# v1', origin: 'remote', ageMs: 10_000 });
    await tick();
    expect(h.calls).toHaveLength(2);
    expect(await h.cache.get()).toMatchObject({ text: '# v2', origin: 'remote' });
    expect(h.events.map((e) => e.type)).toEqual(['loaded', 'refreshing', 'loaded']);
  });

  test('not-modified keeps the text and resets its age', async () => {
    const h = harness([loaded('# v1', '"e1"'), { kind: 'not-modified' }]);
    await h.cache.get();
    h.advance(10_000);
    await h.cache.get();
    await tick();
    expect(h.calls[1]).toEqual({ etag: '"e1"' });
    expect(await h.cache.get()).toEqual({ text: '# v1', origin: 'remote', ageMs: 0 });
  });

  test('a failed refresh keeps the last good copy and backs off', async () => {
    const h = harness([loaded('# v1'), new Error('boom'), loaded('# v3')]);
    await h.cache.get();
    h.advance(10_000);
    await h.cache.get();
    await tick();
    expect(h.events.at(-1)).toMatchObject({ type: 'failed', hadCached: true, failures: 1 });
    // Still stale, but inside the retry window: no new load.
    h.advance(1_000);
    expect(await h.cache.get()).toMatchObject({ text: '# v1', origin: 'remote' });
    await tick();
    expect(h.calls).toHaveLength(2);
    // Past the retry window: the next request triggers the retry.
    h.advance(4_000);
    await h.cache.get();
    await tick();
    expect(h.calls).toHaveLength(3);
    expect(await h.cache.get()).toMatchObject({ text: '# v3' });
  });

  test('a cold failure serves the fallback and waits before retrying', async () => {
    const h = harness([new Error('offline'), loaded('# later')]);
    expect(await h.cache.get()).toEqual({ text: FALLBACK, origin: 'fallback', ageMs: 0 });
    expect(h.events.map((e) => e.type)).toEqual(['failed', 'served-fallback']);
    h.advance(4_999);
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    expect(h.calls).toHaveLength(1);
    expect(h.events.at(-1)).toEqual({ type: 'served-fallback', reason: 'backing-off' });
    h.advance(1);
    expect(await h.cache.get()).toMatchObject({ text: '# later', origin: 'remote' });
  });

  test('a loader that never answers is cut off at the timeout', async () => {
    const h = harness(['hang'], { loadTimeoutMs: 20 });
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    const failure = h.events.find((e) => e.type === 'failed');
    expect(String((failure as { error: unknown }).error)).toContain('exceeded 20ms');
  });

  test('a loader that ignores abort is still cut off, and its late answer is dropped', async () => {
    let settleLate!: (result: BriefLoadResult) => void;
    let attempts = 0;
    const h = harness([], {
      loadTimeoutMs: 20,
      load: () => {
        attempts++;
        if (attempts === 1) {
          // Ignores the signal entirely; we settle it by hand later.
          return new Promise<BriefLoadResult>((resolve) => {
            settleLate = resolve;
          });
        }
        return Promise.resolve(loaded('# second attempt'));
      },
    });
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    expect(h.events.find((e) => e.type === 'failed')).toMatchObject({ failures: 1 });

    // The first attempt answers after the deadline: ignored.
    settleLate(loaded('# late'));
    await tick();
    h.advance(1_000);
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    expect(attempts).toBe(1);

    // Past the retry window a fresh attempt runs and wins.
    h.advance(4_000);
    expect(await h.cache.get()).toMatchObject({ text: '# second attempt', origin: 'remote' });
    expect(attempts).toBe(2);
  });

  test('a late rejection after the deadline is swallowed, not unhandled', async () => {
    let rejectLate!: (error: Error) => void;
    const h = harness([], {
      loadTimeoutMs: 20,
      load: () =>
        new Promise<BriefLoadResult>((_, reject) => {
          rejectLate = reject;
        }),
    });
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    rejectLate(new Error('late boom'));
    await tick();
    // Still exactly one failure recorded: the timeout, not the late rejection.
    expect(h.events.filter((e) => e.type === 'failed')).toHaveLength(1);
  });

  test('concurrent cold callers share one load', async () => {
    const h = harness([loaded('# once')]);
    const results = await Promise.all([h.cache.get(), h.cache.get(), h.cache.get()]);
    expect(results.map((r) => r.text)).toEqual(['# once', '# once', '# once']);
    expect(h.calls).toHaveLength(1);
  });

  test('a loader that throws synchronously does not jam the cache', async () => {
    let attempts = 0;
    const h = harness([], {
      load: () => {
        attempts++;
        if (attempts === 1) throw new Error('sync boom');
        return Promise.resolve(loaded('# recovered'));
      },
    });
    expect(await h.cache.get()).toMatchObject({ origin: 'fallback' });
    h.advance(5_000);
    expect(await h.cache.get()).toMatchObject({ text: '# recovered' });
  });
});

describe('createGitHubBriefLoader', () => {
  const source = {
    repo: 'Nxtvanhalen/eve-brief',
    path: 'docs/brief.md',
    ref: 'main',
    token: 'tok',
  };

  type Call = { url: string; init: RequestInit | undefined };
  function fakeFetch(respond: (call: Call) => Response): { fetch: typeof fetch; calls: Call[] } {
    const calls: Call[] = [];
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const call = { url: String(input), init };
      calls.push(call);
      return respond(call);
    }) as typeof fetch;
    return { fetch: f, calls };
  }

  test('asks the Contents API for the raw file with the right headers', async () => {
    const { fetch, calls } = fakeFetch(
      () => new Response('# brief', { status: 200, headers: { etag: '"abc"' } }),
    );
    const load = createGitHubBriefLoader(source, fetch, 'test-agent');
    const result = await load({ etag: null, signal: new AbortController().signal });
    expect(result).toEqual({ kind: 'loaded', text: '# brief', etag: '"abc"' });
    expect(calls[0].url).toBe(
      'https://api.github.com/repos/Nxtvanhalen/eve-brief/contents/docs/brief.md?ref=main',
    );
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('accept')).toBe('application/vnd.github.raw+json');
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('x-github-api-version')).toBe(GITHUB_API_VERSION);
    expect(headers.get('user-agent')).toBe('test-agent');
    expect(headers.get('if-none-match')).toBeNull();
    expect(calls[0].init?.cache).toBe('no-store');
  });

  test('sends If-None-Match and maps 304 to not-modified', async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 304 }));
    const load = createGitHubBriefLoader(source, fetch);
    const result = await load({ etag: '"abc"', signal: new AbortController().signal });
    expect(result).toEqual({ kind: 'not-modified' });
    expect(new Headers(calls[0].init?.headers).get('if-none-match')).toBe('"abc"');
  });

  test('a non-2xx answer is a BriefSourceError carrying the status, not the token', async () => {
    const { fetch } = fakeFetch(
      () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }),
    );
    const load = createGitHubBriefLoader(source, fetch);
    const promise = load({ etag: null, signal: new AbortController().signal });
    await expect(promise).rejects.toBeInstanceOf(BriefSourceError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
    await expect(promise).rejects.toThrow(/401.*Bad credentials/);
    await expect(promise).rejects.not.toThrow(/tok/);
  });

  test('an empty file is an error, not an empty brief', async () => {
    const { fetch } = fakeFetch(() => new Response('  \n', { status: 200 }));
    const load = createGitHubBriefLoader(source, fetch);
    await expect(load({ etag: null, signal: new AbortController().signal })).rejects.toThrow(
      /empty file/,
    );
  });

  test('an absurdly large file is refused while reading', async () => {
    const { fetch } = fakeFetch(
      () => new Response('x'.repeat(MAX_BRIEF_BYTES + 1), { status: 200 }),
    );
    const load = createGitHubBriefLoader(source, fetch);
    await expect(load({ etag: null, signal: new AbortController().signal })).rejects.toThrow(
      /exceeds/,
    );
  });

  test('passes the abort signal through to fetch', async () => {
    const { fetch, calls } = fakeFetch(() => new Response('# b', { status: 200 }));
    const controller = new AbortController();
    await createGitHubBriefLoader(source, fetch)({ etag: null, signal: controller.signal });
    expect(calls[0].init?.signal).toBe(controller.signal);
  });

  test('rejects a malformed repo or path up front', () => {
    expect(isValidRepoName('owner/name')).toBe(true);
    expect(isValidRepoName('owner')).toBe(false);
    expect(isValidRepoName('owner/name/extra')).toBe(false);
    expect(() => createGitHubBriefLoader({ ...source, repo: 'nope' })).toThrow(/owner\/name/);
    expect(() => createGitHubBriefLoader({ ...source, path: '../secrets' })).toThrow(/relative/);
    expect(() => createGitHubBriefLoader({ ...source, path: '/abs' })).toThrow(/relative/);
  });
});
