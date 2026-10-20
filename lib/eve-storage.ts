// Pure (de)serialisation for the chat panel's localStorage state. Nothing here
// touches `window`, so it can be unit-tested and the panel keeps the only
// try/catch around actual storage access.
//
// Keys are versioned: bump the suffix when the stored shape changes and add the
// old key to LEGACY_STORAGE_KEYS so it gets cleaned up on next load.

import { isValidResponseId } from './eve-validation';

export const CHAT_HISTORY_KEY = 'eve_chat_history_v2';
export const RESPONSE_ID_KEY = 'eve_response_id_v2';
export const LEGACY_STORAGE_KEYS = ['eve_chat_history', 'responseId'] as const;

// Keeps localStorage small and the first render cheap; the OpenAI side carries
// the real conversation state via previous_response_id.
export const MAX_STORED_MESSAGES = 50;

// OpenAI keeps stored responses for ~30 days. We expire ours well inside that so
// a visitor returning after a break starts clean instead of hitting a 404 on
// the first send.
export const RESPONSE_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  // Short status shown under the bubble, e.g. when a reply was cut off.
  note?: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    (msg.note === undefined || typeof msg.note === 'string')
  );
}

// Returns null for anything that is not a well-formed, non-empty message list.
// Callers treat null as "start fresh" rather than crashing on a hand-edited or
// pre-v2 value.
export function parseStoredHistory(raw: string | null): ChatMessage[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isChatMessage)) {
    return null;
  }
  return parsed.slice(-MAX_STORED_MESSAGES);
}

export function serializeHistory(messages: ChatMessage[]): string {
  return JSON.stringify(messages.slice(-MAX_STORED_MESSAGES));
}

type StoredResponseId = { id: string; savedAt: number };

export function parseStoredResponseId(raw: string | null, now: number): string | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { id, savedAt } = parsed as Partial<StoredResponseId>;
  if (!isValidResponseId(id) || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) {
    return null;
  }
  // A future timestamp means a skewed clock; don't trust the age either way.
  if (savedAt > now || now - savedAt > RESPONSE_ID_TTL_MS) return null;
  return id;
}

export function serializeResponseId(id: string, now: number): string {
  const record: StoredResponseId = { id, savedAt: now };
  return JSON.stringify(record);
}
