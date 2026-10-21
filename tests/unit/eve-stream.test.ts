import { describe, expect, test } from 'bun:test';
import {
  createEveNdjsonStream,
  createReplyReducer,
  EVE_STREAM_MESSAGES,
  type EveStreamEvent,
  parseSseEvent,
  parseStreamChunk,
  splitSseBuffer,
} from '../../lib/eve-stream';

// --- helpers ----------------------------------------------------------------

// Chunks in the exact shape DeepSeek's Chat Completions stream sends (captured
// from a real `deepseek-flash` call with thinking disabled).
function chunk(delta: Record<string, unknown>, finishReason: string | null = null, usage = null) {
  return `data: ${JSON.stringify({
    id: 'cbe9e48c-48ce-4b1a-b0fc-01249be1621c',
    object: 'chat.completion.chunk',
    created: 1792614666,
    model: 'deepseek-flash',
    system_fingerprint: 'e72d3c7f663d3e1383b00b3884cb4501',
    choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }],
    usage,
  })}\n\n`;
}

const ROLE = chunk({ role: 'assistant', content: '' });
const TEXT = (content: string) => chunk({ content });
const FINISH = (reason: string) =>
  chunk({ content: '' }, reason, {
    prompt_tokens: 15,
    completion_tokens: 3,
    total_tokens: 18,
  } as never);
const STOP = FINISH('stop');
const DONE = 'data: [DONE]\n\n';
const KEEP_ALIVE = ': keep-alive\n\n';

type UpstreamControls = {
  stream: ReadableStream<Uint8Array>;
  push(chunk: string): void;
  close(): void;
  fail(error: unknown): void;
  cancelled(): boolean;
};

// A fake DeepSeek SSE stream the test drives chunk by chunk.
function fakeUpstream(initial: string[] = []): UpstreamControls {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      for (const piece of initial) c.enqueue(encoder.encode(piece));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    stream,
    push: (piece) => controller.enqueue(encoder.encode(piece)),
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

describe('parseStreamChunk', () => {
  test('text, finish reason, or both from one chunk', () => {
    expect(
      parseStreamChunk({ choices: [{ delta: { content: 'hi' }, finish_reason: null }] }),
    ).toEqual([{ kind: 'text', text: 'hi' }]);
    expect(
      parseStreamChunk({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] }),
    ).toEqual([{ kind: 'finish', reason: 'stop' }]);
    expect(
      parseStreamChunk({ choices: [{ delta: { content: '!' }, finish_reason: 'length' }] }),
    ).toEqual([
      { kind: 'text', text: '!' },
      { kind: 'finish', reason: 'length' },
    ]);
  });

  test('an error payload becomes an error signal', () => {
    expect(parseStreamChunk({ error: { message: 'Insufficient Balance' } })).toEqual([
      { kind: 'error', message: 'Insufficient Balance' },
    ]);
    expect(parseStreamChunk({ error: {} })).toEqual([{ kind: 'error', message: 'upstream error' }]);
  });

  test('role-only, reasoning-only and unknown chunks yield nothing', () => {
    expect(parseStreamChunk({ choices: [{ delta: { role: 'assistant', content: '' } }] })).toEqual(
      [],
    );
    expect(parseStreamChunk({ choices: [{ delta: { reasoning_content: 'hmm' } }] })).toEqual([]);
    expect(parseStreamChunk({ choices: [] })).toEqual([]);
    expect(parseStreamChunk({ choices: [{ delta: { content: 5 } }] })).toEqual([]);
    expect(parseStreamChunk(null)).toEqual([]);
    expect(parseStreamChunk('string')).toEqual([]);
  });
});

describe('parseSseEvent', () => {
  test('reads data: lines, skipping comments and bad JSON; [DONE] is an end signal', () => {
    const raw = [
      ': keep-alive',
      'data: {"choices":[{"delta":{"content":"a"},"finish_reason":null}]}',
      'data: {not json',
      'data: [DONE]',
    ].join('\n');
    expect(parseSseEvent(raw)).toEqual([{ kind: 'text', text: 'a' }, { kind: 'end' }]);
  });
});

// --- reducer --------------------------------------------------------------------

describe('createReplyReducer', () => {
  test('emits deltas and finishes with done + finalText', () => {
    const reply = createReplyReducer();
    expect(reply.push(ROLE)).toEqual([]);
    expect(reply.push(TEXT('Hel'))).toEqual([{ type: 'delta', text: 'Hel' }]);
    expect(reply.push(TEXT('lo'))).toEqual([{ type: 'delta', text: 'lo' }]);
    expect(reply.finished()).toBe(false);
    expect(reply.push(STOP)).toEqual([]);
    expect(reply.finished()).toBe(true);
    expect(reply.failure()).toBeNull();
    expect(reply.finish()).toEqual({ type: 'done', finalText: 'Hello' });
  });

  test('reassembles chunks split mid-line and mid-JSON', () => {
    const reply = createReplyReducer();
    const whole = TEXT('split') + STOP;
    const out = [
      ...reply.push(whole.slice(0, 17)),
      ...reply.push(whole.slice(17, 140)),
      ...reply.push(whole.slice(140)),
    ];
    expect(out).toEqual([{ type: 'delta', text: 'split' }]);
    expect(reply.finish()).toEqual({ type: 'done', finalText: 'split' });
  });

  test('keep-alive comments are ignored', () => {
    const reply = createReplyReducer();
    expect(reply.push(KEEP_ALIVE + KEEP_ALIVE)).toEqual([]);
    reply.push(TEXT('ok') + STOP);
    expect(reply.finish()).toEqual({ type: 'done', finalText: 'ok' });
  });

  test('finish_reason "length" → incomplete error, no done', () => {
    const reply = createReplyReducer();
    reply.push(TEXT('a long answ') + FINISH('length'));
    expect(reply.failure()).toEqual({ code: 'incomplete', detail: 'finish_reason: length' });
    expect(reply.finish()).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.incomplete,
      code: 'incomplete',
    });
  });

  test('any other finish reason (content_filter, insufficient_system_resource) → failed', () => {
    for (const reason of ['content_filter', 'insufficient_system_resource']) {
      const reply = createReplyReducer();
      reply.push(FINISH(reason));
      expect(reply.failure()).toEqual({ code: 'failed', detail: `finish_reason: ${reason}` });
      expect(reply.finish()).toMatchObject({ type: 'error', code: 'failed' });
    }
  });

  test('an error payload mid-stream → failed', () => {
    const reply = createReplyReducer();
    reply.push(TEXT('partial'));
    reply.push(`data: ${JSON.stringify({ error: { message: 'upstream exploded' } })}\n\n`);
    expect(reply.failure()).toEqual({ code: 'failed', detail: 'upstream exploded' });
    expect(reply.finish()).toMatchObject({ type: 'error', code: 'failed' });
  });

  test('[DONE] without a finish reason → disconnected', () => {
    const reply = createReplyReducer();
    reply.push(TEXT('half') + DONE);
    expect(reply.finished()).toBe(true);
    expect(reply.finish()).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.disconnected,
      code: 'disconnected',
    });
  });

  test('[DONE] after stop changes nothing', () => {
    const reply = createReplyReducer();
    reply.push(TEXT('fine') + STOP + DONE);
    expect(reply.finish()).toEqual({ type: 'done', finalText: 'fine' });
  });

  test('stream ending with no terminal signal → disconnected, never done', () => {
    const reply = createReplyReducer();
    reply.push(ROLE + TEXT('half a rep'));
    expect(reply.finished()).toBe(false);
    expect(reply.finish()).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.disconnected,
      code: 'disconnected',
    });
  });

  test('stops consuming events after a terminal one', () => {
    const reply = createReplyReducer();
    const out = reply.push(TEXT('a') + STOP + TEXT('b'));
    expect(out).toEqual([{ type: 'delta', text: 'a' }]);
    expect(reply.finish()).toEqual({ type: 'done', finalText: 'a' });
  });
});

// --- stream wrapper ---------------------------------------------------------------

describe('createEveNdjsonStream', () => {
  test('a healthy upstream yields deltas then exactly one done', async () => {
    const upstream = fakeUpstream([ROLE, TEXT('Hello'), TEXT(', world'), STOP, DONE]);
    upstream.close();
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ', world' },
      { type: 'done', finalText: 'Hello, world' },
    ]);
  });

  test('a role-only first chunk does not stall the consumer', async () => {
    // The opening chunk carries no text; a pull that enqueues nothing would hang.
    const upstream = fakeUpstream([ROLE]);
    const reader = createEveNdjsonStream(upstream.stream).getReader();
    const pending = reader.read();
    upstream.push(KEEP_ALIVE);
    upstream.push(TEXT('hi'));
    const { value } = await pending;
    expect(JSON.parse(new TextDecoder().decode(value))).toEqual({ type: 'delta', text: 'hi' });
    await reader.cancel();
  });

  test('stops reading once the reply finishes, even if the upstream stays open', async () => {
    const upstream = fakeUpstream([ROLE, TEXT('done early'), STOP]);
    // Deliberately NOT closed and no [DONE]: the wrapper must finish on its own.
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events.at(-1)).toEqual({ type: 'done', finalText: 'done early' });
    expect(upstream.cancelled()).toBe(true);
  });

  test('a content_filter finish → one error event, no done, onFailure called', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([TEXT('partial'), FINISH('content_filter')]);
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, { onFailure: (f) => failures.push(f) }),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'partial' },
      { type: 'error', message: EVE_STREAM_MESSAGES.failed, code: 'failed' },
    ]);
    expect(failures).toEqual([{ code: 'failed', detail: 'finish_reason: content_filter' }]);
  });

  test('a length finish → incomplete error, no done', async () => {
    const upstream = fakeUpstream([TEXT('long'), FINISH('length')]);
    const events = await readNdjson(createEveNdjsonStream(upstream.stream));
    expect(events.at(-1)).toEqual({
      type: 'error',
      message: EVE_STREAM_MESSAGES.incomplete,
      code: 'incomplete',
    });
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  test('upstream closing early → disconnected error, no done', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([ROLE, TEXT('cut')]);
    upstream.close();
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, { onFailure: (f) => failures.push(f) }),
    );
    expect(events).toEqual([
      { type: 'delta', text: 'cut' },
      { type: 'error', message: EVE_STREAM_MESSAGES.disconnected, code: 'disconnected' },
    ]);
    expect(failures).toHaveLength(1);
  });

  test('an upstream read error → disconnected error and onFailure gets the cause', async () => {
    const seen: Array<{ failure: unknown; error: unknown }> = [];
    const upstream = fakeUpstream([TEXT('a')]);
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

  test('an upstream that goes quiet → timeout error after the idle limit', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([ROLE, TEXT('thinking...')]);
    // Never closed, never sends again.
    const started = Date.now();
    const events = await readNdjson(
      createEveNdjsonStream(upstream.stream, {
        idleTimeoutMs: 30,
        onFailure: (f) => failures.push(f),
      }),
    );
    expect(Date.now() - started).toBeLessThan(2000);
    expect(events).toEqual([
      { type: 'delta', text: 'thinking...' },
      { type: 'error', message: EVE_STREAM_MESSAGES.timeout, code: 'timeout' },
    ]);
    expect(failures).toEqual([{ code: 'timeout', detail: 'upstream stalled' }]);
    expect(upstream.cancelled()).toBe(true);
  });

  test('a trickling upstream is cut off by the total limit', async () => {
    const failures: unknown[] = [];
    const upstream = fakeUpstream([ROLE]);
    // A token every 10ms keeps the idle timer happy forever.
    const drip = setInterval(() => upstream.push(TEXT('.')), 10);
    try {
      const events = await readNdjson(
        createEveNdjsonStream(upstream.stream, {
          idleTimeoutMs: 1000,
          totalTimeoutMs: 80,
          onFailure: (f) => failures.push(f),
        }),
      );
      expect(events.at(-1)).toEqual({
        type: 'error',
        message: EVE_STREAM_MESSAGES.timeout,
        code: 'timeout',
      });
      expect(events.filter((e) => e.type === 'delta').length).toBeGreaterThan(0);
      expect(failures).toHaveLength(1);
    } finally {
      clearInterval(drip);
    }
  });

  test('cancelling the client stream cancels the upstream reader', async () => {
    const upstream = fakeUpstream([ROLE, TEXT('a')]);
    const stream = createEveNdjsonStream(upstream.stream);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(upstream.cancelled()).toBe(true);
  });

  test('aborting while a read is pending is not reported as a failure', async () => {
    // Regression: the abort cancels the upstream, the pending read then sees EOF,
    // and that EOF used to be reported as a dropped connection.
    const failures: unknown[] = [];
    const abort = new AbortController();
    const upstream = fakeUpstream([TEXT('a')]);
    const reader = createEveNdjsonStream(upstream.stream, {
      signal: abort.signal,
      onFailure: (f) => failures.push(f),
    }).getReader();
    expect((await reader.read()).done).toBe(false);
    const pending = reader.read(); // waiting on the upstream
    abort.abort();
    expect(upstream.cancelled()).toBe(true);
    // Drain whatever the wrapper emits after the abort.
    for (let r = await pending; !r.done; r = await reader.read()) {
      // keep reading until closed
    }
    expect(failures).toEqual([]);
  });

  test('a timeout after the visitor left is not reported either', async () => {
    const failures: unknown[] = [];
    const abort = new AbortController();
    abort.abort();
    const upstream = fakeUpstream([]);
    await readNdjson(
      createEveNdjsonStream(upstream.stream, {
        signal: abort.signal,
        idleTimeoutMs: 20,
        onFailure: (f) => failures.push(f),
      }),
    );
    expect(failures).toEqual([]);
  });
});
