import { NextResponse } from 'next/server';
import { readTextWithLimit } from '../../../lib/eve-validation';
import { parseSubstackFeed, type SubstackFeed } from '../../../lib/substack-parse';

const SUBSTACK_FEED_URL = 'https://chrisleebergstrom.substack.com/feed';
const CACHE_DURATION = 5 * 60 * 1000;
// Substack normally answers in well under a second; anything past this is an
// outage we'd rather serve stale through than hang the blog page on.
const FETCH_TIMEOUT_MS = 8000;
// The feed carries full post bodies and runs a few hundred KB; 2 MB is ample
// headroom while still bounding what we buffer from upstream.
const MAX_FEED_BYTES = 2 * 1024 * 1024;

const cacheHeaders = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
// Stale content is still fine to share, but keep the CDN retrying soon.
const staleHeaders = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' };
// Failures must never be cached at the edge, or one bad fetch blanks the blog
// for every visitor until the TTL expires.
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

// Per-instance cache of the last good parse. Kept even after it goes stale so
// a Substack hiccup degrades to "slightly old posts" instead of an empty page.
let cached: (SubstackFeed & { timestamp: number }) | null = null;
// Concurrent cache misses share one upstream fetch instead of each firing
// their own (a cold instance under a burst of blog traffic would otherwise
// hit Substack once per visitor).
let inFlight: Promise<SubstackFeed> | null = null;

async function fetchFeed(): Promise<SubstackFeed> {
  const response = await fetch(SUBSTACK_FEED_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
  });
  if (!response.ok) {
    throw new Error(`Substack responded ${response.status}`);
  }
  // Content-Length is advisory; readTextWithLimit enforces the cap on the wire.
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_FEED_BYTES) {
    throw new Error('Substack feed exceeds size cap');
  }
  const xml = await readTextWithLimit(response.body, MAX_FEED_BYTES);
  return parseSubstackFeed(xml);
}

function refreshFeed(): Promise<SubstackFeed> {
  if (!inFlight) {
    inFlight = fetchFeed().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export async function GET() {
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    const { timestamp: _timestamp, ...feed } = cached;
    return NextResponse.json(
      { success: true, ...feed, cached: true },
      { status: 200, headers: cacheHeaders },
    );
  }

  try {
    const feed = await refreshFeed();
    cached = { ...feed, timestamp: Date.now() };
    return NextResponse.json({ success: true, ...feed }, { status: 200, headers: cacheHeaders });
  } catch (error: unknown) {
    console.error('Error fetching Substack feed:', error);

    if (cached) {
      const { timestamp: _timestamp, ...feed } = cached;
      return NextResponse.json(
        { success: true, ...feed, cached: true, stale: true },
        { status: 200, headers: staleHeaders },
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch Substack feed', posts: [] },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
