import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { sitemapRoutes, trackPageProblems } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const FAILING_IMPACTS = new Set(['serious', 'critical']);

for (const route of sitemapRoutes()) {
  test.describe(route, () => {
    test('renders with a 200, one h1, and a main landmark', async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-security-policy']).toContain("'strict-dynamic'");

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main#main-content')).toHaveCount(1);
    });

    test('loads under the enforced CSP without violations or hydration errors', async ({
      page,
    }) => {
      const problems = await trackPageProblems(page);
      await page.goto(route);
      // Hydration has happened once the hamburger's React handler state is live.
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await page.waitForLoadState('load');
      // Give deferred work (consent banner, chat widget, lazy chunks) a beat to run.
      await page.waitForTimeout(1500);
      expect(await problems.collect()).toEqual([]);
    });

    test('has no serious or critical axe violations (WCAG 2.1 A/AA)', async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      // Let the entrance animations finish so contrast is measured on settled styles.
      await page.waitForTimeout(1500);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const failing = results.violations.filter((v) => FAILING_IMPACTS.has(v.impact ?? ''));
      const summary = failing.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
      }));
      expect(summary, JSON.stringify(summary, null, 2)).toEqual([]);
    });
  });
}

test('an unknown path renders the 404 page with its own h1', async ({ page }) => {
  const response = await page.goto('/definitely-not-a-page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main#main-content')).toHaveCount(1);
});
