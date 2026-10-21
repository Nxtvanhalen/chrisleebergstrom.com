// Pure request-validation helpers for the EVE chat route. No framework, Sentry
// or browser imports so every function here can be unit-tested directly; the
// route handler decides which HTTP status each failure maps to.

// Hard cap on the raw request body. A 4000-char message plus a response id and
// context fits in ~5 KB even as multi-byte UTF-8; 16 KB leaves slack without
// letting a client make us buffer megabytes before we even parse.
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_MESSAGE_CHARS = 4000;
// OpenAI response ids are ~50 chars today; the cap only guards against abuse.
export const MAX_RESPONSE_ID_CHARS = 128;

// Section names the client may report as "where the visitor is". Keep in sync
// with every `setContext(...)` call site (ChatContext default + app/projects/ArchiveCard.tsx).
// Anything else is dropped so visitor-controlled text never reaches the prompt.
export const EVE_CONTEXTS = ['Home', 'Projects'] as const;
export type EveContext = (typeof EVE_CONTEXTS)[number];

export function isEveContext(value: unknown): value is EveContext {
  return typeof value === 'string' && (EVE_CONTEXTS as readonly string[]).includes(value);
}

// Shape of an OpenAI Responses API id. Shared with the client-side storage code
// so a corrupted localStorage value is discarded before it is ever sent.
export const RESPONSE_ID_PATTERN = /^resp_[A-Za-z0-9]+$/;

export function isValidResponseId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_RESPONSE_ID_CHARS &&
    RESPONSE_ID_PATTERN.test(value)
  );
}

export type ChatRequest = {
  prompt: string;
  previousResponseId: string | null;
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

  const messageError = validateUserMessage(body.prompt);
  if (messageError) {
    return { ok: false, error: messageError };
  }

  // null, undefined and '' all mean "no prior turn"; anything else must look
  // like a real response id or we refuse rather than forward garbage upstream.
  let previousResponseId: string | null = null;
  const rawId = body.previousResponseId;
  if (rawId != null && rawId !== '') {
    if (!isValidResponseId(rawId)) {
      return { ok: false, error: 'Previous response ID is malformed' };
    }
    previousResponseId = rawId;
  }

  return {
    ok: true,
    value: {
      prompt: (body.prompt as string).trim(),
      previousResponseId,
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

// Render terminates TLS and fronts the app with its own proxy, which sets
// X-Forwarded-For with the real client address first. That trust is only valid
// behind Render: if the app is ever exposed directly, a client can spoof this
// header and dodge the per-IP limiter (the global cap still holds).
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
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
