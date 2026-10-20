import { describe, expect, test } from 'bun:test';
import { createRateLimiter, type RateLimiterOptions } from '../../lib/eve-rate-limit';

// Deterministic clock: tests advance it explicitly.
function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance(ms: number) {
      t += ms;
    },
  };
}

function limiter(overrides: Partial<RateLimiterOptions> = {}) {
  const clock = fakeClock();
  const rl = createRateLimiter({
    perIpLimit: 3,
    perIpWindowMs: 1_000,
    globalLimit: 10,
    globalWindowMs: 10_000,
    maxEntries: 1000,
    now: clock.now,
    ...overrides,
  });
  return { rl, clock };
}

describe('createRateLimiter — per-IP window', () => {
  test('allows up to the limit, then refuses with the time until reset', () => {
    const { rl } = limiter();
    expect(rl.check('a')).toEqual({ allowed: true });
    expect(rl.check('a')).toEqual({ allowed: true });
    expect(rl.check('a')).toEqual({ allowed: true });
    const verdict = rl.check('a');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.scope).toBe('ip');
      expect(verdict.retryAfterMs).toBe(1_000);
    }
  });

  test('a refused request does not consume budget or extend the window', () => {
    const { rl, clock } = limiter();
    for (let i = 0; i < 3; i++) rl.check('a');
    clock.advance(400);
    const refused = rl.check('a');
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) expect(refused.retryAfterMs).toBe(600);
    // Window resets at exactly perIpWindowMs after the first request, not after the refusal.
    clock.advance(601);
    expect(rl.check('a')).toEqual({ allowed: true });
  });

  test('the window resets once it expires', () => {
    const { rl, clock } = limiter();
    for (let i = 0; i < 3; i++) rl.check('a');
    expect(rl.check('a').allowed).toBe(false);
    clock.advance(1_001);
    expect(rl.check('a')).toEqual({ allowed: true });
    expect(rl.check('a')).toEqual({ allowed: true });
    expect(rl.check('a')).toEqual({ allowed: true });
    expect(rl.check('a').allowed).toBe(false);
  });

  test('IPs are tracked independently', () => {
    const { rl } = limiter();
    for (let i = 0; i < 3; i++) rl.check('a');
    expect(rl.check('a').allowed).toBe(false);
    expect(rl.check('b')).toEqual({ allowed: true });
    expect(rl.size()).toBe(2);
  });
});

describe('createRateLimiter — global cap', () => {
  test('caps total requests across many IPs', () => {
    const { rl } = limiter({ perIpLimit: 100, globalLimit: 5, globalWindowMs: 10_000 });
    for (let i = 0; i < 5; i++) {
      expect(rl.check(`ip-${i}`)).toEqual({ allowed: true });
    }
    const verdict = rl.check('ip-new');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.scope).toBe('global');
      expect(verdict.retryAfterMs).toBe(10_000);
    }
  });

  test('a globally refused request does not count against the IP either', () => {
    const { rl, clock } = limiter({
      perIpLimit: 2,
      perIpWindowMs: 100_000,
      globalLimit: 1,
      globalWindowMs: 5_000,
    });
    expect(rl.check('a')).toEqual({ allowed: true });
    const refused = rl.check('b');
    expect(refused.allowed).toBe(false);
    if (!refused.allowed) expect(refused.scope).toBe('global');
    // Each global window admits one request; b's per-IP window outlives them all,
    // so b gets its full budget of two across two global windows ...
    clock.advance(5_001);
    expect(rl.check('b')).toEqual({ allowed: true });
    clock.advance(5_001);
    expect(rl.check('b')).toEqual({ allowed: true });
    // ... and is then refused by its own limit, not the global one.
    const verdict = rl.check('b');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.scope).toBe('ip');
  });

  test('the global window resets on its own schedule', () => {
    const { rl, clock } = limiter({ perIpLimit: 100, globalLimit: 2, globalWindowMs: 3_000 });
    rl.check('a');
    rl.check('b');
    expect(rl.check('c').allowed).toBe(false);
    clock.advance(3_001);
    expect(rl.check('c')).toEqual({ allowed: true });
  });

  test('per-IP refusal takes precedence over global refusal in the verdict', () => {
    const { rl } = limiter({ perIpLimit: 1, globalLimit: 1 });
    rl.check('a');
    const verdict = rl.check('a');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.scope).toBe('ip');
  });
});

describe('createRateLimiter — bounded memory', () => {
  test('the tracked-IP map never exceeds maxEntries by more than one check', () => {
    const { rl } = limiter({ maxEntries: 10, perIpLimit: 100, globalLimit: 10_000 });
    for (let i = 0; i < 50; i++) {
      rl.check(`ip-${i}`);
      expect(rl.size()).toBeLessThanOrEqual(11);
    }
  });

  test('eviction drops the entries closest to expiry first', () => {
    const { rl, clock } = limiter({
      maxEntries: 4,
      perIpLimit: 2,
      perIpWindowMs: 100_000,
      globalLimit: 10_000,
    });
    // Older entries expire sooner; each check happens 10ms apart.
    for (let i = 0; i < 4; i++) {
      rl.check(`ip-${i}`);
      clock.advance(10);
    }
    expect(rl.size()).toBe(4);
    // The 5th IP pushes the map over the cap; the next check sweeps the oldest half.
    rl.check('ip-4');
    expect(rl.size()).toBe(5);
    rl.check('ip-5');
    expect(rl.size()).toBe(4);

    // ip-4 survived with its count intact: one more allowed, then refused.
    expect(rl.check('ip-4')).toEqual({ allowed: true });
    expect(rl.check('ip-4').allowed).toBe(false);

    // ip-0 was evicted, so it gets a fresh window with the full budget.
    expect(rl.check('ip-0')).toEqual({ allowed: true });
    expect(rl.check('ip-0')).toEqual({ allowed: true });
    expect(rl.check('ip-0').allowed).toBe(false);
  });

  test('expired entries are swept once the sweep interval elapses', () => {
    const { rl, clock } = limiter({
      perIpLimit: 100,
      perIpWindowMs: 1_000,
      globalLimit: 10_000,
    });
    for (let i = 0; i < 5; i++) rl.check(`ip-${i}`);
    expect(rl.size()).toBe(5);
    // The sweep interval is max(perIpWindowMs, 60s); every entry is expired by then.
    clock.advance(60_001);
    rl.check('fresh');
    expect(rl.size()).toBe(1);
  });
});
