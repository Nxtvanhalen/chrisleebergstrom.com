# Development guide

How this codebase is put together and how to change it without breaking the CSP, the tests or EVE. The [README](../README.md) covers setup, scripts and environment variables; [CSP-AND-NEXTJS-ROADMAP.md](CSP-AND-NEXTJS-ROADMAP.md) has the history and the lessons behind the CSP.

## Conventions

- **Server components by default.** Every route is `app/<route>/page.tsx`, an `async` server component that exports `metadata`, reads the nonce and renders `Header`, its content and `Footer`. `'use client'` is reserved for things that need the browser or `motion` directly: `Header` (drawer, scroll state), `PersistentChat` / `ChatPanel`, `CookieConsentLoader` / `CookiePreferencesButton`, `AnalyticsTracker`, `MotionProvider`, `Reveal`, `ProjectCard`, `OffTheClock`, `IndexClient`, `BlogClient`, `FaqClient`, `ArchiveCard`, `PressCard`, `global-error`.
- **`<Reveal>` is the one animation wrapper.** It is the only client boundary a section needs, so sections (`SelectedWork`, `Method`, `History`, `Contact`, `Skills`) and the deep pages stay server components. On the home page `app/page.tsx` passes the sections to `IndexClient` (the client-side hero) as `children`; importing them from `IndexClient` would pull them into the client bundle, server component or not. `on="mount"` for above-the-fold heroes, the default `on="view"` for everything else. Reduced motion is handled site-wide by `MotionProvider` (`MotionConfig reducedMotion="user"`).
- **Shared components** (`components/`): `PageHero` (eyebrow + the page's single `h1` + intro), `PageCta` (closing CTA; also exports the `CTA_PRIMARY` / `CTA_SECONDARY` class strings), `SectionHeading` (`lg` home, `md` about, `sm` sub-sections), `DetailRow` (code | label | detail ledger rows), `ProjectCard` (live-project card fed by `lib/projects.ts`), `SocialLinks` (the single list of social profiles), `EveAvatar`.
- **Imports use `@/`** (`tsconfig.json` maps `@/*` to the repo root).
- **Theme tokens live in `styles/global.css`** under `@theme`: `--color-mauve` (#9370db, the brand violet), `--color-cream` (#f5f5dc, body copy, usually with an opacity such as `text-cream/82`), plus `molten`, `deepOrange`, `charcoal`, `moonlight` and the three font variables. Use the Tailwind utilities (`text-mauve`, `border-mauve/50`, `bg-mauve`). `lib/theme.ts` (`MAUVE`, `mauve(alpha)`) exists only for places CSS can't reach: the canvas in `IndexClient` and motion animation targets.
- **`lib/` is pure logic with tests.** Nothing in `lib/` imports Next, Sentry, `window` or `process.env`; every input is passed in. That is what makes `bun test` fast and the route handlers thin. New logic goes in `lib/` with a test in `tests/unit/`.
- **One record per fact.** Project cards come from `lib/projects.ts` (`FEATURED_PROJECTS` for the home page, `LIVE_PROJECTS` for `/projects`). Contact details from `lib/site.ts` (`CONTACT_EMAIL`, `mailto(subject)`). The share image from `app/og-image.ts`.
- **Biome** formats and lints (`bun run check` is what CI runs; `bun run lint:fix` to fix). Single quotes, semicolons, trailing commas, 100-column lines.

## Adding a page

1. Create `app/<route>/page.tsx` as an `async` server component. Export `metadata` with `title`, `description`, `alternates.canonical` and an `openGraph` block that includes `images: OG_IMAGES` (Next shallow-merges metadata, so a page that sets `openGraph` without `images` loses the site-wide share image).
2. Read the nonce and attach it to the page's JSON-LD:

   ```tsx
   const nonce = (await headers()).get('x-nonce') ?? undefined;
   <script
     type="application/ld+json"
     nonce={nonce}
     suppressHydrationWarning
     dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
   />
   ```

3. Render `<Header />`, then `<main id="main-content" tabIndex={-1} aria-label="…">` with exactly one `h1` (normally via `PageHero`), then `<Footer />`. The e2e suite asserts the single `h1` and the `main#main-content` landmark.
4. Add the route to `app/sitemap.ts` (an entry plus a date in `LAST_MODIFIED`). The e2e suite derives its route list from the sitemap, so the new page is automatically checked for a 200, the CSP header, console violations, hydration errors and axe.
5. If it belongs in the menu, add it to `NAV_LINKS` in `components/Header.tsx`. If visitors should be able to ask EVE about it, update the site map in her prompt (see below).
6. Interactive pieces go in a sibling `'use client'` component (`BlogClient.tsx`, `FaqClient.tsx` are the pattern), never in `page.tsx`.

## How EVE works

- **Prompt.** `EVE_SYSTEM_PROMPT` in `app/api/chat/route.ts`, sent per request as `instructions`. It must only describe public work; the "public scope standing rule" in the prompt forbids discussing internal, unreleased or employer-related work, and anything added to the prompt has to respect that. `EVE_MODEL` is `gpt-5-nano-2025-08-07`, `reasoning.effort` is `minimal`, `MAX_OUTPUT_TOKENS` is 800.
- **Request** (`lib/eve-validation.ts`). The client POSTs `{ prompt, previousResponseId?, context? }`. The route refuses cross-site requests (403, `Sec-Fetch-Site` or `Origin` vs `Host`), non-JSON bodies (415), bodies over `MAX_BODY_BYTES` = 16 KB (413, enforced while reading, not just from `Content-Length`), and messages that are empty or over `MAX_MESSAGE_CHARS` = 4000 (400). `previousResponseId` must match `RESPONSE_ID_PATTERN` (`resp_…`, at most 128 chars). `context` must be one of `EVE_CONTEXTS` (`'Home'`, `'Projects'`); anything else is dropped so visitor text never reaches the prompt. `ChatContext` defaults to `'Home'`; `app/projects/ArchiveCard.tsx` sets `'Projects'` when a visitor asks EVE about an archived project.
- **Rate limits** (`lib/eve-rate-limit.ts`). 20 requests per minute per IP and 300 per hour per server instance (bounds the OpenAI bill whatever the source). A refusal is a 429 with `Retry-After`. The per-IP map is capped at 1000 entries.
- **Upstream.** `fetch('https://api.openai.com/v1/responses', { stream: true, signal: request.signal })`, so a visitor closing the panel aborts the OpenAI call. A 400/404 that names `previous_response_id` (the stored conversation expired) becomes a 409 with `code: 'stale_conversation'`; the client clears its id and retries once without it. Other upstream failures are a generic 503 and a Sentry issue; a missing `OPENAI_API_KEY` is a 500 and a Sentry issue.
- **Stream protocol** (`lib/eve-stream.ts`). The OpenAI SSE stream is reduced to NDJSON, one JSON object per line:
  - `{ "type": "delta", "text": "…" }` per output-text delta;
  - exactly one terminal line: `{ "type": "done", "responseId": "resp_…", "finalText": "…" }` on `response.completed`, or `{ "type": "error", "message": "…", "code": "failed" | "incomplete" | "disconnected" }` when the reply failed, hit the token cap, or the upstream closed without a terminal event. A failed reply never gets a `done`, so the client never stores an id it can't continue from.
  - Response headers: `Content-Type: application/x-ndjson`, `Cache-Control: no-store`, `X-Accel-Buffering: no`.
- **Client** (`components/ChatPanel.tsx`). Shows raw text with a caret while streaming (partial markdown would flicker), then renders the completed reply with react-markdown + remark-gfm. Tokens are revealed at a steady 40 characters per second unless `prefers-reduced-motion` is set, in which case text appears as it arrives. Errors after some text arrived are shown as a note under the partial reply.
- **Storage** (`lib/eve-storage.ts`, localStorage, every access wrapped in try/catch): `eve_chat_history_v2` (last 50 messages) and `eve_response_id_v2` (`{ id, savedAt }`, discarded after `RESPONSE_ID_TTL_MS` = 7 days, well inside OpenAI's ~30-day retention). The pre-v2 keys in `LEGACY_STORAGE_KEYS` are removed on load. `sessionStorage` `eve_notification_shown_v2` suppresses the one-time nudge.
- **Accessibility.** The panel is a non-modal `role="dialog"` labelled "EVE"; opening it focuses the input, Escape closes it and focus returns to the toggle; completed replies are announced once through an `aria-live="polite"` region.

## CSP rules for contributors

The policy is built in `lib/proxy-security.ts` (`buildCspHeader`) and set by `proxy.ts` on every response except Next's build assets (`/_next/static`, `/_next/image`) and the client router's RSC prefetches (`next-router-prefetch` header). Production: `script-src 'self' 'nonce-…' 'strict-dynamic'` plus the GA and Plausible hosts as a fallback, `style-src-elem 'self'`, `style-src-attr 'unsafe-inline'`, `font-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. Dev adds `'unsafe-eval'` and inline styles for Turbopack HMR.

- **No inline `<script>` without the nonce.** Read it with `(await headers()).get('x-nonce')` in a server component and pass `nonce={nonce}`; an unnonced tag is blocked by `'strict-dynamic'`. Client components never need the nonce: their code is in Next's nonced chunks, and scripts they create at runtime (`document.createElement('script')`, as the GA loader does) are allowed by `'strict-dynamic'`.
- **No `<style>` tags and no runtime style injection.** `style-src-elem` is `'self'` in production. Styles go in `styles/global.css` or Tailwind classes. Libraries that inject `<style>` elements can't be used (that is why the cookie banner is vanilla-cookieconsent, which ships a CSS file).
- **Prefer classes over `style={{}}`.** Inline style attributes are allowed (`style-src-attr 'unsafe-inline'`) and some are necessary: motion animation start values and canvas-adjacent dynamic values. Don't add new ones for static styling.
- **Every route is `force-dynamic`** (`app/layout.tsx`). Don't add `generateStaticParams`, `revalidate` or `export const dynamic = 'force-static'`: a prerendered page ships build-time nonces that won't match the request's CSP, and every script on it is blocked.
- **New third-party hosts need a CSP entry** in the right directive (`script-src`, `connect-src`, `img-src`, …). Sentry doesn't: browser events tunnel through `/monitoring` on our origin.
- **Don't add matcher exclusions in `proxy.ts`.** Exclusions are prefix matches, so excluding `robots.txt` would also skip `/robots.txt-anything`, whose HTML 404 would then ship without a CSP. A CSP header on a plain file is harmless, so only the build assets are excluded.
- **Test it.** `bun run test` covers the header itself; `bun run test:e2e` loads every route under the enforced policy and fails on any `securitypolicyviolation` event or CSP console error. For risky changes deploy with `CSP_REPORT_ONLY=true` first and watch the CSP issues in Sentry.

## Testing workflow

```bash
bun run check        # biome ci
bun run typecheck    # tsc --noEmit
bun run test         # bun test tests/unit tests/integration
bun run test:e2e     # playwright test (builds, starts on port 3100, runs tests/e2e)
```

- `bun test` only looks under `tests/` (`bunfig.toml`); Playwright specs end in `.e2e.ts` so bun never picks them up.
- First e2e run on a machine: `bunx playwright install chromium`. Reuse a build with `PLAYWRIGHT_SKIP_BUILD=1 bun run test:e2e`; change the port with `PLAYWRIGHT_PORT`.
- e2e tests never call OpenAI: `/api/chat` is mocked with `page.route` and `ndjsonReply()` from `tests/e2e/helpers.ts`, which emits exactly what the route streams. `trackPageProblems()` collects CSP violations, hydration errors and uncaught exceptions for a page.
- Integration tests for the chat route replace `globalThis.fetch` and mock `@sentry/nextjs`; the proxy tests set `process.env` and re-import `proxy.ts` per environment variant, and check the matcher with Next's `unstable_doesMiddlewareMatch`.
- Everything above runs in CI (`.github/workflows/ci.yml`) on every push and PR to `main`.

## Monitoring (Sentry)

`instrumentation-client.ts` (browser), `instrumentation.ts` → `sentry.server.config.ts` (Node), `app/global-error.tsx` (React render errors). Shared options in `sentry.shared.ts`: enabled only when `NODE_ENV === 'production'`, 10 % tracing, no Session Replay, and `dataCollection` pinned so no request bodies, cookies, IPs or user info are sent. EVE messages must never reach Sentry; keep it that way. CSP violation reports go to the same project via `report-uri` / `report-to`.

## Assets

- Everything under `public/` must be referenced from code; remove what isn't. Strip EXIF (including GPS) from photos before committing. `.heic` / `.heif` originals are git-ignored on purpose.
- `public/sw.js` is a self-unregistering stub that clears the old service worker's caches in returning browsers. It can be deleted around 2027-03.
- Fonts are self-hosted by `next/font` (Chakra Petch, Newsreader, JetBrains Mono) with only the weights the site renders; adding a weight costs real bytes on every page.

## Deploy checklist

1. CI green on the branch (`check`, `build`, `e2e`).
2. New environment variables set in Render before the deploy (`.env.example` is the list).
3. For a CSP change, `CSP_REPORT_ONLY=true` on the first deploy; remove it once Sentry shows no unexpected reports.
4. Merge to `main`. Auto-deploy is off: trigger the deploy from the Render dashboard or the Render CLI and wait for it to go live.
5. Verify in production: the home page returns `Content-Security-Policy` with `'strict-dynamic'` (`curl -sI https://chrisleebergstrom.com | grep -i content-security`), the pages load without console errors, EVE answers, Sentry stays quiet.
6. If content on a route changed, bump its date in `app/sitemap.ts`.
