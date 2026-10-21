// In-memory rate limiter for the EVE chat route: a fixed window per client IP
// plus a process-wide fixed window that caps total model spend no matter how
// many addresses are hitting us. State lives in the module instance, so on a
// multi-instance deploy each instance enforces its own budget.
//
// The clock is injectable so tests can drive windows deterministically.

export type RateLimiterOptions = {
  perIpLimit: number;
  perIpWindowMs: number;
  globalLimit: number;
  globalWindowMs: number;
  // Hard bound on tracked IPs. When exceeded, the entries closest to expiry are
  // evicted first; a flood of unique addresses can therefore reset itself
  // early, but it can never grow the map without limit.
  maxEntries?: number;
  now?: () => number;
};

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; scope: 'ip' | 'global'; retryAfterMs: number };

export type RateLimiter = {
  check(ip: string): RateLimitVerdict;
  // Number of tracked IPs; exposed for tests and diagnostics.
  size(): number;
};

type Window = { count: number; resetTime: number };

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { perIpLimit, perIpWindowMs, globalLimit, globalWindowMs } = options;
  const maxEntries = options.maxEntries ?? 1000;
  const now = options.now ?? Date.now;
  // Sweep expired entries at most this often; the hard cap below is what bounds
  // memory between sweeps.
  const sweepIntervalMs = Math.max(perIpWindowMs, 60_000);

  const perIp = new Map<string, Window>();
  let global: Window = { count: 0, resetTime: 0 };
  let lastSweep = now();

  function sweep(current: number) {
    if (current - lastSweep >= sweepIntervalMs) {
      for (const [ip, window] of perIp) {
        if (current > window.resetTime) perIp.delete(ip);
      }
      lastSweep = current;
    }
    if (perIp.size > maxEntries) {
      const soonest = [...perIp.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
      for (const [ip] of soonest.slice(0, Math.ceil(maxEntries / 2))) {
        perIp.delete(ip);
      }
    }
  }

  return {
    check(ip) {
      const current = now();
      sweep(current);

      let ipWindow = perIp.get(ip);
      if (!ipWindow || current > ipWindow.resetTime) {
        ipWindow = { count: 0, resetTime: current + perIpWindowMs };
        perIp.set(ip, ipWindow);
      }
      if (current > global.resetTime) {
        global = { count: 0, resetTime: current + globalWindowMs };
      }

      // Decide before counting so a refused request doesn't consume budget.
      if (ipWindow.count >= perIpLimit) {
        return { allowed: false, scope: 'ip', retryAfterMs: ipWindow.resetTime - current };
      }
      if (global.count >= globalLimit) {
        return { allowed: false, scope: 'global', retryAfterMs: global.resetTime - current };
      }

      ipWindow.count++;
      global.count++;
      return { allowed: true };
    },
    size() {
      return perIp.size;
    },
  };
}
