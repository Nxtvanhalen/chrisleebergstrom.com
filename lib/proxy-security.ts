/**
 * Pure helpers behind proxy.ts: request filtering and the Content-Security-Policy.
 *
 * Nothing here touches Next.js, the network, or process.env — every input is passed in —
 * so these functions can be unit-tested with `bun test` without booting the framework.
 */

/**
 * Crawlers that skip the user-agent heuristics (BLOCKED_USER_AGENTS and the fake-mobile
 * check). They never skip the IP blocklist, the scanner-path check, or the CSP: anyone can
 * put "Googlebot" in a User-Agent string, so the allowlist must not open anything that
 * matters.
 */
export const ALLOWED_USER_AGENTS: readonly string[] = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'Claude-Web',
  'ChatGPT-User',
  'anthropic-ai',
  'PerplexityBot',
  'CCBot',
  'Google-Extended',
  'Applebot',
  'DuckDuckBot',
  'Slackbot',
  'facebookexternalhit',
  'LinkedInBot',
  'TwitterBot',
  'Twitterbot',
  'Bard',
  'YouBot',
  'Cohere-ai',
  'SemrushBot',
  'AhrefsBot',
  'Baiduspider',
  'YandexBot',
];

/**
 * User-agent substrings that get a 403 outright.
 *
 * Plain HTTP clients (curl, wget, python-requests/urllib, Go-http-client, aiohttp, httpx)
 * are deliberately absent: blocking a default User-Agent string is bypassed with one flag,
 * and it stops uptime monitors and anyone auditing the security headers from reaching the
 * site. Only strings seen scanning this site belong here.
 */
export const BLOCKED_USER_AGENTS: readonly string[] = ['VertexWP'];

/** Path fragments only WordPress/PHP scanners and secret-hunters request. */
export const BLOCKED_PATHS: readonly string[] = [
  '/wp-admin',
  '/wp-login.php',
  '/wp-includes',
  '/wp-content',
  '/xmlrpc.php',
  '/wlwmanifest.xml',
  '/.env',
  '/.git',
  '/phpinfo',
];

export type UserAgentClass = 'allowed' | 'blocked' | 'neutral';

export function classifyUserAgent(userAgent: string): UserAgentClass {
  if (ALLOWED_USER_AGENTS.some((needle) => userAgent.includes(needle))) return 'allowed';
  if (BLOCKED_USER_AGENTS.some((needle) => userAgent.includes(needle))) return 'blocked';
  return 'neutral';
}

/** True when the User-Agent presents itself as a phone (input to the fake-mobile check). */
export function claimsMobile(userAgent: string): boolean {
  return userAgent.includes('iPhone') || userAgent.includes('Android');
}

export function isBlockedPath(pathname: string): boolean {
  return BLOCKED_PATHS.some((fragment) => pathname.includes(fragment));
}

/** Splits a comma-separated env value into trimmed, non-empty entries. Absent → []. */
export function parseCsvList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isBlockedIp(ip: string, blockedIps: ReadonlySet<string>): boolean {
  return blockedIps.has(ip);
}

/**
 * Prefixes are plain string prefixes: "43.131." matches 43.131.0.0/16. Keep the trailing
 * dot, otherwise "43.13" would also match 43.130.x.x through 43.139.x.x.
 */
export function isFromBlockedPrefix(ip: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => ip.startsWith(prefix));
}

/**
 * The visitor's IP, for the blocklist and EVE's rate limiter.
 *
 * Render's edge is Cloudflare, which sets CF-Connecting-IP itself and overwrites
 * any value a client sends, so that is the only trustworthy source in production.
 * X-Forwarded-For is not: Render appends to whatever the client sent, so its first
 * entry is client-controlled (verified live on 2026-10-21). Without the Cloudflare
 * header (local dev, tests) the last X-Forwarded-For hop, the one added by the
 * nearest proxy, is the best guess.
 */
export function getClientIp(headers: Pick<Headers, 'get'>): string {
  const cloudflare = headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;
  const lastHop = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((hop) => hop.trim())
    .filter(Boolean)
    .at(-1);
  return lastHop || headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Sentry's security-report ingest for the clb-website project. Browsers POST CSP violation
 * reports here; it is a public, write-only endpoint (the same key as the browser DSN), not
 * a secret.
 */
export const CSP_REPORT_URI =
  'https://o4510973470769152.ingest.us.sentry.io/api/4512165408276480/security/?sentry_key=5328d639c44be756c5ab5977f88a0b2f';

/** Endpoint group name shared by the `report-to` directive and the Reporting-Endpoints header. */
export const CSP_REPORT_GROUP = 'csp-endpoint';

/** Value for the `Reporting-Endpoints` response header (Reporting API v1). */
export function buildReportingEndpointsHeader(reportUri: string = CSP_REPORT_URI): string {
  return `${CSP_REPORT_GROUP}="${reportUri}"`;
}

export interface CspOptions {
  /** Request arrived over HTTPS (adds upgrade-insecure-requests). */
  isHttps: boolean;
  /** NODE_ENV === 'development' (relaxes script/style for React Refresh and Turbopack HMR). */
  isDev: boolean;
  reportUri?: string;
}

export function buildCspHeader(nonce: string, options: CspOptions): string {
  const { isHttps, isDev, reportUri = CSP_REPORT_URI } = options;
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' lets framework scripts loaded via the nonced bootstrap also execute.
    // The host allowlist (googletagmanager, google-analytics, plausible) is kept as a fallback
    // for browsers that don't support 'strict-dynamic'. 'unsafe-eval' stays in dev only
    // (React Refresh).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://plausible.io`,
    // style-src split into -elem and -attr. Modern browsers honor the split; the parent
    // style-src is only a fallback for browsers that don't recognize the granular directives.
    // -elem strict prevents <style> tag injection in production (the real XSS vector); in dev
    // we relax to 'unsafe-inline' because Turbopack injects HMR styles inline without nonces.
    // -attr keeps 'unsafe-inline' so React's inline `style={{}}` props continue to work
    // without per-element nonces.
    `style-src 'self' 'unsafe-inline'`,
    `style-src-elem 'self'${isDev ? " 'unsafe-inline'" : ''}`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: https://www.google-analytics.com https://*.google-analytics.com https://*.googletagmanager.com`,
    // Fonts are self-hosted by next/font (downloaded at build time into /_next/static/media),
    // so no Google Fonts hosts are needed.
    `font-src 'self'`,
    `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.googletagmanager.com https://plausible.io`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    // CSP violations land in Sentry (clb-website → Issues, "CSP" category). report-uri is the
    // legacy directive every browser understands; report-to is the Reporting API replacement
    // and resolves through the Reporting-Endpoints header (same Sentry endpoint).
    `report-uri ${reportUri}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ];
  // upgrade-insecure-requests forces the browser to rewrite every http:// subresource
  // URL to https://. Critical in production but breaks local HTTP development — Safari
  // is strictest about this. Only emit when the request itself was over HTTPS (Render
  // terminates TLS upstream and sets x-forwarded-proto: https).
  if (isHttps) {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}
