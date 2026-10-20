import { describe, expect, test } from 'bun:test';
import {
  createEveNdjsonStream,
  createReplyReducer,
  EVE_STREAM_MESSAGES,
  type EveStreamEvent,
  parseSseEvent,
  parseStreamEvent,
  splitSseBuffer,
} from '../../lib/eve-stream';

// --- helpers ----------------------------------------------------------------

function sse(type: string, payload: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

const CREATED = sse('response.created', { response: { id: 'resp_123', status: 'in_progress' } });
const DELTA = (text: string) => sse('response.output_text.delta', { delta: text });
const COMPLETED = sse('response.completed', {
  response: { id: 'resp_123', status: 'completed' },
});

type UpstreamControls = {
  stream: ReadableStream<Uint8Array>;
  push(chunk: string): void;
  close(): void;
  fail(error: unknown): void;
  cancelled(): boolean;
};

// A fake OpenAI SSE stream the test drives chunk by chunk.
function fakeUpstream(initial: string[] = []): UpstreamControls {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      for (const chunk of initial) c.enqueue(encoder.encode(chunk));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    stream,
    push: (chunk) => controller.enqueue(encoder.encode(chunk)),
    close: () => controller.close(),
    fail: (error) => controller.error(error),
    cancelled: () => cancelled,
  };
}

async function readNdjson(stream: ReadableStream<Uint8Array>): Promise<EveStreamEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as EveStreamEvent);
}

// --- pure parsers -------------------------------------------------------------

describe('splitSseBuffer', () => {
  test('returns complete events and carries the unterminated tail', () => {
    const { events, rest } = splitSseBuffer('data: a\n\ndata: b\n\ndata: partial');
    expect(events).toEqual(['data: a', 'data: b']);
    expect(rest).toBe('data: partial');
  });

  test('an empty buffer yields nothing', () => {
    expect(splitSseBuffer('')).toEqual({ events: [], rest: '' });
  });
});

describe('parseStreamEvent', () => {
  test('narrows the events the reducer acts on', () => {
    expect(parseStreamEvent({ type: 'response.output_text.delta', delta: 'hi' })).toEqual({
      type: 'response.output_text.delta',
      delta: 'hi',
    });
    expect(parseStreamEvent({ type: 'response.completed', response: { id: 'resp_1' } })).toEqual({
      type: 'response.completed',
      response: { id: 'resp_1' },
    });
    expect(parseStreamEvent({ type: 'error', code: 'rate_limit', message: 'slow' })).toEqual({
      type: 'error',
      code: 'rate_limit',
      message: 'slow',
    });
  });

  test('ignores unknown and malformed events', () => {
    expect(parseStreamEvent(null)).toBeNull();
    expect(parseStreamEvent('string')).toBeNull();
    expect(parseStreamEvent({ type: 'response.in_progress' })).toBeNull();
    expect(parseStreamEvent({ type: 'response.output_text.delta', delta: 5 })).toBeNull();
    expect(parseStreamEvent({ type: 'response.completed', response: {} })).toBeNull();
    expect(parseStreamEvent({ type: 'response.completed' })).toBeNull();
  });
});

describe('parseSseEvent', () => {
  test('reads data: lines, skipping comments, [DONE], and bad JSON', () => {
    const raw = [
      ': keep-alive',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"a"}',
      'data: [DONE]',
      'data: {not json',
      'data: {"type":"response.output_text.delta","delta":"b"}',
    ].join('\n');
    expect(parseSseEvent(raw)).toEqual([
      { type: 'response.output_text.delta', delta: 'a' },
      { type: 'response.output_text.delta', delta: 'b' },
    ]);
  });
});

// --- reducer --------------------------------------------------------------------

describe('createReplyReducer', () => {
  test('emits deltas and finishes with done + responseId + finalText', () => {
    const reply = createReplyReducer();
    expect(reply.push(CREATED)).toEqual([]);
    expect(reply.push(DELTA('Hel'))).toEqual([{ type: 'delta', text: 'Hel' }]);
    expect(reply.push(DELTA('lo'))).toEqual([{ type: 'delta', text: 'lo' }]);
    expect(reply.finished()).toBe(false);
    expect(reply.push(COMPLETED)).toEqual([]);
    expect(reply.finished()).toBe(true);
    expect(reply.failure()).toBeNull();
    expect(reply.finish()).toEqual({ type: 'done', responseId: 'resp_123', finalText: 'Hello' });
  });

  test('reassembles events split across chunk boundaries', () => {
    const reply = createReplyReducer();
    const whole = DELTA('split');
    const out = [...reply.push(whole.slice(0, 20)), ...reply.push(whole.slice(20))];
    expect(out).toEqual([{ type: 'delta', text: 'split' }]);
  });

  test('response.failed → error, no done', () => {
    const reply = createReplyReducer();
    reply.push(CREATED);
    reply.push(DELTA('partial'));
    reply.push(
      sse('response.failed', { response: { id: 'resp_123', error: { message: 'boom' } } }),
    );
    expect(reply.finished()).toBe(true);
    expect(reply.failure()).toEqual({ code: 'failed', detail: 'boom' });
    expect(reply.finish()).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.failed,
      code: 'failed',
    });
  });

  test('response.incomplete → error with the reason recorded', () => {
    const reply = createReplyReducer();
    reply.push(
      sse('response.incomplete', {
        response: { id: 'resp_123', incomplete_details: { reason: 'max_output_tokens' } },
      }),
    );
    expect(reply.failure()).toEqual({
      code: 'incomplete',
      detail: 'response.incomplete: max_output_tokens',
    });
    expect(reply.finish().type).toBe('error');
  });

  test('an upstream error event → error', () => {
    const reply = createReplyReducer();
    reply.push(sse('error', { code: 'server_error', message: 'upstream exploded' }));
    expect(reply.failure()).toEqual({ code: 'failed', detail: 'upstream exploded' });
    expect(reply.finish()).toMatchObject({ type: 'error', code: 'failed' });
  });

  test('stream ending without a terminal event → disconnected, never done', () => {
    const reply = createReplyReducer();
    reply.push(CREATED);
    reply.push(DELTA('half a rep'));
    expect(reply.finished()).toBe(false);
    expect(reply.finish()).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.disconnected,
      code: 'disconnected',
    });
  });

  test('stops consuming events after a terminal one', () => {
    const reply = createReplyReducer();
    const out = reply.push(DELTA('a') + COMPLETED + DELTA('b'));
    expect(out).toEqual([{ type: 'delta', text: 'a' }]);
    expect(reply.finish()).toMatchObject({ finalText: 'a' });
  });
});

// --- stream wrapper ---------------------------------------------------------------

describe('createEveNdjsonStream', () => {
  test('a healthy upstream yields deltas then exactly one done', async () => {
    const upstream = fakeUpstream([CREATED, DELTA('Hello'), DELTA(', world'), COMPLETED]);
    upstream.close();
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ', world' },
      { type: 'done', responseId: 'resp_123', finalText: 'Hello, world' },
    ]);
  });

  test('stops reading once OpenAI sends a terminal event, even if the upstream stays open', async () => {
    const upstream = fakeUpstream([CREATED, DELTA('done early'), COMPLETED]);
    // Deliberately NOT closed: the wrapper must finish on its own.
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events.at(-1)).toEqual({
      type: 'done',
      responseId: 'resp_123',
      finalText: 'done early',
    });
    expect(upstream.cancelled()).toBe(true);
  });

  test('response.failed → one error event, no done, onFailure called', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([
      CREATED,
      DELTA('partial'),
      sse('response.failed', { response: { id: 'resp_123', error: { message: 'boom' } } }),
    ]);
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, { onFailure: (f) => failures.push(f) }),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'partial' },
      { type: 'error', message: EVE_STREAM_MESSAGES.failed, code: 'failed' },
    ]);
    expect(events.filter((e) => e.type === 'done')).toHaveLength(0);
    expect(failures).toEqual([{ code: 'failed', detail: 'boom' }]);
  });

  test('response.incomplete → error, no done', async () => {
    const upstream = fakeUpstream([
      DELTA('long'),
      sse('response.incomplete', {
        response: { id: 'resp_123', incomplete_details: { reason: 'max_output_tokens' } },
      }),
    ]);
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events.at(-1)).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.incomplete,
      code: 'incomplete',
    });
  });

  test('an upstream error event → error, no done', async () => {
    const upstream = fakeUpstream([sse('error', { code: 'server_error', message: 'nope' })]);
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events).toEqual([
      { type: 'error', message: EVE_STREAM_MESSAGES.failed, code: 'failed' },
    ]);
  });

  test('upstream closing early → disconnected error, no done, no response id leaked', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([CREATED, DELTA('cut')]);
    upstream.close();
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, { onFailure: (f) => failures.push(f) }),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'cut' },
      { type: 'error', message: EVE_STREAM_MESSAGES.disconnected, code: 'disconnected' },
    ]);
    expect(JSON.stringify(events)).not.toContain('resp_123');
    expect(failures).toHaveLength(1);
  });

  test('an upstream read error → disconnected error and onFailure gets the cause', async () => {
    const seen: Array<{ failure: unknown; error: unknown }> = [];
    const upstream = fakeUpstream([DELTA('a')]);
    const cause = new Error('socket hang up');
    upstream.fail(cause);
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, {
        onFailure: (failure, error) => seen.push({ failure, error }),
      }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'disconnected' });
    expect(seen).toHaveLength(1);
    expect(seen[0].error).toBe(cause);
  });

  test('cancelling the client stream cancels the upstream reader', async () => {
    const upstream = fakeUpstream([CREATED, DELTA('a')]);
    const stream = createEveNdjsonStream(upstream.stream);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(upstream.cancelled()).toBe(true);
  });

  test('aborting the request signal cancels the upstream without reporting a failure', async () => {
    const failures: unknown[] = [];
    const abort = new AbortController();
    const upstream = fakeUpstream([DELTA('a')]);
    const stream = createEveNdjsonStream(upstream.stream, {
      signal: abort.signal,
      onFailure: (f) => failures.push(f),
    });
    const reader = stream.getReader();
    await reader.read();
    abort.abort();
    expect(upstream.cancelled()).toBe(true);
    // Whatever the wrapper emits after that, an aborted visitor is not a Sentry-worthy failure.
    await reader.cancel().catch(() => {});
    expect(failures).toEqual([]);
  });
});
