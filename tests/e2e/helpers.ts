import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

// Console / page signals that mean the CSP blocked something or React could not
// hydrate. Production React logs hydration problems as minified error codes:
//   418 hydration mismatch · 419 suspense boundary · 421/422/423/424 errors
//   while hydrating · 425 text content mismatch
const CSP_PATTERN = /content security policy|refused to (execute|load|apply|connect|frame)/i;
const HYDRATION_PATTERN = /hydrat|minified react error #(418|419|421|422|423|424|425)\b/i;

export type PageProblems = {
  // Everything collected so far: CSP violations (from the securitypolicyviolation
  // event and console), hydration errors, and uncaught exceptions.
  collect(): Promise<string[]>;
};

// Attach before the first navigation. Returns a collector the test awaits at the end.
export async function trackPageProblems(page: Page): Promise<PageProblems> {
  const problems: string[] = [];

  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      const where = event.sourceFile ? ` at ${event.sourceFile}:${event.lineNumber}` : '';
      window.__cspViolations?.push(
        `${event.violatedDirective} blocked ${event.blockedURI || 'inline'}${where}`,
      );
    });
  });

  page.on('console', (message) => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const text = message.text();
    if (CSP_PATTERN.test(text)) problems.push(`csp console: ${text}`);
    else if (HYDRATION_PATTERN.test(text)) problems.push(`hydration: ${text}`);
  });

  page.on('pageerror', (error) => {
    problems.push(`uncaught: ${error.message}`);
  });

  return {
    async collect() {
      const violations = await page.evaluate(() => window.__cspViolations ?? []);
      return [...problems, ...violations.map((v) => `csp event: ${v}`)];
    },
  };
}

// Pathnames the site advertises to crawlers; the single source of truth for
// "every public route".
export function sitemapRoutes(): string[] {
  // Lazy require keeps the Next type import out of Playwright's config load.
  const sitemap = require('../../app/sitemap').default as () => Array<{ url: string }>;
  return sitemap().map((entry) => new URL(entry.url).pathname);
}

// True when `document.activeElement` is the element matched by `selector` or
// lives inside it.
export function focusIsWithin(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const target = document.querySelector(sel);
    const active = document.activeElement;
    return !!target && !!active && (active === target || target.contains(active));
  }, selector);
}

// One NDJSON reply exactly as app/api/chat/route.ts streams it.
export function ndjsonReply(deltas: string[]): string {
  const lines = deltas.map((text) => JSON.stringify({ type: 'delta', text }));
  lines.push(JSON.stringify({ type: 'done', finalText: deltas.join('') }));
  return `${lines.join('\n')}\n`;
}

// The body the chat panel POSTs to /api/chat.
export type ChatRequestBody = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: string;
};
