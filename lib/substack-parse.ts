// Pure parsing for the Substack RSS feed. The route handles fetching, caching
// and HTTP; this module turns feed XML into the trimmed post list the blog
// page renders.

import { XMLParser } from 'fast-xml-parser';

export type SubstackPost = {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  author: string;
};

export type SubstackFeed = {
  feedTitle: string;
  feedDescription: string;
  posts: SubstackPost[];
};

export const MAX_FEED_POSTS = 5;
export const SNIPPET_CHARS = 200;

// Substack puts post bodies in CDATA, so the XML parser leaves HTML entities
// (numeric, hex, and named) undecoded. Decode them in a single pass.
// fromCodePoint (not fromCharCode) is required so astral code points like
// emoji — anything above U+FFFF — decode correctly instead of garbling.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(input: string): string {
  return input.replace(
    /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, code: string) => {
      if (code[0] === '#') {
        const isHex = code[1] === 'x' || code[1] === 'X';
        const cp = isHex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return match;
        try {
          return String.fromCodePoint(cp);
        } catch {
          return match;
        }
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    },
  );
}

// fast-xml-parser yields a string for plain elements and { '#text', '@_attr' }
// for elements with attributes; normalise both to raw text.
function getRawText(field: unknown): string {
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null) {
    const text = (field as Record<string, unknown>)['#text'];
    if (typeof text === 'string') return text;
    if (typeof text === 'number') return String(text);
  }
  return '';
}

function getTextContent(field: unknown): string {
  const content = getRawText(field);
  return content ? decodeEntities(content) : '';
}

export function parseSubstackFeed(xml: string): SubstackFeed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true,
    parseAttributeValue: true,
    processEntities: true,
    htmlEntities: true,
  });

  const parsed: unknown = parser.parse(xml);
  const channel = (parsed as { rss?: { channel?: Record<string, unknown> } })?.rss?.channel;
  if (!channel || typeof channel !== 'object') {
    throw new Error('Invalid RSS feed structure');
  }

  const feedTitle = getTextContent(channel.title) || 'Chris Lee Bergstrom';
  const feedDescription =
    getTextContent(channel.description) || 'Entertainment industry and AI insights';

  const rawItems = channel.item;
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const posts = items.slice(0, MAX_FEED_POSTS).map((entry): SubstackPost => {
    const item = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
      string,
      unknown
    >;
    // Strip tags before decoding, so an escaped &lt; in the post text isn't
    // turned into a "<" that the tag stripper then swallows.
    const fullContent = getRawText(item['content:encoded']) || getRawText(item.description);
    const textContent = decodeEntities(fullContent.replace(/<[^>]*>/g, '')).trim();
    const contentSnippet =
      textContent.length > SNIPPET_CHARS
        ? `${textContent.substring(0, SNIPPET_CHARS)}...`
        : textContent;

    // Only the snippet is consumed by the UI; the full raw post HTML is
    // intentionally not returned (payload size + avoids shipping raw HTML).
    return {
      title: getTextContent(item.title),
      link: getTextContent(item.link),
      pubDate: getTextContent(item.pubDate),
      contentSnippet,
      author: getTextContent(item['dc:creator']) || 'Chris Lee Bergstrom',
    };
  });

  return { feedTitle, feedDescription, posts };
}
