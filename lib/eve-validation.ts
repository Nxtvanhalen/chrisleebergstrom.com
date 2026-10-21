// Pure request-validation helpers for the EVE chat route. No framework, Sentry
// or browser imports so every function here can be unit-tested directly; the
// route handler decides which HTTP status each failure maps to. `trimHistory`
// is also used by the chat panel, so client and server trim the same way.

// Hard cap on the raw request body. The client sends at most MAX_HISTORY_CHARS
// of conversation (plus JSON overhead and multi-byte UTF-8); 64 KB leaves slack
// without letting a client make us buffer megabytes before we even parse.
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_MESSAGE_CHARS = 4000;
// How much conversation goes upstream with each request. DeepSeek is stateless,
// so the client resends recent turns; these caps bound the input tokens (and so
// the cost) of every call no matter how long a visitor keeps chatting. The
// server trims again rather than trusting the client.
export const MAX_HISTORY_MESSAGES = 16;
export const MAX_HISTORY_CHARS = 16_000;
// What the server accepts before trimming: generous, but a list longer than
// this is not something our client sends.
const MAX_RECEIVED_MESSAGES = 60;

// Section names the client may report as "where the visitor is". Keep in sync
// with every `setContext(...)` call site (ChatContext default + app/projects/ArchiveCard.tsx).
// Anything else is dropped so visitor-controlled text never reaches the prompt.
export const EVE_CONTEXTS = ['Home', 'Projects'] as const;
export type EveContext = (typeof EVE_CONTEXTS)[number];

export function isEveContext(value: unknown): value is EveContext {
  return typeof value === 'string' && (EVE_CONTEXTS as readonly string[]).includes(value);
}

export type HistoryMessage = { role: 'user' | 'assistant'; content: string };

export type ChatRequest = {
  messages: HistoryMessage[];
  context: EveContext | null;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateUserMessage(message: unknown): string | null {
  if (typeof message !== 'string' || message.length === 0) {
    return 'User message must be a non-empty string';
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return 'User message cannot be empty';
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    return `User message exceeds maximum length of ${MAX_MESSAGE_CHARS} characters`;
  }
  return null;
}

/**
 * Keeps the most recent turns that fit both caps, always ending on the newest
 * message and always starting on a user turn (a leading assistant reply with no
 * question before it only confuses the model). Shared by the client, which trims
 * before sending, and the server, which trims again.
 */
export function trimHistory<T extends HistoryMessage>(
  messages: readonly T[],
  maxMessages = MAX_HISTORY_MESSAGES,
  maxChars = MAX_HISTORY_CHARS,
): T[] {
  const kept: T[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && kept.length < maxMessages; i--) {
    const message = messages[i];
    // The newest message is always kept; it has already passed the length check.
    if (kept.length > 0 && chars + message.content.length > maxChars) break;
    kept.unshift(message);
    chars += message.content.length;
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift();
  return kept;
}

function isHistoryMessage(value: unknown): value is HistoryMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string';
}

// Parses and validates the already-size-capped body text. Malformed JSON and
// non-object bodies are ordinary client errors, not exceptions.
export function parseChatRequest(raw: string): ValidationResult<ChatRequest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Request body must be valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const body = parsed as Record<string, unknown>;

  const list = body.messages;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array' };
  }
  if (list.length > MAX_RECEIVED_MESSAGES) {
    return { ok: false, error: `messages may hold at most ${MAX_RECEIVED_MESSAGES} entries` };
  }
  if (!list.every(isHistoryMessage)) {
    return { ok: false, error: 'Each message needs a role (user or assistant) and string content' };
  }
  const last = list[list.length - 1] as HistoryMessage;
  if (last.role !== 'user') {
    return { ok: false, error: 'The last message must be from the user' };
  }
  const messageError = validateUserMessage(last.content);
  if (messageError) {
    return { ok: false, error: messageError };
  }

  // Earlier turns are only trimmed and capped: an over-long or empty one is
  // dropped rather than failing a request the visitor can't fix.
  const earlier = (list.slice(0, -1) as HistoryMessage[])
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0 && m.content.length <= MAX_MESSAGE_CHARS);

  return {
    ok: true,
    value: {
      messages: trimHistory([...earlier, { role: 'user', content: last.content.trim() }]),
      context: isEveContext(body.context) ? body.context : null,
    },
  };
}

export function isJsonContentType(header: string | null): boolean {
  if (!header) return false;
  // Ignore parameters such as "; charset=utf-8".
  const mediaType = header.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}

// CSRF guard for a same-origin endpoint. Modern browsers send Sec-Fetch-Site on
// every request, which is the authoritative signal. Older browsers still send
// Origin on cross-origin POSTs, so fall back to comparing it with Host. A request
// with neither header is not a browser, and non-browser clients can forge any
// header anyway, so refusing it would buy nothing.
export function isSameOriginRequest(headers: Headers): boolean {
  const fetchSite = headers.get('sec-fetch-site');
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none';
  }
  const origin = headers.get('origin');
  if (!origin) return true;
  const host = headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    // Includes the literal "null" origin that sandboxed/opaque contexts send.
    return false;
  }
}

export class BodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Body exceeds ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

// Reads a body stream into a string, giving up as soon as the byte count passes
// `maxBytes`. Content-Length can be absent or lie (chunked uploads), so this is
// the check that actually bounds memory. Shared with the Substack route to cap
// upstream responses the same way.
export async function readTextWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new BodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
