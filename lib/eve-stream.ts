// Converts an OpenAI Responses SSE stream into the newline-delimited JSON the
// chat client reads: one { type: 'delta', text } per token, then exactly one
// terminal event — { type: 'done', responseId, finalText } on success or
// { type: 'error', message } when the reply failed, was cut off, or the upstream
// connection dropped. A failed reply never gets a `done`, so the client never
// stores a response id it cannot continue from.
//
// The parsing is split into pure pieces (splitSseBuffer, parseStreamEvent,
// createReplyReducer) so it can be unit-tested without streams.

// --- Events we emit to the client -------------------------------------------

export type EveStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; responseId: string | null; finalText: string }
  | { type: 'error'; message: string; code: EveStreamErrorCode };

export type EveStreamErrorCode = 'failed' | 'incomplete' | 'disconnected';

export const EVE_STREAM_MESSAGES: Record<EveStreamErrorCode, string> = {
  failed: 'EVE hit a snag generating that reply. Please try again.',
  incomplete: 'That reply ran long and was cut off.',
  disconnected: 'The connection dropped mid-reply. Please try again.',
};

// --- Events OpenAI sends (only the ones we act on) --------------------------

export type OpenAIResponseObject = {
  id: string;
  status?: string;
  error?: { code?: string | null; message?: string } | null;
  incomplete_details?: { reason?: string } | null;
};

export type OpenAIStreamEvent =
  | { type: 'response.created' | 'response.completed'; response: OpenAIResponseObject }
  | { type: 'response.failed' | 'response.incomplete'; response: OpenAIResponseObject }
  | { type: 'response.output_text.delta'; delta: string }
  | { type: 'error'; code?: string | null; message?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasResponseObject(value: Record<string, unknown>): value is Record<string, unknown> & {
  response: OpenAIResponseObject;
} {
  return isRecord(value.response) && typeof value.response.id === 'string';
}

// Narrows a decoded SSE payload to a typed event. Unknown or malformed event
// types return null and are ignored; OpenAI adds event types over time.
export function parseStreamEvent(payload: unknown): OpenAIStreamEvent | null {
  if (!isRecord(payload) || typeof payload.type !== 'string') return null;
  switch (payload.type) {
    case 'response.output_text.delta':
      return typeof payload.delta === 'string'
        ? { type: payload.type, delta: payload.delta }
        : null;
    case 'response.created':
    case 'response.completed':
    case 'response.failed':
    case 'response.incomplete':
      return hasResponseObject(payload) ? { type: payload.type, response: payload.response } : null;
    case 'error':
      return {
        type: 'error',
        code: typeof payload.code === 'string' ? payload.code : null,
        message: typeof payload.message === 'string' ? payload.message : undefined,
      };
    default:
      return null;
  }
}

// SSE events are separated by a blank line. Returns the complete events and the
// unterminated remainder to carry into the next chunk.
export function splitSseBuffer(buffer: string): { events: string[]; rest: string } {
  const events = buffer.split('\n\n');
  const rest = events.pop() ?? '';
  return { events, rest };
}

// Extracts the JSON payloads from one raw SSE event (there may be several
// `data:` lines; OpenAI sends one). Non-JSON data is skipped.
export function parseSseEvent(raw: string): OpenAIStreamEvent[] {
  const parsed: OpenAIStreamEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    const event = parseStreamEvent(payload);
    if (event) parsed.push(event);
  }
  return parsed;
}

// --- Reply state machine ----------------------------------------------------

export type ReplyFailure = { code: EveStreamErrorCode; detail: string };

export type ReplyReducer = {
  // Feed decoded upstream text; returns client events to emit now.
  push(chunk: string): EveStreamEvent[];
  // True once a terminal upstream event has been seen (completed/failed/etc.).
  finished(): boolean;
  // Why the reply failed, for logging. Null while healthy.
  failure(): ReplyFailure | null;
  // The single terminal client event. Call once the upstream is done.
  finish(): EveStreamEvent;
};

export function createReplyReducer(): ReplyReducer {
  let sseBuffer = '';
  let fullText = '';
  let responseId: string | null = null;
  let completed = false;
  let failure: ReplyFailure | null = null;

  function apply(event: OpenAIStreamEvent): EveStreamEvent | null {
    switch (event.type) {
      case 'response.output_text.delta':
        fullText += event.delta;
        return { type: 'delta', text: event.delta };
      case 'response.created':
        responseId = event.response.id;
        return null;
      case 'response.completed':
        responseId = event.response.id;
        completed = true;
        return null;
      case 'response.failed':
        failure = {
          code: 'failed',
          detail: event.response.error?.message ?? 'response.failed without error detail',
        };
        return null;
      case 'response.incomplete':
        failure = {
          code: 'incomplete',
          detail: `response.incomplete: ${event.response.incomplete_details?.reason ?? 'unknown'}`,
        };
        return null;
      case 'error':
        failure = { code: 'failed', detail: event.message ?? `error event ${event.code ?? ''}` };
        return null;
    }
  }

  return {
    push(chunk) {
      sseBuffer += chunk;
      const { events, rest } = splitSseBuffer(sseBuffer);
      sseBuffer = rest;
      const out: EveStreamEvent[] = [];
      for (const raw of events) {
        for (const event of parseSseEvent(raw)) {
          const emitted = apply(event);
          if (emitted) out.push(emitted);
          if (completed || failure) return out;
        }
      }
      return out;
    },
    finished: () => completed || failure !== null,
    failure: () => failure,
    finish() {
      if (failure) {
        return { type: 'error', message: EVE_STREAM_MESSAGES[failure.code], code: failure.code };
      }
      if (!completed) {
        // Upstream closed without a terminal event: treat as a dropped connection
        // rather than handing the client a response id of unknown validity.
        return { type: 'error', message: EVE_STREAM_MESSAGES.disconnected, code: 'disconnected' };
      }
      return { type: 'done', responseId, finalText: fullText };
    },
  };
}

// --- Stream wrapper ---------------------------------------------------------

export type EveStreamOptions = {
  // Aborting this signal (the inbound request's) cancels the upstream read.
  signal?: AbortSignal;
  // Called with the upstream failure detail or thrown error, for logging.
  onFailure?: (failure: ReplyFailure, error?: unknown) => void;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createEveNdjsonStream(
  upstream: ReadableStream<Uint8Array>,
  options: EveStreamOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.getReader();
  const reply = createReplyReducer();
  // Set once the consumer cancels or we close; enqueue/close after that throws.
  let closed = false;

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const detach = () => {
    options.signal?.removeEventListener('abort', onAbort);
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const send = (event: EveStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        detach();
        controller.close();
      };

      try {
        // Keep reading until this pull enqueues something. A pull that resolves
        // without enqueueing is not re-invoked, so a chunk carrying only
        // bookkeeping events (response.created, output_item.added…) would
        // otherwise stall the consumer forever.
        while (true) {
          const { done, value } = await reader.read();
          if (closed) return;

          if (!done) {
            let sent = false;
            for (const event of reply.push(decoder.decode(value, { stream: true }))) {
              send(event);
              sent = true;
            }
            // Stop reading as soon as OpenAI says the reply is over; there is
            // nothing useful after a terminal event.
            if (!reply.finished()) {
              if (sent) return;
              continue;
            }
            reader.cancel().catch(() => {});
          }

          const terminal = reply.finish();
          if (terminal.type === 'error') {
            const failure = reply.failure() ?? {
              code: 'disconnected',
              detail: 'stream ended early',
            };
            options.onFailure?.(failure);
          }
          send(terminal);
          close();
          return;
        }
      } catch (error: unknown) {
        if (closed) return;
        // A cancelled consumer (visitor closed the panel) is not a failure.
        if (!isAbortError(error) && !options.signal?.aborted) {
          options.onFailure?.({ code: 'disconnected', detail: String(error) }, error);
        }
        send({
          type: 'error',
          message: EVE_STREAM_MESSAGES.disconnected,
          code: 'disconnected',
        });
        close();
      }
    },
    cancel() {
      closed = true;
      detach();
      return reader.cancel().catch(() => {});
    },
  });
}
