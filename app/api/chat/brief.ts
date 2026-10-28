// Wires lib/eve-brief to the real world: process.env for the source, the
// bundled Markdown as the fallback, console + Sentry for events. One cache per
// server instance, created on first use so tests can set env before importing.
//
// Chris edits brief.md in the private eve-brief repo; EVE picks the change up
// within BRIEF_TTL_MS, no deploy. If GitHub is unreachable, the token has
// expired or the repo moved, the last good copy keeps being served (or, before
// any load succeeded, the copy committed in content/eve/brief.md), and Sentry
// gets a warning so it isn't silent.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as Sentry from '@sentry/nextjs';
import {
  type Brief,
  type BriefCache,
  type BriefEvent,
  type BriefLoader,
  createBriefCache,
  createGitHubBriefLoader,
} from '@/lib/eve-brief';
import { sanitizeBrief } from '@/lib/eve-prompt';

// How long a fetched brief is served before GitHub is asked for a newer one.
export const BRIEF_TTL_MS = 10 * 60_000;
// Pause after a failed load before trying again (per instance).
export const BRIEF_RETRY_MS = 60_000;
// Only a cold start waits on this; a warm instance refreshes in the background.
export const BRIEF_LOAD_TIMEOUT_MS = 4_000;

export const BUNDLED_BRIEF_PATH = path.join(process.cwd(), 'content', 'eve', 'brief.md');

const DEFAULT_REPO = 'Nxtvanhalen/eve-brief';
const DEFAULT_PATH = 'brief.md';
const DEFAULT_REF = 'main';

// Last resort if even the bundled file can't be read: EVE still works, she
// just has nothing current to say.
const MINIMAL_BRIEF = `# EVE Brief

Last updated: unknown

The current brief could not be loaded. Speak only to what is on the site itself and point visitors to Chris's email for anything else.`;

function readBundledBrief(): string {
  try {
    return sanitizeBrief(readFileSync(BUNDLED_BRIEF_PATH, 'utf8'));
  } catch (error) {
    console.error(`EVE brief: bundled copy unreadable at ${BUNDLED_BRIEF_PATH}`, error);
    Sentry.captureException(error);
    return MINIMAL_BRIEF;
  }
}

function handleEvent(event: BriefEvent): void {
  switch (event.type) {
    case 'disabled':
      console.warn('EVE brief: EVE_BRIEF_TOKEN is not set; serving the bundled brief only');
      break;
    case 'loaded':
      console.info(
        `EVE brief: loaded ${event.chars} chars from GitHub in ${event.ms}ms (etag ${event.etag ?? 'none'})`,
      );
      break;
    case 'not-modified':
      console.info(`EVE brief: unchanged on GitHub (${event.ms}ms)`);
      break;
    case 'refreshing':
      console.info(
        `EVE brief: ${Math.round(event.ageMs / 1000)}s old, refreshing in the background`,
      );
      break;
    case 'served-fallback':
      console.warn(`EVE brief: serving the bundled copy (${event.reason})`);
      break;
    case 'failed': {
      const serving = event.hadCached ? 'serving the last good copy' : 'serving the bundled copy';
      const message = `EVE brief: load failed (${event.failures} in a row, ${serving}): ${String(event.error)}`;
      console.error(message);
      // One warning per outage, then one every ten retries, so a dead token is
      // visible in Sentry without a flood.
      if (event.failures === 1 || event.failures % 10 === 0) {
        Sentry.captureMessage(message, 'warning');
      }
      break;
    }
  }
}

function buildLoader(token: string): BriefLoader | null {
  const source = {
    repo: process.env.EVE_BRIEF_REPO?.trim() || DEFAULT_REPO,
    path: process.env.EVE_BRIEF_PATH?.trim() || DEFAULT_PATH,
    ref: process.env.EVE_BRIEF_REF?.trim() || DEFAULT_REF,
    token,
  };
  try {
    const load = createGitHubBriefLoader(source);
    console.info(`EVE brief: source is ${source.repo}/${source.path}@${source.ref}`);
    return async (options) => {
      const result = await load(options);
      return result.kind === 'loaded' ? { ...result, text: sanitizeBrief(result.text) } : result;
    };
  } catch (error) {
    console.error('EVE brief: bad source configuration; serving the bundled brief only', error);
    Sentry.captureException(error);
    return null;
  }
}

let cache: BriefCache | null = null;

function buildCache(): BriefCache {
  const token = process.env.EVE_BRIEF_TOKEN?.trim();
  return createBriefCache({
    load: token ? buildLoader(token) : null,
    fallback: readBundledBrief(),
    ttlMs: BRIEF_TTL_MS,
    retryMs: BRIEF_RETRY_MS,
    loadTimeoutMs: BRIEF_LOAD_TIMEOUT_MS,
    onEvent: handleEvent,
  });
}

/** The brief to put in the next system prompt. Never throws. */
export function getEveBrief(): Promise<Brief> {
  cache ??= buildCache();
  return cache.get();
}

/** Forgets the cache so the next call re-reads the environment. Tests only. */
export function resetEveBriefForTests(): void {
  cache = null;
}
