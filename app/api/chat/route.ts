import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { composeSystemPrompt } from '@/lib/eve-prompt';
import { createRateLimiter } from '@/lib/eve-rate-limit';
import { createEveNdjsonStream } from '@/lib/eve-stream';
import {
  BodyTooLargeError,
  isJsonContentType,
  isSameOriginRequest,
  MAX_BODY_BYTES,
  parseChatRequest,
  readTextWithLimit,
} from '@/lib/eve-validation';
import { getClientIp } from '@/lib/proxy-security';
import { getEveBrief } from './brief';

// DeepSeek V4.1 Flash, in non-thinking mode (see `thinking` below): the fast,
// cheap tier, which is all a site concierge needs.
const EVE_MODEL = 'deepseek-flash';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
// Upper bound on reply length. EVE leads with the answer and keeps it short;
// ~800 tokens is several paragraphs, so normal replies never hit it while a
// runaway one is capped. The client shows a "cut off" note if it does.
const MAX_OUTPUT_TOKENS = 800;
// How long DeepSeek gets to start answering (response headers). Once tokens
// flow, the idle/total limits in lib/eve-stream.ts take over.
const CONNECT_TIMEOUT_MS = 20_000;

// One limiter per server instance. 20/min per IP keeps a single visitor from
// hammering the model; 300/hour overall bounds the DeepSeek bill if traffic is
// spread across many addresses (bots, VPN pools).
const chatLimiter = createRateLimiter({
  perIpLimit: 20,
  perIpWindowMs: 60_000,
  globalLimit: 300,
  globalWindowMs: 60 * 60_000,
  maxEntries: 1000,
});

class ClientError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

const GENERIC_UNAVAILABLE = 'EVE is temporarily unavailable. Please try again shortly.';

function errorResponse(error: ClientError) {
  return NextResponse.json(
    { error: error.message, success: false },
    { status: error.statusCode, headers: { ...noStoreHeaders, ...error.headers } },
  );
}

export async function POST(request: Request) {
  try {
    // Cheapest checks first: anything cross-site or not JSON is refused before
    // we spend a rate-limit slot or read the body.
    if (!isSameOriginRequest(request.headers)) {
      throw new ClientError('Cross-site requests are not allowed', 403);
    }
    if (!isJsonContentType(request.headers.get('content-type'))) {
      throw new ClientError('Content-Type must be application/json', 415);
    }

    const verdict = chatLimiter.check(getClientIp(request.headers));
    if (!verdict.allowed) {
      throw new ClientError('Rate limit exceeded. Please try again later.', 429, {
        'Retry-After': String(Math.max(1, Math.ceil(verdict.retryAfterMs / 1000))),
      });
    }

    // Content-Length is a hint (chunked bodies omit it); readTextWithLimit is
    // the check that actually bounds what we buffer.
    const declaredLength = Number(request.headers.get('content-length'));
    if (declaredLength > MAX_BODY_BYTES) {
      throw new ClientError('Request body too large', 413);
    }
    let rawBody: string;
    try {
      rawBody = await readTextWithLimit(request.body, MAX_BODY_BYTES);
    } catch (error: unknown) {
      if (error instanceof BodyTooLargeError) {
        throw new ClientError('Request body too large', 413);
      }
      throw error;
    }

    const parsed = parseChatRequest(rawBody);
    if (!parsed.ok) {
      throw new ClientError(parsed.error);
    }
    const { messages, context } = parsed.value;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // Server misconfiguration, not a visitor mistake: page Chris, tell the
      // visitor nothing specific.
      Sentry.captureException(new Error('DEEPSEEK_API_KEY is not set; EVE chat is down'));
      return NextResponse.json(
        { error: GENERIC_UNAVAILABLE, success: false },
        { status: 500, headers: noStoreHeaders },
      );
    }

    // Persona (lib/eve-prompt.ts) + today's date + the current brief (cached;
    // only a cold start ever waits on GitHub, see ./brief.ts) + page context.
    const brief = await getEveBrief();
    const systemPrompt = composeSystemPrompt({ brief: brief.text, today: new Date(), context });

    const requestBody = {
      model: EVE_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      // Non-thinking mode: no hidden reasoning tokens, so replies start fast.
      thinking: { type: 'disabled' },
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
    };

    // Tie the upstream call to the inbound request so a visitor closing the
    // panel mid-reply stops us paying for tokens nobody will read, and give up
    // if DeepSeek doesn't start answering in time. The connect timer is cleared
    // once a successful response arrives, so it never cuts a streaming reply
    // short, but it still bounds reading an error body.
    const connect = new AbortController();
    const connectTimer = setTimeout(() => connect.abort(), CONNECT_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(DEEPSEEK_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.any([request.signal, connect.signal]),
      });
    } catch (error: unknown) {
      if (connect.signal.aborted && !request.signal.aborted) {
        console.error(`DeepSeek did not respond within ${CONNECT_TIMEOUT_MS}ms`);
        Sentry.captureMessage('DeepSeek connect timeout on EVE chat', 'warning');
        return NextResponse.json(
          { error: GENERIC_UNAVAILABLE, success: false },
          { status: 504, headers: noStoreHeaders },
        );
      }
      clearTimeout(connectTimer);
      throw error;
    }

    if (!upstream.ok || !upstream.body) {
      // Still under the connect timer: a stalled error body is aborted with it.
      const detail = await upstream.text().catch(() => '');
      clearTimeout(connectTimer);
      console.error(
        `DeepSeek API error: ${upstream.status} ${upstream.statusText} ${detail.slice(0, 500)}`,
      );
      // 401 (bad key) and 402 (balance exhausted) need Chris; everything else
      // is a DeepSeek-side hiccup. All get a Sentry issue so a sustained outage
      // is visible, but the visitor just sees "try again".
      Sentry.captureException(new Error(`DeepSeek responded ${upstream.status} to EVE chat`));
      return NextResponse.json(
        { error: GENERIC_UNAVAILABLE, success: false },
        { status: 503, headers: noStoreHeaders },
      );
    }

    clearTimeout(connectTimer);
    const stream = createEveNdjsonStream(upstream.body, {
      signal: request.signal,
      onFailure: (failure, error) => {
        console.error(`EVE reply ${failure.code}: ${failure.detail}`);
        Sentry.captureException(error ?? new Error(`EVE reply ${failure.code}: ${failure.detail}`));
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...noStoreHeaders,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    // Visitor mistakes are answered directly and never reach Sentry.
    if (error instanceof ClientError) {
      return errorResponse(error);
    }

    // The visitor went away before DeepSeek answered; nothing to report.
    if (request.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      return NextResponse.json(
        { error: 'Request cancelled', success: false },
        { status: 499, headers: noStoreHeaders },
      );
    }

    console.error('Chat API error:', error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again later', success: false },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
