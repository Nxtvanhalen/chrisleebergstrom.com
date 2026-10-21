# Security Policy

## Reporting a vulnerability

Please don't open a public issue for security problems. Use either channel:

- GitHub's private vulnerability reporting on this repository (Security tab → "Report a vulnerability"), or
- email chrisleebergstrom@gmail.com with "Security" in the subject line.

Include what you found, how to reproduce it, and what impact you think it has. You'll get an acknowledgement within a few days; fixes for anything real ship as soon as they're ready and you'll be credited if you want to be.

## Scope

- https://chrisleebergstrom.com and the code in this repository: the Next.js app, `proxy.ts` (request filtering and CSP), and the API routes under `app/api/`.

Out of scope:

- The separately hosted projects the site links to (The Underground, Byte, Beacons, Fuel Estimator) — they have their own repositories.
- Third-party services the site uses (Render, Sentry, Plausible, Google Analytics, Substack, DeepSeek).
- Volume-based denial of service, and automated-scanner output without a demonstrated impact.

## What's intentionally public

These identifiers are in the source on purpose and are not secrets:

- The Sentry DSN (`sentry.shared.ts`) and the CSP report endpoint (`lib/proxy-security.ts`). Both are write-only ingest addresses.
- The Google Analytics measurement ID (`components/CookieConsentLoader.tsx`) and the Plausible script URL (`app/layout.tsx`).
- The Google Search Console verification file (`public/google8c87f62b78695236.html`).

Real secrets (`DEEPSEEK_API_KEY`, `SENTRY_AUTH_TOKEN`) live only in the environment; see `.env.example` for the full list of variables the code reads.
