import { expect, type Page, test } from '@playwright/test';
import { type ChatRequestBody, focusIsWithin, ndjsonReply } from './helpers';

const OPEN_LABEL = 'Open EVE AI chat assistant';
const CLOSE_LABEL = 'Close EVE AI chat';
const NDJSON_HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
};

// Answers every /api/chat call with the next reply in `replies` and records
// the request bodies.
async function mockChat(page: Page, replies: string[][]): Promise<ChatRequestBody[]> {
  const requests: ChatRequestBody[] = [];
  await page.route('**/api/chat', async (route) => {
    requests.push(route.request().postDataJSON() as ChatRequestBody);
    const deltas = replies[Math.min(requests.length, replies.length) - 1];
    await route.fulfill({ status: 200, headers: NDJSON_HEADERS, body: ndjsonReply(deltas) });
  });
  return requests;
}

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
    const requests = await mockChat(page, [
      ['Chris builds ', '**agentic** software ', 'for live events.'],
    ]);

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

    // The welcome line is the panel's own text, so the first request carries
    // only the visitor's message.
    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({
      messages: [{ role: 'user', content: 'What does Chris do?' }],
      context: 'Home',
    });

    // Focus returns to the input for the next turn, and the conversation can be reset.
    await expect(input).toBeEnabled();
    await expect.poll(() => focusIsWithin(page, 'input[aria-label="Message EVE"]')).toBe(true);
    await expect(dialog.getByRole('button', { name: 'New conversation' })).toBeVisible();
  });

  test('the next message carries the conversation so far', async ({ page }) => {
    const requests = await mockChat(page, [['Hi! I am EVE.'], ['He builds agentic software.']]);
    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    const input = dialog.getByRole('textbox', { name: 'Message EVE' });

    await input.fill('Hello');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('paragraph').filter({ hasText: 'Hi! I am EVE.' })).toBeVisible();
    await expect(input).toBeEnabled();

    await input.fill('What does Chris do?');
    await page.keyboard.press('Enter');
    await expect(
      dialog.getByRole('paragraph').filter({ hasText: 'He builds agentic software.' }),
    ).toBeVisible();

    expect(requests).toHaveLength(2);
    expect(requests[1].messages).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi! I am EVE.' },
      { role: 'user', content: 'What does Chris do?' },
    ]);
  });

  test('an error-only reply is shown but never sent back as something EVE said', async ({
    page,
  }) => {
    const requests: ChatRequestBody[] = [];
    await page.route('**/api/chat', async (route) => {
      requests.push(route.request().postDataJSON() as ChatRequestBody);
      const body =
        requests.length === 1
          ? `${JSON.stringify({ type: 'error', code: 'timeout', message: 'EVE took too long to answer. Please try again.' })}\n`
          : ndjsonReply(['Back again.']);
      await route.fulfill({ status: 200, headers: NDJSON_HEADERS, body });
    });
    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    const input = dialog.getByRole('textbox', { name: 'Message EVE' });
    await input.fill('First try');
    await page.keyboard.press('Enter');
    await expect(dialog.getByText('EVE took too long to answer.')).toBeVisible();
    await expect(input).not.toHaveAttribute('readonly');
    await input.fill('Second try');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('paragraph').filter({ hasText: 'Back again.' })).toBeVisible();
    expect(requests[1].messages).toEqual([
      { role: 'user', content: 'First try' },
      { role: 'user', content: 'Second try' },
    ]);
  });

  test('a finished reply survives closing the panel before it has finished typing out', async ({
    page,
  }) => {
    // Long enough that the typewriter reveal is still running when we close.
    const sentence = 'Chris spent twenty years on the road before he started shipping software. ';
    const full = sentence.repeat(40).trim();
    await mockChat(page, [[full]]);
    await page.goto('/');
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    const dialog = page.getByRole('dialog', { name: 'EVE' });
    await dialog.getByRole('textbox', { name: 'Message EVE' }).fill('Tell me the story');
    await page.keyboard.press('Enter');

    // The reply is saved as soon as the stream ends, while the typewriter is
    // usually still running. (The reveal speed isn't controllable from here, so
    // this doesn't insist on catching it mid-animation; the old code only saved
    // once the reveal settled, which closing the panel prevented.)
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('eve_chat_history_v3')))
      .toContain(full);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: OPEN_LABEL }).click();
    await expect(
      page.getByRole('dialog', { name: 'EVE' }).getByRole('paragraph').filter({ hasText: full }),
    ).toBeVisible();
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
