import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
// Exercises proxy() (the Next.js middleware) with hand-built NextRequests.
//
// proxy.ts reads BLOCKED_IPS / BLOCKED_IP_PREFIXES / CSP_REPORT_ONLY once at
// module load, so each environment variant is imported as a distinct module
// instance via a cache-busting query string.

import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

type ProxyModule = typeof import('../../proxy');

const ENV_KEYS = ['BLOCKED_IPS', 'BLOCKED_IP_PREFIXES', 'CSP_REPORT_ONLY'] as const;

async function loadProxy(env: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    const variant = encodeURIComponent(JSON.stringify(env));
    return (await import(`../../proxy?env=${variant}`)) as ProxyModule;
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function makeRequest(
  pathname = '/about',
  headers: Record<string, string> = {},
  base = 'http://localhost:3000',
) {
  return new NextRequest(`${base}${pathname}`, {
    headers: { 'user-agent': CHROME_UA, 'x-forwarded-for': '203.0.113.10', ...headers },
  });
}

function nonceFrom(csp: string | null): string {
  const match = csp?.match(/'nonce-([^']+)'/);
  if (!match) throw new Error(`no nonce in CSP: ${csp}`);
  return match[1];
}

describe('proxy() — default environment', () => {
  test('a normal request passes through with a nonced CSP and the nonce forwarded upstream', async () => {
    const { proxy } = await loadProxy();
    const res = proxy(makeRequest());
    expect(res.status).toBe(200);

    const csp = res.headers.get('content-security-policy');
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    const nonce = nonceFrom(csp);
    expect(nonce.length).toBeGreaterThan(20);

    // NextResponse.next({ request: { headers } }) surfaces the rewritten request
    // headers as x-middleware-request-*; that is how app/layout.tsx reads x-nonce.
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(res.headers.get('x-middleware-override-headers')).toContain('x-nonce');
    expect(res.headers.get('reporting-endpoints')).toMatch(/^csp-endpoint="https:\/\//);
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
  });

  test('every request gets a fresh nonce', async () => {
    const { proxy } = await loadProxy();
    const a = nonceFrom(proxy(makeRequest()).headers.get('content-security-policy'));
    const b = nonceFrom(proxy(makeRequest()).headers.get('content-security-policy'));
    expect(a).not.toBe(b);
  });

  test('upgrade-insecure-requests follows x-forwarded-proto (Render terminates TLS)', async () => {
    const { proxy } = await loadProxy();
    const http = proxy(makeRequest()).headers.get('content-security-policy');
    const https = proxy(makeRequest('/', { 'x-forwarded-proto': 'https' })).headers.get(
      'content-security-policy',
    );
    expect(http).not.toContain('upgrade-insecure-requests');
    expect(https).toContain('upgrade-insecure-requests');
  });

  test('an allowlisted crawler still gets the CSP', async () => {
    const { proxy } = await loadProxy();
    const res = proxy(makeRequest('/', { 'user-agent': GOOGLEBOT_UA }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("'nonce-");
  });

  test('scanner paths get 403 (with the CSP), crawler or not', async () => {
    const { proxy } = await loadProxy();
    for (const path of ['/wp-admin', '/wp-login.php', '/.env', '/.git/config', '/xmlrpc.php']) {
      const res = proxy(makeRequest(path));
      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({ error: 'Invalid Request' });
      expect(res.headers.get('content-security-policy')).toContain("'nonce-");
    }
    const bot = proxy(makeRequest('/wp-admin/', { 'user-agent': GOOGLEBOT_UA }));
    expect(bot.status).toBe(403);
  });

  test('blocked user agents get 403 unless they are also allowlisted', async () => {
    const { proxy } = await loadProxy();
    const blocked = proxy(makeRequest('/', { 'user-agent': 'VertexWP/1.0' }));
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toEqual({ error: 'Bot Detected' });
    expect(blocked.headers.get('content-security-policy')).toContain("'nonce-");

    const mixed = proxy(makeRequest('/', { 'user-agent': 'VertexWP Googlebot' }));
    expect(mixed.status).toBe(200);
  });

  test('without BLOCKED_IP_PREFIXES, mobile traffic is never flagged', async () => {
    const { proxy } = await loadProxy();
    const res = proxy(
      makeRequest('/', { 'user-agent': IPHONE_UA, 'x-forwarded-for': '43.131.1.1' }),
    );
    expect(res.status).toBe(200);
  });

  test('the matcher skips only build assets', async () => {
    const { config } = await loadProxy();
    const matches = (url: string, headers?: Record<string, string>) =>
      unstable_doesMiddlewareMatch({ config, url, headers });

    expect(matches('/_next/static/chunks/main.js')).toBe(false);
    expect(matches('/_next/image?url=%2Fimages%2Fx.webp&w=640&q=75')).toBe(false);

    // Prefix look-alikes render the HTML 404 and must still get a CSP.
    for (const url of [
      '/',
      '/about',
      '/robots.txt',
      '/robots.txt-x',
      '/_next/static-x',
      '/_next/image-x',
      '/static-x',
      '/monitoring-x',
    ]) {
      expect(matches(url)).toBe(true);
    }
    // Prefetch headers are client-controlled, so they must not skip the proxy
    // (and with it the IP blocklist).
    expect(matches('/about', { 'next-router-prefetch': '1' })).toBe(true);
    expect(matches('/about', { purpose: 'prefetch' })).toBe(true);
  });
});

describe('proxy() — BLOCKED_IPS', () => {
  test('a listed client IP gets 403 on every path, crawler user agents included', async () => {
    const { proxy } = await loadProxy({ BLOCKED_IPS: ' 203.0.113.10 , 198.51.100.7' });

    const res = proxy(makeRequest('/about'));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Access Denied' });
    expect(res.headers.get('content-security-policy')).toContain("'nonce-");

    const bot = proxy(makeRequest('/', { 'user-agent': GOOGLEBOT_UA }));
    expect(bot.status).toBe(403);
    await expect(bot.json()).resolves.toEqual({ error: 'Access Denied' });

    // Second entry, via the x-real-ip fallback.
    const second = proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { 'user-agent': CHROME_UA, 'x-real-ip': '198.51.100.7' },
      }),
    );
    expect(second.status).toBe(403);
  });

  test('other addresses are unaffected', async () => {
    const { proxy } = await loadProxy({ BLOCKED_IPS: '203.0.113.10' });
    const res = proxy(makeRequest('/about', { 'x-forwarded-for': '203.0.113.11' }));
    expect(res.status).toBe(200);
  });

  test('a blocked client cannot dodge the list by sending its own forwarding headers', async () => {
    const { proxy } = await loadProxy({ BLOCKED_IPS: '203.0.113.10' });
    // Behind Render, Cloudflare's CF-Connecting-IP is the real address; a forged
    // X-Forwarded-For only adds hops in front of it.
    const res = proxy(
      makeRequest('/about', {
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.99, 203.0.113.10',
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('proxy() — BLOCKED_IP_PREFIXES', () => {
  test('data-center "mobile" traffic gets 403; desktop and crawlers from the same range pass', async () => {
    const { proxy } = await loadProxy({ BLOCKED_IP_PREFIXES: '43.131.,43.132.' });

    const fakeMobile = proxy(
      makeRequest('/', { 'user-agent': IPHONE_UA, 'x-forwarded-for': '43.132.9.9' }),
    );
    expect(fakeMobile.status).toBe(403);
    await expect(fakeMobile.json()).resolves.toEqual({ error: 'VPN/Proxy Detected' });

    const desktop = proxy(makeRequest('/', { 'x-forwarded-for': '43.132.9.9' }));
    expect(desktop.status).toBe(200);

    const crawler = proxy(
      makeRequest('/', { 'user-agent': `${GOOGLEBOT_UA} iPhone`, 'x-forwarded-for': '43.131.2.2' }),
    );
    expect(crawler.status).toBe(200);

    const elsewhere = proxy(
      makeRequest('/', { 'user-agent': IPHONE_UA, 'x-forwarded-for': '43.133.9.9' }),
    );
    expect(elsewhere.status).toBe(200);
  });
});

describe('proxy() — CSP_REPORT_ONLY', () => {
  test('ships the same policy under the report-only header name', async () => {
    const { proxy } = await loadProxy({ CSP_REPORT_ONLY: 'true' });
    const res = proxy(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBeNull();
    const reportOnly = res.headers.get('content-security-policy-report-only');
    expect(reportOnly).toContain("'strict-dynamic'");
    expect(res.headers.get('x-middleware-request-x-nonce')).toBe(nonceFrom(reportOnly));
  });

  test('any other value keeps enforcement on', async () => {
    const { proxy } = await loadProxy({ CSP_REPORT_ONLY: 'yes' });
    const res = proxy(makeRequest());
    expect(res.headers.get('content-security-policy')).toContain("'nonce-");
    expect(res.headers.get('content-security-policy-report-only')).toBeNull();
  });
});
