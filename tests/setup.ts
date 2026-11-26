// Preloaded by `bun test` (see bunfig.toml).
//
// Next.js reads `globalThis.AsyncLocalStorage` once, when its request-storage
// modules first load, and falls back to a stub that throws on use when it is
// missing. A real server sets the global during startup; a unit test that
// imports a route does not. That is harmless until another test file in the
// same run loads Next's server environment (tests/integration/proxy.test.ts
// does, through next/experimental/testing/server), which patches console.* to
// consult that storage: from then on every console.error or console.warn in
// route code throws "AsyncLocalStorage accessed in runtime where it is not
// available". Whether that happens depends on file order, which differs
// between macOS and Linux, so it showed up only in CI.
//
// Setting the global first, exactly as Next's own startup does, removes the
// ordering hazard.
import { AsyncLocalStorage } from 'node:async_hooks';

const globals = globalThis as { AsyncLocalStorage?: typeof AsyncLocalStorage };
globals.AsyncLocalStorage ??= AsyncLocalStorage;
