<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guide for AI coding agents

Everything below is maintained by hand; the block above is managed by `next dev`.

## What this is

chrisleebergstrom.com: a Next.js 16 App Router personal site with a per-request nonce CSP and EVE, a streaming chat concierge on DeepSeek. Human-readable docs: `README.md`, `docs/DEVELOPMENT.md` (conventions, EVE internals, CSP rules), `docs/CSP-AND-NEXTJS-ROADMAP.md` (why the CSP is built this way and the gotchas).

## Commands (Bun 1.4.3, see `.bun-version`)

```bash
bun run check       # biome ci — lint + format, what CI runs (bun run lint:fix to fix)
bun run typecheck   # tsc --noEmit
bun run test        # bun test tests/unit tests/integration
bun run test:e2e    # Playwright + axe against a production build (PLAYWRIGHT_SKIP_BUILD=1 to reuse .next)
bun run build       # must pass before a PR
```

All four checks run in CI on every push and PR to `main`. Run them before declaring work done.

## Conventions

- Routes are `async` server components in `app/<route>/page.tsx`; interactive parts go in a sibling `'use client'` component. `<Reveal>` is the only animation wrapper, so sections stay server components. The home sections are rendered from `app/page.tsx` as children of `IndexClient`; never import them into `IndexClient` (that pulls them into the client bundle).
- Reuse the shared components: `PageHero`, `PageCta`, `SectionHeading`, `DetailRow`, `ProjectCard`, `SocialLinks`. Project records live in `lib/projects.ts`, contact details in `lib/site.ts`, the share image in `app/og-image.ts`.
- Import with `@/`. Theme tokens are in `styles/global.css` (`@theme`: `mauve`, `cream`, …); use the Tailwind utilities, and `lib/theme.ts` only for canvas and motion values.
- `lib/` is pure logic (no Next, Sentry, `window` or `process.env`) with a test in `tests/unit/`. Keep it that way; put new logic there, not in route handlers.
- A new page needs `metadata` (with `openGraph.images: OG_IMAGES`), nonced JSON-LD, `<main id="main-content" tabIndex={-1}>` with exactly one `h1`, and an entry in `app/sitemap.ts` (the e2e suite reads its routes from there).
- Biome formats: single quotes, semicolons, trailing commas, 100 columns.

## CSP rules (non-negotiable)

- Never add an inline `<script>` without the nonce: `const nonce = (await headers()).get('x-nonce') ?? undefined;` then `nonce={nonce}`. `'strict-dynamic'` blocks unnonced tags.
- Never add `<style>` tags or libraries that inject styles at runtime (`style-src-elem` is `'self'`). Prefer theme classes over `style={{}}` attributes; add inline styles only for values that genuinely must be dynamic.
- Don't make routes static (`force-static`, `revalidate`, `generateStaticParams`); every route is `force-dynamic` so framework scripts carry the request's nonce.
- A new third-party host needs an entry in `buildCspHeader` (`lib/proxy-security.ts`) plus a unit test. Sentry needs none (it tunnels via `/monitoring`).
- Non-CSP security headers live in `next.config.js`; don't move them.
- Don't add paths to the matcher exclusions in `proxy.ts`. Exclusions are prefix matches (excluding `robots.txt` would also skip `/robots.txt-anything`, whose HTML 404 would then ship without a CSP); only `/_next/static/…` and exactly `/_next/image` are excluded (`'/((?!_next/static/|_next/image$).*)'`), and a CSP header on a plain file is harmless. Never exempt requests by a header such as `next-router-prefetch`: clients control headers, so that would let a blocked IP skip the blocklist.

## EVE

- The system prompt has two layers, composed per request by `composeSystemPrompt` (`lib/eve-prompt.ts`): `EVE_PERSONA` (same file: identity, rules, the "what you never discuss" list, style) and the **brief** (what Chris is building, dated). The brief is Markdown: `content/eve/brief.md` is the committed fallback, and `app/api/chat/brief.ts` fetches the live copy from the private `Nxtvanhalen/eve-brief` repo when `EVE_BRIEF_TOKEN` is set (cache in `lib/eve-brief.ts`: 10-minute TTL, stale-while-revalidate, ETag, last good copy on failure). Edit facts in the brief, not the persona; project facts in the persona would drift from the brief. Both layers are public by construction: nothing internal, unreleased, client- or employer-related goes in either.
- Model, caps and timeouts: `EVE_MODEL` (DeepSeek `deepseek-flash`, thinking disabled), `MAX_OUTPUT_TOKENS`, `CONNECT_TIMEOUT_MS` and the rate limiter options in `app/api/chat/route.ts`; brief TTL/retry/timeout in `app/api/chat/brief.ts`.
- The model is stateless: the client resends recent turns, and `trimHistory` (`lib/eve-validation.ts`) caps them on both sides (`MAX_HISTORY_MESSAGES`, `MAX_HISTORY_CHARS`). Request validation (`EVE_CONTEXTS` allowlist, size checks) is in the same file; the NDJSON stream protocol and the idle/total stream timeouts in `lib/eve-stream.ts`; localStorage keys in `lib/eve-storage.ts`. Change the stored shape → bump the key suffix and add the old key to `LEGACY_STORAGE_KEYS`.
- Page context: every `app/*/page.tsx` renders `<ChatContextSetter context="…">` right after `<Header />`; a new page needs one and its name added to `EVE_CONTEXTS`.
- Changing the model provider means updating the privacy policy (`app/privacy/page.tsx`), which names where chat messages go.
- Tests mock `/api/chat`; never add a test that calls DeepSeek or GitHub (the integration suite unsets `EVE_BRIEF_TOKEN`).

## Secrets, privacy, assets

- Never commit `.env*` files or paste keys into code or docs; `.env.example` is the only tracked env file and holds no values. Secrets are `DEEPSEEK_API_KEY`, `SENTRY_AUTH_TOKEN` and `EVE_BRIEF_TOKEN`; the Sentry DSN, GA id and Plausible URL are public on purpose.
- Keep Sentry's `dataCollection` in `sentry.shared.ts` restrictive: no request bodies, cookies or IPs. Visitor chat messages must never be logged or reported.
- Everything in `public/` must be referenced from code, or removed. Strip EXIF metadata (GPS especially) from any image before adding it; no `.heic`/`.heif` originals.
- Don't touch `public/sw.js` except to delete it after 2027-03.

## Workflow

- Don't commit or push unless asked; never commit the generated `next-env.d.ts`.
- Deploys are manual on Render (auto-deploy is off). `CSP_REPORT_ONLY=true` is the safe way to roll out a CSP change.
