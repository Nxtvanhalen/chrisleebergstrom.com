// Pure (de)serialisation for the chat panel's localStorage state. Nothing here
// touches `window`, so it can be unit-tested and the panel keeps the only
// try/catch around actual storage access.
//
// Keys are versioned: bump the suffix when the stored shape changes and add the
// old key to LEGACY_STORAGE_KEYS so it gets cleaned up on next load.

import { type HistoryMessage, trimHistory } from './eve-validation';

export const CHAT_HISTORY_KEY = 'eve_chat_history_v3';
// v2 paired the transcript with an OpenAI response id; the model is now
// stateless and the transcript itself is the conversation.
export const LEGACY_STORAGE_KEYS = [
  'eve_chat_history',
  'responseId',
  'eve_chat_history_v2',
  'eve_response_id_v2',
] as const;

// Keeps localStorage small and the first render cheap. Only the most recent
// turns are sent upstream anyway (see trimHistory).
export const MAX_STORED_MESSAGES = 50;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  // Short status shown under the bubble, e.g. when a reply was cut off.
  note?: string;
  // Written by the panel itself (the welcome line, error bubbles), never by the
  // model, so it is shown but not sent back as conversation.
  local?: true;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    (msg.note === undefined || typeof msg.note === 'string') &&
    (msg.local === undefined || msg.local === true)
  );
}

// Returns null for anything that is not a well-formed, non-empty message list.
// Callers treat null as "start fresh" rather than crashing on a hand-edited
// value.
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

// The conversation to send with the next request: the transcript minus the
// panel's own messages, trimmed to what the server will accept.
export function toRequestHistory(messages: readonly ChatMessage[]): HistoryMessage[] {
  return trimHistory(
    messages
      .filter((m) => !m.local && m.content.trim().length > 0)
      .map(({ role, content }) => ({ role, content })),
  );
}
