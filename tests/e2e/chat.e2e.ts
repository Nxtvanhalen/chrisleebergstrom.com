import { expect, test } from '@playwright/test';
import { focusIsWithin, ndjsonReply } from './helpers';

const OPEN_LABEL = 'Open EVE AI chat assistant';
const CLOSE_LABEL = 'Close EVE AI chat';

test.describe('EVE chat panel', () => {
  test('opens as a labelled dialog, focuses the input, closes on Escape and restores focus', async ({
    page,
  }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: OPEN_LABEL });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();

    const dialog = page.getByRole('dialog', { name: 'EVE' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: CLOSE_LABEL })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const input = dialog.getByRole('textbox', { name: 'Message EVE' });
    await expect(input).toBeFocused();
    await expect(dialog.getByText(/I'm EVE/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: OPEN_LABEL })).toBeFocused();
  });

  test('the header close button closes the panel and restores focus', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    await dialog.getByRole('button', { name: 'Close chat' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: OPEN_LABEL })).toBeFocused();
  });

  test('sends a message and renders the streamed reply', async ({ page }) => {
    const requests: Array<Record<string, unknown>> = [];
    await page.route('**/api/chat', async (route) => {
      requests.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-store',
        },
        body: ndjsonReply(['Chris builds ', '**agentic** software ', 'for live events.']),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    const input = dialog.getByRole('textbox', { name: 'Message EVE' });

    await input.fill('What does Chris do?');
    await page.keyboard.press('Enter');

    // The visitor's bubble appears at once; the reply streams in after.
    await expect(dialog.getByText('What does Chris do?')).toBeVisible();
    await expect(
      dialog
        .getByRole('paragraph')
        .filter({ hasText: 'Chris builds agentic software for live events.' }),
    ).toBeVisible({ timeout: 10_000 });
    // Completed replies render as markdown.
    await expect(dialog.locator('strong', { hasText: 'agentic' })).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ prompt: 'What does Chris do?', context: 'Home' });
    expect(requests[0]).not.toHaveProperty('previousResponseId');

    // Focus returns to the input for the next turn, and the conversation can be reset.
    await expect(input).toBeEnabled();
    await expect.poll(() => focusIsWithin(page, 'input[aria-label="Message EVE"]')).toBe(true);
    await expect(dialog.getByRole('button', { name: 'New conversation' })).toBeVisible();

    // The response id is persisted so the next turn continues the conversation.
    const stored = await page.evaluate(() => window.localStorage.getItem('eve_response_id_v2'));
    expect(stored).toContain('resp_e2e123');
  });

  test('a rate-limited reply is surfaced as a friendly message', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '30' },
        body: JSON.stringify({
          error: 'Rate limit exceeded. Please try again later.',
          success: false,
        }),
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    await dialog.getByRole('textbox', { name: 'Message EVE' }).fill('hello');
    await page.keyboard.press('Enter');
    // Match the bubble, not the sr-only live region that announces the same text.
    await expect(
      dialog.getByRole('paragraph').filter({ hasText: /getting a lot of messages/ }),
    ).toBeVisible();
  });
});
