import { describe, expect, test } from 'bun:test';
import {
  ALLOWED_USER_AGENTS,
  BLOCKED_PATHS,
  buildCspHeader,
  buildReportingEndpointsHeader,
  CSP_REPORT_GROUP,
  CSP_REPORT_URI,
  claimsMobile,
  classifyUserAgent,
  getClientIp,
  isBlockedIp,
  isBlockedPath,
  isFromBlockedPrefix,
  parseCsvList,
} from '../../lib/proxy-security';

const NONCE = 'dGVzdC1ub25jZQ==';

// Splits a CSP string into a directive-name → tokens map.
function directives(csp: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...tokens] = part.trim().split(/\s+/);
    if (name) map.set(name, tokens);
  }
  return map;
}

describe('buildCspHeader', () => {
  test('script-src carries the per-request nonce and strict-dynamic', () => {
    const csp = buildCspHeader(NONCE, { isHttps: true, isDev: false });
    const scriptSrc = directives(csp).get('script-src');
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).toContain("'self'");
  });

  test('a different nonce yields a different policy', () => {
    const a = buildCspHeader('nonceA', { isHttps: true, isDev: false });
    const b = buildCspHeader('nonceB', { isHttps: true, isDev: false });
    expect(a).not.toBe(b);
    expect(a).toContain("'nonce-nonceA'");
    expect(b).not.toContain("'nonce-nonceA'");
  });

  test('production never allows unsafe-eval or inline scripts', () => {
    const csp = buildCspHeader(NONCE, { isHttps: true, isDev: false });
    const scriptSrc = directives(csp).get('script-src') ?? [];
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    // style-src-elem is the directive modern browsers honor; it must be strict in prod.
    expect(directives(csp).get('style-src-elem')).toEqual(["'self'"]);
  });

  test('development relaxes script and style for React Refresh / Turbopack HMR', () => {
    const csp = buildCspHeader(NONCE, { isHttps: false, isDev: true });
    expect(directives(csp).get('script-src')).toContain("'unsafe-eval'");
    expect(directives(csp).get('style-src-elem')).toContain("'unsafe-inline'");
    // The nonce is still required even in dev.
    expect(directives(csp).get('script-src')).toContain(`'nonce-${NONCE}'`);
  });

  test('upgrade-insecure-requests only when the request was HTTPS', () => {
    const https = buildCspHeader(NONCE, { isHttps: true, isDev: false });
    const http = buildCspHeader(NONCE, { isHttps: false, isDev: false });
    expect(directives(https).has('upgrade-insecure-requests')).toBe(true);
    expect(directives(http).has('upgrade-insecure-requests')).toBe(false);
  });

  test('violations are reported via both report-uri and report-to', () => {
    const csp = buildCspHeader(NONCE, { isHttps: true, isDev: false });
    const d = directives(csp);
    expect(d.get('report-uri')).toEqual([CSP_REPORT_URI]);
    expect(d.get('report-to')).toEqual([CSP_REPORT_GROUP]);
  });

  test('a custom reportUri replaces the default Sentry endpoint', () => {
    const csp = buildCspHeader(NONCE, {
      isHttps: true,
      isDev: false,
      reportUri: 'https://example.test/csp',
    });
    expect(directives(csp).get('report-uri')).toEqual(['https://example.test/csp']);
    expect(csp).not.toContain(CSP_REPORT_URI);
  });

  test('hardening directives are present and strict', () => {
    const d = directives(buildCspHeader(NONCE, { isHttps: true, isDev: false }));
    expect(d.get('default-src')).toEqual(["'self'"]);
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'self'"]);
    expect(d.get('form-action')).toEqual(["'self'"]);
  });
});

describe('buildReportingEndpointsHeader', () => {
  test('names the same group the report-to directive references', () => {
    expect(buildReportingEndpointsHeader()).toBe(`${CSP_REPORT_GROUP}="${CSP_REPORT_URI}"`);
    expect(buildReportingEndpointsHeader('https://example.test/r')).toBe(
      `${CSP_REPORT_GROUP}="https://example.test/r"`,
    );
  });
});

describe('classifyUserAgent', () => {
  test('known-good crawlers are allowed', () => {
    expect(
      classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe('allowed');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe('neutral');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Bingbot/2.0)')).toBe('allowed');
    expect(classifyUserAgent('GPTBot/1.0')).toBe('allowed');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0; Claude-Web)')).toBe(
      'allowed',
    );
  });

  test('every allowlisted needle classifies as allowed', () => {
    for (const needle of ALLOWED_USER_AGENTS) {
      expect(classifyUserAgent(`Mozilla/5.0 (compatible; ${needle}/1.0)`)).toBe('allowed');
    }
  });

  test('scanner user agents are blocked', () => {
    expect(classifyUserAgent('VertexWP/1.0')).toBe('blocked');
  });

  test('ordinary browsers and plain HTTP clients are neutral', () => {
    expect(
      classifyUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36',
      ),
    ).toBe('neutral');
    expect(classifyUserAgent('curl/8.4.0')).toBe('neutral');
    expect(classifyUserAgent('python-requests/2.31')).toBe('neutral');
    expect(classifyUserAgent('')).toBe('neutral');
  });

  test('allowlist wins over blocklist when both match', () => {
    expect(classifyUserAgent('VertexWP Googlebot')).toBe('allowed');
  });
});

describe('claimsMobile', () => {
  test('detects iPhone and Android strings', () => {
    expect(claimsMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(claimsMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(true);
    expect(claimsMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
    expect(claimsMobile('')).toBe(false);
  });
});

describe('isBlockedPath', () => {
  test('matches scanner paths anywhere in the pathname', () => {
    for (const fragment of BLOCKED_PATHS) {
      expect(isBlockedPath(fragment)).toBe(true);
      expect(isBlockedPath(`/foo${fragment}/bar`)).toBe(true);
    }
    expect(isBlockedPath('/wp-admin/install.php')).toBe(true);
    expect(isBlockedPath('/.env.production')).toBe(true);
  });

  test('leaves real routes alone', () => {
    for (const path of ['/', '/about', '/projects', '/api/chat', '/blog', '/environment']) {
      expect(isBlockedPath(path)).toBe(false);
    }
  });
});

describe('parseCsvList', () => {
  test('absent or empty values yield an empty list', () => {
    expect(parseCsvList(undefined)).toEqual([]);
    expect(parseCsvList(null)).toEqual([]);
    expect(parseCsvList('')).toEqual([]);
    expect(parseCsvList(' , ,')).toEqual([]);
  });

  test('trims entries and drops blanks', () => {
    expect(parseCsvList(' 1.2.3.4 ,5.6.7.8,, 9.9.9.9 ')).toEqual(['1.2.3.4', '5.6.7.8', '9.9.9.9']);
    expect(parseCsvList('43.131.')).toEqual(['43.131.']);
  });
});

describe('IP blocking helpers', () => {
  test('isBlockedIp is an exact-match lookup', () => {
    const blocked = new Set(['1.2.3.4']);
    expect(isBlockedIp('1.2.3.4', blocked)).toBe(true);
    expect(isBlockedIp('1.2.3.40', blocked)).toBe(false);
    expect(isBlockedIp('unknown', blocked)).toBe(false);
    expect(isBlockedIp('1.2.3.4', new Set())).toBe(false);
  });

  test('isFromBlockedPrefix is a plain string prefix match', () => {
    expect(isFromBlockedPrefix('43.131.9.9', ['43.131.'])).toBe(true);
    expect(isFromBlockedPrefix('43.132.9.9', ['43.131.'])).toBe(false);
    // Documented footgun: a prefix without the trailing dot over-matches.
    expect(isFromBlockedPrefix('43.1319.9.9', ['43.131'])).toBe(true);
    expect(isFromBlockedPrefix('43.131.9.9', [])).toBe(false);
  });
});

describe('getClientIp', () => {
  test('trusts CF-Connecting-IP over anything a client can send', () => {
    const headers = new Headers({
      'cf-connecting-ip': ' 203.0.113.9 ',
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      'x-real-ip': '10.0.0.2',
    });
    expect(getClientIp(headers)).toBe('203.0.113.9');
  });

  test('never trusts the first x-forwarded-for hop (client-controlled behind Render)', () => {
    const spoofed = new Headers({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' });
    expect(getClientIp(spoofed)).toBe('203.0.113.9');
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.9 ,, ' }))).toBe('203.0.113.9');
  });

  test('falls back to x-real-ip, then "unknown"', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '10.0.0.2' }))).toBe('10.0.0.2');
    expect(getClientIp(new Headers())).toBe('unknown');
    // An empty header must not shadow the next source.
    expect(getClientIp(new Headers({ 'cf-connecting-ip': '', 'x-real-ip': '10.0.0.3' }))).toBe(
      '10.0.0.3',
    );
    expect(getClientIp(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '10.0.0.3' }))).toBe(
      '10.0.0.3',
    );
  });
});
