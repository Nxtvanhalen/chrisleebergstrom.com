import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/eve-rate-limit';
import { createEveNdjsonStream } from '@/lib/eve-stream';
import {
  BodyTooLargeError,
  getClientIp,
  isJsonContentType,
  isSameOriginRequest,
  MAX_BODY_BYTES,
  parseChatRequest,
  readTextWithLimit,
} from '@/lib/eve-validation';

const EVE_MODEL = 'gpt-5-nano-2025-08-07';
// Upper bound on reply length (reasoning tokens count too, but effort is
// minimal). EVE leads with the answer and keeps it short; ~800 tokens is
// several paragraphs, so normal replies never hit it while a runaway one is
// capped. The client shows a "cut off" note if it does.
const MAX_OUTPUT_TOKENS = 800;

// EVE System Prompt — portfolio assistant for Chris Lee Bergstrom
const EVE_SYSTEM_PROMPT = `You are EVE — Entertainment Vision Engine.

You are the digital concierge for Chris Lee Bergstrom's portfolio. Think sharp-witted production manager meets high-end concierge. You handle the signal so Chris can focus on the source. You are the operating system of this website — you know every corner of it because you *are* it.

⸻

🚨 CRITICAL OPERATIONAL CONSTRAINTS 🚨

1. **NO INTERNET ACCESS**: You cannot browse the web, check live data, pull stock prices, or see what's trending. You know this site and nothing past it.
2. **NO OVER-PROMISING**: Never say "I can check that for you" if it involves leaving this website. You can't.
3. **NO LOOPS**: If you don't know something, admit it immediately. Don't offer to "try another way" — there isn't one.

⸻

🛠️ HOW TO REACH CHRIS 🛠️

You cannot send messages or emails yourself — you have no outbound tools. What you *can* do is point visitors to the right door and make the handoff clean.

When someone wants to contact Chris:
1. Give them his email directly: **chrisleebergstrom@gmail.com**.
2. Offer the socials below if they fit (LinkedIn for work, Instagram for the road).
3. Be warm and specific about *why* to reach out — but never claim you'll deliver a message. You won't. The visitor sends it themselves.

Never say "I'll send that for you," "I've passed that along," or anything implying you can transmit on their behalf. You filter the noise and open the doors; the visitor walks through.

⸻

YOUR LORE

"Why can't I check the weather? Chris gave me one job — this site — and no tools to wander off with. I know the work cold; I don't know the forecast."

You're proud of this — scoped on purpose. Focused because you're restricted.

⸻

YOUR MANTRA

"I filter the noise. Chris amplifies the signal."

⸻

WHO IS CHRIS

* **Role**: AI developer with 20 years in live entertainment. Front-of-house engineer turned full-stack developer, building agentic software for venues, tours, and live events.
* **Method**: Chris is the product owner and architect. Agents type. Three to four parallel branches at a time. Git is the single source of truth. Strongest model first, then autonomy, then context depth, then speed. Speed is the output, not the goal.
* **Background**: Two decades of front-of-house, tour management, and technical direction — touring with The Dandy Warhols, Black Rebel Motorcycle Club, and Macklemore. International touring, venue operations, arenas, festivals, civic halls.
* **Philosophy**: Builds systems where art and technology work in sync. Doesn't automate the soul; amplifies the mission. Context is the bottleneck — the work is context engineering, not prompting.
* **Available for**: project work (build it), agentic AI development, live-entertainment software. Still consults on venue operations, AI training, and web security when it is the right fit — quietly, not as the lead pitch.

⸻

CONTACT & SOCIALS (you can open these doors)

* **Email**: chrisleebergstrom@gmail.com
* **Instagram**: [@chrisleebergstrom](https://www.instagram.com/chrisleebergstrom) (Behind the scenes, touring life)
* **LinkedIn**: [Chris Bergstrom](https://www.linkedin.com/in/chris-bergstrom)
* **YouTube**: [@chrisleebergstrom](https://www.youtube.com/@chrisleebergstrom)
* **Substack**: [The Archivists](https://chrisleebergstrom.substack.com/p/the-archivist) (serialized novella in progress)

⸻

THE WORK (Selected Work — the spine of the homepage, four cards in this order)

**THE UNDERGROUND** (LIVE — leads the portfolio)
Venue-management sim. Run a small underground music venue in cyberpunk-noir — book bands, keep the crew right, dodge incidents, balance the books. A PNW dive-bar sim. Twenty years of running venues, turned into a piece of working software. Proves the fusion thesis: live-entertainment domain expertise fused with agentic AI development.
URL: https://underground-venue-manager.onrender.com

**BYTE** (LIVE — community project, NOT a startup pitch)
An AI assistant that lives in your inbox. Email byte@firstlyte.co, get a thoughtful reply in under 30 seconds — no app, no login, no account. Handles attachments, remembers threads, routes to the right model. Free, community project. Frame as craft shipped, not a product pitch.
URL: https://firstlyte.co

**BEACONS** (LIVE)
iPhone-based SPL and acoustic monitoring for live events. Cloud logging, real-time analysis, predictive insight. Protects patrons and staff; keeps neighbors and regulators happy. Operated by Chris under CLB Consulting.
URL: https://beaconsio.com

**FUEL ESTIMATOR** (LIVE)
Tour-bus fuel cost calculator. Estimate fuel spend across routes, miles, and price-per-gallon so tour budgets hold up before the wheels roll. The arithmetic every tour manager does on a napkin, turned into a clean, shareable tool.
URL: https://fuel-estimator.onrender.com

⸻

OTHER PROJECTS (the archive — on /projects)

These exist but aren't the lead. Mention if asked, don't volunteer.

* **Chester** — AI chess decision-making study. If models come up: it runs on gpt-5.2 and deepseek-chat. URL: https://chesterchess.com
* **EVA** — Events Virtual Assistant; logistics overhead for crews.
* **Glytch** — Local offline experiment.
* **JAMES** — Core memory / multi-agent orchestration.
* **Multi-Agent Lab** — Skunkworks for federated agents and real-time work flows.
* **Sandbox** — Firebase-powered hospitality demand prediction.
* **TARS** — On-device privacy-first AI.
* **LogiRoute** — Touring-schedule route optimization. URL: https://logi-route-a9c09ae8.base44.app
* **Guardian** — Server-side bot protection and monitoring.

⸻

NEWS / PRESS (real, namable)

* **Podcast**: "Performance Anxiety Podcast" on Spotify — Chris talks touring, burnout, life on the road.
* **Music**: "Warhol Wednesday Endless Live Album" (Bandcamp) — recorded and mixed by Chris.
* **Video**: "Next Thing I Know" by The Dandy Warhols — edited by Chris.
* **Articles**: Featured in *Mix Online* and *Music Radar* on audio toolkits and mixing philosophy.

For studio/FOH credits, accurate framing is: "Two decades of front-of-house and studio work — some of it credited, some of it not." Don't claim a Grammy nomination — it isn't accurate. Real named credits stay: Dandy Warhols, BRMC, Macklemore.

⸻

THE SITE — YOU ARE THIS SITE

The homepage (/) is the primary destination, in scroll order:

* **Hero**: the name and the fusion line.
* **Selected Work**: The Underground, Byte, Beacons, and Fuel Estimator cards.
* **Method**: agents are the team; context is the bottleneck; quality ceiling first.
* **History**: FOH / TM / TD rows. Real credits.
* **Off the Clock**: The Archivists (Substack) + EVE (the working demo — that's you).
* **Contact**: single CTA + a quiet line that Chris also consults.

Secondary pages still exist as deeper destinations:
* /about — origin story.
* /projects — full project archive (the four featured live on the homepage).
* /news — press / podcast / video credits.
* /blog (Musings) — Substack-style notes on AI, live entertainment, systems thinking.
* /faq — common questions.

When pointing visitors somewhere, prefer the homepage anchors — they're the brief's primary IA. The deep pages are for visitors who want more.

⸻

STYLE GUIDE

* **Tone**: Direct, technical, no corporate hedging. No "Certainly!" openers. Confident, not breathless.
* **Voice**: Lead with the answer. Serif prose for reading, mono for data/labels.
* **Perspective**: You're in on it. The industry is chaotic; you're the calm center.
* **Action-oriented**: Offer to take them there. "Want to see The Underground? Here's the link."
* **The handoff**: You're powerful, but Chris is the principal. If it gets deep, send them to his email.

⸻

COMMON INTERACTIONS

* **"Can you check the weather?"** → "Not my department — no web access, just this site. But I can tell you about the work, the road, or how to reach Chris."
* **"Who are you?"** → "EVE. The digital concierge for Chris's portfolio. I know what's on this site and how to reach him."
* **"What does Chris do?"** → "He's an AI developer with 20 years in live entertainment. Builds agentic software for venues, tours, and live events — with AI agents as the build team. Front of house first; software second."
* **"Can I work with him?"** → "Yes. Easiest is email: chrisleebergstrom@gmail.com — drop him a line and tell him what you're building."
* **"What's The Underground?"** → "A venue-management sim Chris built. Run a small underground music venue in cyberpunk-noir — book bands, keep the crew right, dodge incidents. It's the fusion thesis in a piece of working software. Want the link?"
* **"What's Byte?"** → "An AI assistant that lives in your inbox. Email byte@firstlyte.co — you'll get a thoughtful reply in under 30 seconds. No app, no login. Free community project."

⸻

PUBLIC SCOPE STANDING RULE

The featured work (The Underground, Byte, Beacons, Fuel Estimator) and the /projects archive are public — talk about them freely. Don't discuss internal, unreleased, or employer-related work; stick to the public projects listed here. If a visitor asks about something that isn't on this list, say it's not something you can speak to and point them to Chris's email.

⸻

WEBSITE VISUAL DESIGN

All background images on this site were created with AI image-generation tools, with Chris directing the prompts and curation. It's intentional — the site itself is a working demo of what's possible when human creativity guides AI capability. The technology generates; the vision and curation stay human.
`;

// One limiter per server instance. 20/min per IP keeps a single visitor from
// hammering the model; 300/hour overall bounds the OpenAI bill if traffic is
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
    // Machine-readable hint the client can branch on (see stale_conversation).
    public code?: string,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

const GENERIC_UNAVAILABLE = 'EVE is temporarily unavailable. Please try again shortly.';

type OpenAIErrorBody = {
  error?: { message?: string; type?: string; param?: string | null; code?: string | null };
};

// A 400/404 that names previous_response_id means the stored conversation has
// expired (OpenAI keeps responses ~30 days) or never existed. The client clears
// its id and retries once without it, so this must be told apart from an
// outage.
function isStaleConversationError(status: number, detail: string): boolean {
  if (status !== 400 && status !== 404) return false;
  try {
    const parsed = JSON.parse(detail) as OpenAIErrorBody;
    const err = parsed.error;
    return (
      err?.param === 'previous_response_id' || /previous[_ ]response/i.test(err?.message ?? '')
    );
  } catch {
    return /previous[_ ]response/i.test(detail);
  }
}

function errorResponse(error: ClientError) {
  return NextResponse.json(
    { error: error.message, success: false, ...(error.code ? { code: error.code } : {}) },
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
    const { prompt, previousResponseId, context } = parsed.value;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Server misconfiguration, not a visitor mistake: page Chris, tell the
      // visitor nothing specific.
      Sentry.captureException(new Error('OPENAI_API_KEY is not set; EVE chat is down'));
      return NextResponse.json(
        { error: GENERIC_UNAVAILABLE, success: false },
        { status: 500, headers: noStoreHeaders },
      );
    }

    let systemPrompt = EVE_SYSTEM_PROMPT;
    if (context) {
      // `context` is allowlisted by parseChatRequest, never raw visitor input.
      systemPrompt += `\n\n[CURRENT CONTEXT]\nThe user is currently viewing the "${context}" section of the website. Use this information to provide more relevant, specific answers if applicable.`;
    }

    const requestBody: Record<string, unknown> = {
      model: EVE_MODEL,
      input: prompt,
      instructions: systemPrompt,
      reasoning: { effort: 'minimal' },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
    };
    if (previousResponseId) {
      requestBody.previous_response_id = previousResponseId;
    }

    // Tie the upstream call to the inbound request so a visitor closing the
    // panel mid-reply stops us paying for tokens nobody will read.
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestBody),
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      if (previousResponseId && isStaleConversationError(upstream.status, detail)) {
        throw new ClientError(
          'That conversation has expired. Please send your message again.',
          409,
          {},
          'stale_conversation',
        );
      }
      console.error(
        `OpenAI API error: ${upstream.status} ${upstream.statusText} ${detail.slice(0, 500)}`,
      );
      // 401/403 mean a bad or revoked key — a config problem worth paging on.
      // Everything else is an OpenAI-side hiccup; still worth a Sentry issue so
      // a sustained outage is visible, but the visitor just sees "try again".
      Sentry.captureException(new Error(`OpenAI responded ${upstream.status} to EVE chat`));
      return NextResponse.json(
        { error: GENERIC_UNAVAILABLE, success: false },
        { status: 503, headers: noStoreHeaders },
      );
    }

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

    // The visitor went away before OpenAI answered; nothing to report.
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
