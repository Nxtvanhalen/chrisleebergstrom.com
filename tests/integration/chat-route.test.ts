// Calls the EVE chat route handler directly with hand-built Requests. Nothing
// here reaches OpenAI: globalThis.fetch is replaced for the upstream cases and
// Sentry is mocked so a misconfiguration assertion can see the capture.

import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const captureException = mock((_error: unknown) => 'mock-event-id');
mock.module('@sentry/nextjs', () => ({ captureException }));

type ChatPost = typeof import('../../app/api/chat/route').POST;
let POST: ChatPost;

beforeAll(async () => {
  ({ POST } = await import('../../app/api/chat/route'));
});

// The route keeps one in-memory limiter per process (20/min per IP), so every
// test gets its own client address unless it is deliberately sharing one.
let ipCounter = 0;
function freshIp(): string {
  ipCounter++;
  return `198.51.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

type RequestOptions = {
  body?: BodyInit | null;
  headers?: Record<string, string>;
  ip?: string;
};

function chatRequest({ body, headers = {}, ip = freshIp() }: RequestOptions = {}): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': ip,
      ...headers,
    },
    body: body === undefined ? JSON.stringify({ prompt: 'Who is Chris?' }) : body,
  });
}

function sse(type: string, payload: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

type FetchCall = { url: string; init: RequestInit | undefined };

// Replaces fetch for the duration of a test and records every call.
function stubFetch(respond: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return calls;
}

const realFetch = globalThis.fetch;
const realApiKey = process.env.OPENAI_API_KEY;

beforeEach(() => {
  captureException.mockClear();
  process.env.OPENAI_API_KEY = 'sk-test-placeholder';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = realApiKey;
});

describe('POST /api/chat — request validation', () => {
  test('cross-site requests are refused with 403 before anything else', async () => {
    const calls = stubFetch(() => new Response('unreachable', { status: 500 }));
    const res = await POST(chatRequest({ headers: { 'sec-fetch-site': 'cross-site' } }));
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    await expect(res.json()).resolves.toEqual({
      error: 'Cross-site requests are not allowed',
      success: false,
    });
    expect(calls).toHaveLength(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  test('a mismatched Origin (legacy browser path) is refused with 403', async () => {
    const res = await POST(
      chatRequest({
        headers: { 'sec-fetch-site': '', origin: 'https://evil.example', host: 'localhost' },
      }),
    );
    expect(res.status).toBe(403);
  });

  test('non-JSON content types get 415', async () => {
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded']) {
      const res = await POST(chatRequest({ headers: { 'content-type': contentType } }));
      expect(res.status).toBe(415);
      await expect(res.json()).resolves.toMatchObject({ success: false });
    }
  });

  test('a declared Content-Length over the cap gets 413 without reading the body', async () => {
    const res = await POST(chatRequest({ headers: { 'content-length': String(16 * 1024 + 1) } }));
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({
      error: 'Request body too large',
      success: false,
    });
  });

  test('an oversize body gets 413 even when Content-Length lies', async () => {
    // Chunked upload shape: no usable Content-Length, bytes keep coming.
    const chunk = new TextEncoder().encode('x'.repeat(4096));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 8) {
          controller.close();
          return;
        }
        sent++;
        controller.enqueue(chunk);
      },
    });
    const res = await POST(chatRequest({ body, headers: { 'content-length': '10' } }));
    expect(res.status).toBe(413);
  });

  test('malformed JSON gets 400 with the parser message', async () => {
    const res = await POST(chatRequest({ body: '{"prompt": ' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Request body must be valid JSON',
      success: false,
    });
  });

  test('an empty prompt gets 400', async () => {
    const res = await POST(chatRequest({ body: JSON.stringify({ prompt: '   ' }) }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'User message cannot be empty' });
  });

  test('a malformed previousResponseId gets 400 and never reaches OpenAI', async () => {
    const calls = stubFetch(() => new Response('unreachable', { status: 500 }));
    const res = await POST(
      chatRequest({ body: JSON.stringify({ prompt: 'hi', previousResponseId: 'not-an-id' }) }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Previous response ID is malformed',
    });
    expect(calls).toHaveLength(0);
  });

  test('the 21st request in a minute from one IP gets 429 with Retry-After', async () => {
    const ip = freshIp();
    // Invalid bodies still spend a rate-limit slot (the limiter runs before the body read).
    for (let i = 0; i < 20; i++) {
      const res = await POST(chatRequest({ ip, body: 'nope' }));
      expect(res.status).toBe(400);
    }
    const res = await POST(chatRequest({ ip, body: 'nope' }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(60);
    await expect(res.json()).resolves.toMatchObject({ success: false });
    // Another address is unaffected.
    const other = await POST(chatRequest({ body: 'nope' }));
    expect(other.status).toBe(400);
  });
});

describe('POST /api/chat — upstream handling', () => {
  test('missing OPENAI_API_KEY → generic 500, Sentry paged, OpenAI never called', async () => {
    delete process.env.OPENAI_API_KEY;
    const calls = stubFetch(() => new Response('unreachable', { status: 500 }));
    const res = await POST(chatRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: 'EVE is temporarily unavailable. Please try again shortly.',
      success: false,
    });
    expect(JSON.stringify(body)).not.toMatch(/OPENAI|key/i);
    expect(calls).toHaveLength(0);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(String(captureException.mock.calls[0][0])).toContain('OPENAI_API_KEY');
  });

  test('a stale previous_response_id upstream error → 409 stale_conversation', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Previous response with id 'resp_old' not found.",
              type: 'invalid_request_error',
              param: 'previous_response_id',
              code: null,
            },
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
    );
    const res = await POST(
      chatRequest({ body: JSON.stringify({ prompt: 'hi', previousResponseId: 'resp_old' }) }),
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: 'That conversation has expired. Please send your message again.',
      success: false,
      code: 'stale_conversation',
    });
    // An expired conversation is a client-side retry, not an incident.
    expect(captureException).not.toHaveBeenCalled();
  });

  test('the same upstream 400 without a previousResponseId is an outage (503)', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: { message: 'bad request', param: null } }), {
          status: 400,
        }),
    );
    const res = await POST(chatRequest());
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: 'EVE is temporarily unavailable. Please try again shortly.',
      success: false,
    });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('an upstream 5xx → generic 503 and a Sentry issue', async () => {
    stubFetch(() => new Response('upstream down', { status: 502 }));
    const res = await POST(chatRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  test('a healthy upstream is relayed as NDJSON with the right OpenAI request', async () => {
    const upstreamBody =
      sse('response.created', { response: { id: 'resp_live', status: 'in_progress' } }) +
      sse('response.output_text.delta', { delta: 'Chris builds ' }) +
      sse('response.output_text.delta', { delta: 'things.' }) +
      sse('response.completed', { response: { id: 'resp_live', status: 'completed' } });
    const calls = stubFetch(
      () =>
        new Response(upstreamBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
    );

    const res = await POST(
      chatRequest({
        body: JSON.stringify({
          prompt: '  What does Chris do?  ',
          previousResponseId: 'resp_prev',
          context: 'Projects',
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    const events = (await res.text())
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(events).toEqual([
      { type: 'delta', text: 'Chris builds ' },
      { type: 'delta', text: 'things.' },
      { type: 'done', responseId: 'resp_live', finalText: 'Chris builds things.' },
    ]);

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer sk-test-placeholder');
    expect(headers.get('accept')).toBe('text/event-stream');
    const sent = JSON.parse(String(init?.body));
    expect(sent).toMatchObject({
      input: 'What does Chris do?',
      previous_response_id: 'resp_prev',
      stream: true,
    });
    expect(typeof sent.model).toBe('string');
    expect(sent.instructions).toContain('[CURRENT CONTEXT]');
    expect(sent.instructions).toContain('"Projects"');
    expect(captureException).not.toHaveBeenCalled();
  });

  test('without a context the prompt is sent untouched and no previous id is forwarded', async () => {
    const calls = stubFetch(
      () =>
        new Response(
          sse('response.output_text.delta', { delta: 'ok' }) +
            sse('response.completed', { response: { id: 'resp_x' } }),
          { status: 200 },
        ),
    );
    const res = await POST(
      chatRequest({ body: JSON.stringify({ prompt: 'hi', context: 'Evil' }) }),
    );
    expect(res.status).toBe(200);
    await res.text();
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent.instructions).not.toContain('[CURRENT CONTEXT]');
    expect(sent.instructions).not.toContain('Evil');
    expect('previous_response_id' in sent).toBe(false);
  });
});
