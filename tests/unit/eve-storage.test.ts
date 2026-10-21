import { describe, expect, test } from 'bun:test';
import {
  CHAT_HISTORY_KEY,
  type ChatMessage,
  LEGACY_STORAGE_KEYS,
  MAX_STORED_MESSAGES,
  parseStoredHistory,
  serializeHistory,
  toRequestHistory,
} from '../../lib/eve-storage';
import { MAX_HISTORY_CHARS, MAX_HISTORY_MESSAGES } from '../../lib/eve-validation';

describe('storage keys', () => {
  test('the transcript lives under v3 and every older key is cleaned up', () => {
    expect(CHAT_HISTORY_KEY).toBe('eve_chat_history_v3');
    expect(LEGACY_STORAGE_KEYS).toContain('eve_chat_history_v2');
    expect(LEGACY_STORAGE_KEYS).toContain('eve_response_id_v2');
    expect(LEGACY_STORAGE_KEYS).toContain('eve_chat_history');
    expect(LEGACY_STORAGE_KEYS).toContain('responseId');
    expect(LEGACY_STORAGE_KEYS).not.toContain(CHAT_HISTORY_KEY);
  });
});

describe('parseStoredHistory', () => {
  test('round-trips a well-formed history, including panel-only messages', () => {
    const history: ChatMessage[] = [
      { role: 'assistant', content: 'Welcome', local: true },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'cut', note: 'This reply was cut off.' },
      { role: 'assistant', content: 'Try again later', local: true },
    ];
    expect(parseStoredHistory(serializeHistory(history))).toEqual(history);
  });

  test('returns null for missing, malformed, or wrongly shaped values', () => {
    expect(parseStoredHistory(null)).toBeNull();
    expect(parseStoredHistory('')).toBeNull();
    expect(parseStoredHistory('{bad json')).toBeNull();
    expect(parseStoredHistory('{}')).toBeNull();
    expect(parseStoredHistory('[]')).toBeNull();
    expect(parseStoredHistory(JSON.stringify([{ role: 'system', content: 'x' }]))).toBeNull();
    expect(parseStoredHistory(JSON.stringify([{ role: 'user' }]))).toBeNull();
    expect(parseStoredHistory(JSON.stringify([{ role: 'user', content: 1 }]))).toBeNull();
    expect(
      parseStoredHistory(JSON.stringify([{ role: 'user', content: 'x', note: 5 }])),
    ).toBeNull();
    // One bad entry poisons the whole list — start fresh rather than render garbage.
    expect(
      parseStoredHistory(JSON.stringify([{ role: 'user', content: 'ok' }, { nope: true }])),
    ).toBeNull();
  });

  test('`local` may only be true', () => {
    for (const local of [false, 'true', 1, null]) {
      expect(
        parseStoredHistory(JSON.stringify([{ role: 'assistant', content: 'x', local }])),
      ).toBeNull();
    }
  });

  test('keeps only the most recent MAX_STORED_MESSAGES entries', () => {
    const many: ChatMessage[] = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `m${i}`,
    }));
    const parsed = parseStoredHistory(JSON.stringify(many));
    expect(parsed).toHaveLength(MAX_STORED_MESSAGES);
    expect(parsed?.[0].content).toBe('m10');
    expect(parsed?.at(-1)?.content).toBe(`m${MAX_STORED_MESSAGES + 9}`);
    // serializeHistory applies the same cap on the way out.
    expect(JSON.parse(serializeHistory(many))).toHaveLength(MAX_STORED_MESSAGES);
  });
});

describe('toRequestHistory', () => {
  test('sends only real conversation: no welcome line, error bubbles, or blanks', () => {
    const transcript: ChatMessage[] = [
      { role: 'assistant', content: 'Welcome', local: true },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Something broke', local: true },
      { role: 'user', content: 'hi again' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'assistant', content: '   ' },
      { role: 'user', content: 'what next?' },
    ];
    expect(toRequestHistory(transcript)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'user', content: 'hi again' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'what next?' },
    ]);
  });

  test('strips panel-only fields such as note', () => {
    const sent = toRequestHistory([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'partial', note: 'This reply was cut off.' },
      { role: 'user', content: 'go on' },
    ]);
    expect(sent).toEqual([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'partial' },
      { role: 'user', content: 'go on' },
    ]);
    for (const message of sent) expect(Object.keys(message).sort()).toEqual(['content', 'role']);
  });

  test('trims to the same caps the server enforces', () => {
    const transcript: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x'.repeat(2000),
    }));
    transcript.push({ role: 'user', content: 'latest' });
    const sent = toRequestHistory(transcript);
    expect(sent.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(sent.reduce((n, m) => n + m.content.length, 0)).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
    expect(sent.at(-1)).toEqual({ role: 'user', content: 'latest' });
    expect(sent[0].role).toBe('user');
  });
});
