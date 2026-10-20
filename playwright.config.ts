import { defineConfig, devices } from '@playwright/test';

// End-to-end suite: runs against a production build (`next build && next start`)
// so the CSP is the real, enforced policy and every route is server-rendered
// with a per-request nonce exactly as on Render.
//
//   bun run test:e2e                       build + start + test
//   PLAYWRIGHT_SKIP_BUILD=1 bun run test:e2e   reuse an existing .next build
//
// Spec files end in `.e2e.ts` so `bun test` (which also matches *.spec.ts)
// never tries to execute them.

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: process.env.PLAYWRIGHT_SKIP_BUILD ? 'bun run start' : 'bun run build && bun run start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // Covers a cold production build on a CI runner.
    timeout: 300_000,
    env: {
      PORT: String(PORT),
      // The chat route only checks that a key exists before it calls OpenAI;
      // every e2e spec mocks /api/chat, so a placeholder is enough.
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'placeholder',
    },
  },
});
