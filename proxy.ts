import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  buildCspHeader,
  buildReportingEndpointsHeader,
  claimsMobile,
  classifyUserAgent,
  getClientIp,
  isBlockedIp,
  isBlockedPath,
  isFromBlockedPrefix,
  parseCsvList,
} from './lib/proxy-security';

// IP blocking is configured through the environment (Render → Environment), not in source:
//   BLOCKED_IPS          comma-separated client IPs → 403 on every request
//   BLOCKED_IP_PREFIXES  comma-separated IPv4 prefixes ("43.131.") → 403 when the User-Agent
//                        also claims to be a phone (data-center "mobile" traffic is never real)
// Both are optional; absent or empty means no IP-based blocking. Parsed once at module load.
const BLOCKED_IPS: ReadonlySet<string> = new Set(parseCsvList(process.env.BLOCKED_IPS));
const BLOCKED_IP_PREFIXES: readonly string[] = parseCsvList(process.env.BLOCKED_IP_PREFIXES);

const IS_DEV = process.env.NODE_ENV === 'development';
// Set CSP_REPORT_ONLY=true to ship the policy in report-only mode (the browser logs
// violations to Sentry but doesn't block). Only the header name changes.
const CSP_HEADER_NAME =
  process.env.CSP_REPORT_ONLY === 'true'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
const REPORTING_ENDPOINTS = buildReportingEndpointsHeader();

function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set(CSP_HEADER_NAME, csp);
  response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS);
  return response;
}

export function proxy(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // The nonce and CSP are built before any check so that EVERY response — 403s and
  // allowlisted crawlers included — leaves with the policy. Nothing below returns without it.
  const nonce = btoa(crypto.randomUUID());
  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' || request.nextUrl.protocol === 'https:';
  const csp = buildCspHeader(nonce, { isHttps, isDev: IS_DEV });

  const deny = (error: string) =>
    withSecurityHeaders(NextResponse.json({ error }, { status: 403 }), csp);

  // 1. IP blocklist — applies to everyone, including allowlisted crawlers.
  if (isBlockedIp(ip, BLOCKED_IPS)) return deny('Access Denied');

  // 2. Scanner paths (wp-admin, .env, .git, ...) — applies to everyone.
  if (isBlockedPath(pathname)) return deny('Invalid Request');

  // 3. User-agent heuristics — the only checks a known-good crawler skips.
  const uaClass = classifyUserAgent(userAgent);
  if (uaClass === 'blocked') return deny('Bot Detected');
  if (
    uaClass === 'neutral' &&
    claimsMobile(userAgent) &&
    isFromBlockedPrefix(ip, BLOCKED_IP_PREFIXES)
  ) {
    return deny('VPN/Proxy Detected');
  }

  // Thread the nonce through the request headers so server components can read it via
  // `headers()` from 'next/headers' (app/layout.tsx), then set the CSP on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  // Skip static assets and metadata files (CSP irrelevant; saves nonce generation).
  // The `missing` clause skips prefetch-only requests so we don't waste nonces on
  // RSC payload prefetches that don't render HTML.
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|site.webmanifest|sw.js|static|monitoring).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
