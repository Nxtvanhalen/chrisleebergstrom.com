import { describe, expect, test } from 'bun:test';
import {
  type ChatMessage,
  MAX_STORED_MESSAGES,
  parseStoredHistory,
  parseStoredResponseId,
  RESPONSE_ID_TTL_MS,
  serializeHistory,
  serializeResponseId,
} from '../../lib/eve-storage';

const NOW = 1_800_000_000_000;

describe('parseStoredHistory', () => {
  test('round-trips a well-formed history', () => {
    const history: ChatMessage[] = [
      { role: 'assistant', content: 'Welcome' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'cut', note: 'This reply was cut off.' },
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

describe('parseStoredResponseId', () => {
  test('round-trips a fresh id', () => {
    const raw = serializeResponseId('resp_abc123', NOW);
    expect(parseStoredResponseId(raw, NOW)).toBe('resp_abc123');
    expect(parseStoredResponseId(raw, NOW + RESPONSE_ID_TTL_MS)).toBe('resp_abc123');
  });

  test('expires after the TTL', () => {
    const raw = serializeResponseId('resp_abc123', NOW);
    expect(parseStoredResponseId(raw, NOW + RESPONSE_ID_TTL_MS + 1)).toBeNull();
  });

  test('rejects a timestamp from the future (skewed clock)', () => {
    const raw = serializeResponseId('resp_abc123', NOW + 1);
    expect(parseStoredResponseId(raw, NOW)).toBeNull();
  });

  test('rejects malformed or hand-edited values', () => {
    expect(parseStoredResponseId(null, NOW)).toBeNull();
    expect(parseStoredResponseId('', NOW)).toBeNull();
    expect(parseStoredResponseId('resp_abc123', NOW)).toBeNull(); // pre-v2 bare string
    expect(parseStoredResponseId('{bad', NOW)).toBeNull();
    expect(parseStoredResponseId('null', NOW)).toBeNull();
    expect(parseStoredResponseId(JSON.stringify({ id: 'resp_abc' }), NOW)).toBeNull();
    expect(parseStoredResponseId(JSON.stringify({ id: 'garbage', savedAt: NOW }), NOW)).toBeNull();
    expect(
      parseStoredResponseId(JSON.stringify({ id: 'resp_abc', savedAt: 'yesterday' }), NOW),
    ).toBeNull();
    expect(
      parseStoredResponseId(JSON.stringify({ id: 'resp_abc', savedAt: Number.NaN }), NOW),
    ).toBeNull();
  });
});
