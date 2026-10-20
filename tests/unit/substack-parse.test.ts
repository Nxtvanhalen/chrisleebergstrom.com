import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  decodeEntities,
  MAX_FEED_POSTS,
  parseSubstackFeed,
  SNIPPET_CHARS,
} from '../../lib/substack-parse';

const FIXTURE_PATH = new URL('../fixtures/substack-feed.xml', import.meta.url);

describe('decodeEntities', () => {
  test('decodes the named entities Substack emits', () => {
    expect(decodeEntities('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;&nbsp;g')).toBe(
      'a & b < c > d "e" \'f\' g',
    );
    // Case-insensitive on the name.
    expect(decodeEntities('&AMP;')).toBe('&');
  });

  test('decodes decimal and hex numeric entities', () => {
    expect(decodeEntities('&#8212;')).toBe('—');
    expect(decodeEntities('&#x2014;')).toBe('—');
    expect(decodeEntities('&#X2014;')).toBe('—');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
  });

  test('decodes astral code points (emoji) with fromCodePoint, not fromCharCode', () => {
    expect(decodeEntities('&#x1F3B8;')).toBe('🎸');
    expect(decodeEntities('&#127928;')).toBe('🎸');
    expect(decodeEntities('&#x1F600;')).toBe('😀');
  });

  test('leaves unknown names, out-of-range code points, and bare ampersands alone', () => {
    expect(decodeEntities('&unknown;')).toBe('&unknown;');
    expect(decodeEntities('&#x110000;')).toBe('&#x110000;');
    expect(decodeEntities('&#99999999;')).toBe('&#99999999;');
    expect(decodeEntities('fish & chips')).toBe('fish & chips');
    expect(decodeEntities('&;')).toBe('&;');
    expect(decodeEntities('')).toBe('');
  });
});

describe('parseSubstackFeed', () => {
  test('parses the fixture feed into trimmed posts', async () => {
    const xml = await readFile(FIXTURE_PATH, 'utf8');
    const feed = parseSubstackFeed(xml);

    expect(feed.feedTitle).toBe('Chris Lee Bergstrom & Co');
    expect(feed.feedDescription).toBe('Notes on AI, live entertainment & systems thinking');
    expect(feed.posts).toHaveLength(MAX_FEED_POSTS);
    expect(feed.posts.map((p) => p.title)).toEqual([
      'The Archivist — Part One',
      'Context is the bottleneck',
      'Three',
      'Four',
      'Five',
    ]);

    const [first, second] = feed.posts;
    expect(first.link).toBe('https://chrisleebergstrom.substack.com/p/the-archivist');
    expect(first.pubDate).toBe('Tue, 01 Oct 2026 12:00:00 GMT');
    expect(first.author).toBe('Chris Lee Bergstrom');
    // content:encoded wins over description, tags are stripped, entities decoded
    // (including the astral guitar), and the snippet is capped with an ellipsis.
    expect(first.contentSnippet.startsWith('The lights went down at eleven.')).toBe(true);
    expect(first.contentSnippet).toContain('🎸');
    expect(first.contentSnippet).toContain('—');
    expect(first.contentSnippet).not.toMatch(/<[^>]+>/);
    expect(first.contentSnippet.endsWith('...')).toBe(true);
    expect(first.contentSnippet).toHaveLength(SNIPPET_CHARS + 3);

    // Falls back to description and the default author when the item has no creator.
    expect(second.contentSnippet).toBe('Short post with only a description.');
    expect(second.author).toBe('Chris Lee Bergstrom');
  });

  // Regression: decoding before stripping tags turned "&lt;" into a "<" that
  // the stripper swallowed together with everything up to the next ">".
  test('escaped angle brackets in body text survive snippet extraction', () => {
    const xml = `<rss version="2.0"><channel><title>T</title>
      <item><title>Lt</title><link>https://x.test/lt</link><pubDate>now</pubDate>
      <description><![CDATA[<p>a &lt; b</p><p>and more</p>]]></description></item>
      </channel></rss>`;
    expect(parseSubstackFeed(xml).posts[0].contentSnippet).toBe('a < band more');
  });

  test('handles a feed with a single item (not wrapped in an array by the XML parser)', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Solo</title>
      <item><title>Only</title><link>https://x.test/only</link><pubDate>now</pubDate>
      <description>body</description></item></channel></rss>`;
    const feed = parseSubstackFeed(xml);
    expect(feed.feedTitle).toBe('Solo');
    expect(feed.posts).toEqual([
      {
        title: 'Only',
        link: 'https://x.test/only',
        pubDate: 'now',
        contentSnippet: 'body',
        author: 'Chris Lee Bergstrom',
      },
    ]);
  });

  test('a channel with no items yields defaults and no posts', () => {
    const feed = parseSubstackFeed(
      '<rss version="2.0"><channel><link>https://x.test</link></channel></rss>',
    );
    expect(feed.feedTitle).toBe('Chris Lee Bergstrom');
    expect(feed.feedDescription).toBe('Entertainment industry and AI insights');
    expect(feed.posts).toEqual([]);
  });

  test('throws on something that is not an RSS feed', () => {
    expect(() => parseSubstackFeed('<html><body>Not a feed</body></html>')).toThrow(
      'Invalid RSS feed structure',
    );
    expect(() => parseSubstackFeed('')).toThrow('Invalid RSS feed structure');
  });
});
