// TEMPORARY CI diagnostic — removed before merge.
import { expect, test } from 'bun:test';

test('debug: who touches AsyncLocalStorage when console.error runs', async () => {
  const out = (line: string) => process.stdout.write(`DEBUG ${line}\n`);
  await import('../../app/api/chat/route');
  const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external');
  const proto = Object.getPrototypeOf(workAsyncStorage);
  out(`storage class: ${proto?.constructor?.name}`);
  for (const method of ['run', 'exit', 'enterWith', 'disable']) {
    const original = proto[method];
    proto[method] = function (...args: unknown[]) {
      out(`${method} called from:\n${new Error('TRACE').stack}`);
      return original.apply(this, args);
    };
  }
  out(`console.error source: ${String(console.error).slice(0, 400).replace(/\n/g, ' ')}`);
  out(`console.warn source: ${String(console.warn).slice(0, 200).replace(/\n/g, ' ')}`);
  out(
    `loaded: ${Object.keys(require.cache)
      .filter((k) => /node-environment|console-|sentry/.test(k))
      .map((k) => k.split('node_modules/').pop())
      .slice(0, 40)
      .join(' | ')}`,
  );
  out(`platform ${process.platform} NODE_ENV=${process.env.NODE_ENV} CI=${process.env.CI}`);
  try {
    console.error('debug probe');
    out('console.error did not throw');
  } catch (error) {
    out(`console.error threw: ${String(error)}`);
  }
  expect(true).toBe(true);
});
