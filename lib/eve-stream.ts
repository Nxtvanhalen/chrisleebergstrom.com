// Converts a streamed Chat Completions response (DeepSeek speaks the OpenAI wire
// format) into the newline-delimited JSON the chat client reads: one
// { type: 'delta', text } per token, then exactly one terminal event —
// { type: 'done', finalText } on success or { type: 'error', message, code } when
// the reply failed, was cut off, stalled, or the upstream connection dropped.
//
// The parsing is split into pure pieces (splitSseBuffer, parseStreamChunk,
// createReplyReducer) so it can be unit-tested without streams.

// --- Events we emit to the client -------------------------------------------

export type EveStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; finalText: string }
  | { type: 'error'; message: string; code: EveStreamErrorCode };

export type EveStreamErrorCode = 'failed' | 'incomplete' | 'disconnected' | 'timeout';

export const EVE_STREAM_MESSAGES: Record<EveStreamErrorCode, string> = {
  failed: 'EVE hit a snag generating that reply. Please try again.',
  incomplete: 'That reply ran long and was cut off.',
  disconnected: 'The connection dropped mid-reply. Please try again.',
  timeout: 'EVE took too long to answer. Please try again.',
};

// --- What the upstream sends (only the parts we act on) ----------------------

// One `data:` payload, reduced to what matters. A chunk can carry text and a
// finish reason at once, so this is a list of signals rather than one event.
export type UpstreamSignal =
  | { kind: 'text'; text: string }
  | { kind: 'finish'; reason: string }
  | { kind: 'error'; message: string }
  | { kind: 'end' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// A provider's `type` / `code` are short machine identifiers; anything else in
// those fields is dropped rather than trusted.
const ERROR_LABEL = /^[\w.:-]{1,64}$/;

function errorLabel(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && ERROR_LABEL.test(value) ? value : null;
}

/**
 * What is safe to log or report about an upstream error object: its `type` and
 * `code`, never its `message`. A provider's message is free text and can quote
 * the prompt it rejected, and visitor chat text must not reach the logs or Sentry.
 */
export function describeUpstreamError(error: unknown): string {
  if (!isRecord(error)) return 'upstream error';
  const parts = [
    ['type', errorLabel(error.type)],
    ['code', errorLabel(error.code)],
  ].flatMap(([name, label]) => (label ? [`${name}=${label}`] : []));
  return parts.length > 0 ? `upstream error (${parts.join(', ')})` : 'upstream error';
}

/** The same summary for a raw error response body, which may not be JSON at all. */
export function describeUpstreamErrorBody(body: string): string {
  try {
    const payload: unknown = JSON.parse(body);
    if (isRecord(payload) && isRecord(payload.error)) return describeUpstreamError(payload.error);
  } catch {
    // Not JSON (an HTML gateway page, an empty body): only its size is reported.
  }
  return `upstream error (unrecognised body, ${body.length} chars)`;
}

// Narrows a decoded chunk. Unknown shapes yield no signals and are ignored, so
// extra fields (usage, logprobs, reasoning_content) never break the stream.
export function parseStreamChunk(payload: unknown): UpstreamSignal[] {
  if (!isRecord(payload)) return [];
  if (isRecord(payload.error)) {
    return [{ kind: 'error', message: describeUpstreamError(payload.error) }];
  }
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : undefined;
  if (!isRecord(choice)) return [];
  const signals: UpstreamSignal[] = [];
  const content = isRecord(choice.delta) ? choice.delta.content : undefined;
  if (typeof content === 'string' && content.length > 0) {
    signals.push({ kind: 'text', text: content });
  }
  if (typeof choice.finish_reason === 'string') {
    signals.push({ kind: 'finish', reason: choice.finish_reason });
  }
  return signals;
}

// SSE events are separated by a blank line. Returns the complete events and the
// unterminated remainder to carry into the next chunk. The SSE standard allows
// CRLF line endings as well as LF, so CRLF is normalised first: without that a
// CRLF stream never matches the separator and the whole reply is lost. A "\r"
// that ends one chunk stays in `rest` and meets its "\n" on the next call.
export function splitSseBuffer(buffer: string): { events: string[]; rest: string } {
  const events = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = events.pop() ?? '';
  return { events, rest };
}

// Extracts the signals from one raw SSE event. Comment lines (": keep-alive",
// sent while a request is queued) and non-JSON data are skipped.
export function parseSseEvent(raw: string): UpstreamSignal[] {
  const signals: UpstreamSignal[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === '[DONE]') {
      signals.push({ kind: 'end' });
      continue;
    }
    try {
      signals.push(...parseStreamChunk(JSON.parse(data)));
    } catch {
      // Not JSON; ignore.
    }
  }
  return signals;
}

// --- Reply state machine ----------------------------------------------------

export type ReplyFailure = { code: EveStreamErrorCode; detail: string };

export type ReplyReducer = {
  // Feed decoded upstream text; returns client events to emit now.
  push(chunk: string): EveStreamEvent[];
  // True once the reply is over, successfully or not.
  finished(): boolean;
  // Why the reply failed, for logging. Null while healthy.
  failure(): ReplyFailure | null;
  // The single terminal client event. Call once the upstream is done.
  finish(): EveStreamEvent;
};

export function createReplyReducer(): ReplyReducer {
  let sseBuffer = '';
  let fullText = '';
  let completed = false;
  let failure: ReplyFailure | null = null;

  function apply(signal: UpstreamSignal): EveStreamEvent | null {
    switch (signal.kind) {
      case 'text':
        fullText += signal.text;
        return { type: 'delta', text: signal.text };
      case 'finish':
        if (signal.reason === 'stop') completed = true;
        else if (signal.reason === 'length') {
          failure = { code: 'incomplete', detail: 'finish_reason: length' };
        } else {
          // Provider vocabulary (content_filter, tool_calls…), but still passed through the
          // label filter so nothing free-form can ride into the logs.
          failure = {
            code: 'failed',
            detail: `finish_reason: ${errorLabel(signal.reason) ?? 'unrecognised'}`,
          };
        }
        return null;
      case 'error':
        failure = { code: 'failed', detail: signal.message };
        return null;
      case 'end':
        // [DONE] without a finish reason: the reply ended in an unknown state.
        if (!completed) failure = { code: 'disconnected', detail: '[DONE] before finish_reason' };
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
        for (const signal of parseSseEvent(raw)) {
          const emitted = apply(signal);
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
        // Upstream closed without saying the reply was finished.
        return { type: 'error', message: EVE_STREAM_MESSAGES.disconnected, code: 'disconnected' };
      }
      return { type: 'done', finalText: fullText };
    },
  };
}

// --- Stream wrapper ---------------------------------------------------------

// A healthy reply streams tokens continuously and finishes well inside these;
// the limits only end a stalled upstream instead of leaving the visitor
// watching a spinner forever.
export const DEFAULT_IDLE_TIMEOUT_MS = 20_000;
export const DEFAULT_TOTAL_TIMEOUT_MS = 90_000;

export type EveStreamOptions = {
  // Aborting this signal (the inbound request's) cancels the upstream read.
  signal?: AbortSignal;
  // Longest wait for the next upstream chunk.
  idleTimeoutMs?: number;
  // Longest the whole reply may take once streaming starts.
  totalTimeoutMs?: number;
  // Called with the upstream failure detail or thrown error, for logging. Never
  // called when the visitor cancelled: that is not a failure.
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
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const deadline = Date.now() + (options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS);
  // Set once the consumer cancels or we close; enqueue/close after that throws.
  let closed = false;

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  options.signal?.addEventListener('abort', onAbort, { once: true });

  const detach = () => {
    options.signal?.removeEventListener('abort', onAbort);
  };

  const cancelled = () => options.signal?.aborted === true;

  const report = (failure: ReplyFailure, error?: unknown) => {
    if (!cancelled()) options.onFailure?.(failure, error);
  };

  // reader.read() bounded by the idle and total limits.
  const read = async (): Promise<Awaited<ReturnType<typeof reader.read>> | 'timeout'> => {
    const wait = Math.min(idleTimeoutMs, deadline - Date.now());
    if (wait <= 0) return 'timeout';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), wait);
    });
    try {
      return await Promise.race([reader.read(), timedOut]);
    } finally {
      clearTimeout(timer);
    }
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
        // without enqueueing is not re-invoked, so a chunk carrying no text (the
        // opening role chunk, keep-alive comments) would otherwise stall the
        // consumer forever.
        while (true) {
          const result = await read();
          if (closed) return;

          if (result === 'timeout') {
            reader.cancel().catch(() => {});
            report({ code: 'timeout', detail: 'upstream stalled' });
            send({ type: 'error', message: EVE_STREAM_MESSAGES.timeout, code: 'timeout' });
            close();
            return;
          }

          if (!result.done) {
            let sent = false;
            for (const event of reply.push(decoder.decode(result.value, { stream: true }))) {
              send(event);
              sent = true;
            }
            // Stop reading as soon as the reply is over; nothing useful follows.
            if (!reply.finished()) {
              if (sent) return;
              continue;
            }
            reader.cancel().catch(() => {});
          }

          const terminal = reply.finish();
          if (terminal.type === 'error') {
            // An upstream that ends because the visitor cancelled is not a
            // failure worth reporting.
            report(reply.failure() ?? { code: 'disconnected', detail: 'stream ended early' });
          }
          send(terminal);
          close();
          return;
        }
      } catch (error: unknown) {
        if (closed) return;
        if (!isAbortError(error)) {
          report({ code: 'disconnected', detail: String(error) }, error);
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
