import { expect, type Page, test } from '@playwright/test';
import { focusIsWithin } from './helpers';

// True when the main landmark, or an ancestor of it, carries the inert attribute.
const mainIsInert = (page: Page) =>
  page.evaluate(() => document.getElementById('main-content')?.closest('[inert]') !== null);

test.describe('skip link', () => {
  test('is the first tab stop and moves focus to the main landmark', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main-content')).toHaveCount(1);

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    // Visually hidden until focused; a keyboard user must be able to see it.
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    // Visible is not enough: it must sit above the fixed header, or a sighted
    // keyboard user sees (and a pointer hits) the header instead.
    const onTop = await skipLink.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === el || el.contains(hit);
    });
    expect(onTop).toBe(true);

    await page.keyboard.press('Enter');
    await expect.poll(() => focusIsWithin(page, 'main#main-content')).toBe(true);
    await expect(page).toHaveURL(/#main-content$/);
  });
});

test.describe('site menu drawer', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens from the keyboard, traps focus, closes on Escape and restores focus', async ({
    page,
  }) => {
    await page.goto('/');
    // The hamburger is inert (and so invisible to role queries) while the drawer
    // is open, hence the attribute-based locator.
    const toggle = page.locator('button[aria-controls="mobile-menu"]');
    await expect(toggle).toHaveAccessibleName('Open menu');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Site menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Focus lands inside the drawer, and the rest of the page is inert for AT
    // (the attribute goes on each body-level sibling, which may wrap <main>).
    await expect.poll(() => focusIsWithin(page, '#mobile-menu')).toBe(true);
    await expect.poll(() => mainIsInert(page)).toBe(true);
    await expect(dialog.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'About Chris' })).toBeVisible();

    // Tab cycles within the drawer: after many presses focus is still inside.
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    expect(await focusIsWithin(page, '#mobile-menu')).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAccessibleName('Open menu');
    await expect(toggle).toBeFocused();
    await expect.poll(() => mainIsInert(page)).toBe(false);
  });

  test('the close button also closes the drawer and restores focus', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    const dialog = page.getByRole('dialog', { name: 'Site menu' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close menu' }).click();
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('a menu link navigates and closes the drawer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Site menu' });
    await dialog.getByRole('link', { name: 'FAQ' }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(dialog).toBeHidden();
    await expect(page.locator('h1')).toHaveText(/Frequent Questions/i);
  });
});

test.describe('FAQ accordion', () => {
  test('is a keyboard-operable WAI-ARIA accordion', async ({ page }) => {
    await page.goto('/faq');
    const buttons = page.locator('main h2 > button[aria-controls]');
    expect(await buttons.count()).toBeGreaterThan(1);

    const first = buttons.nth(0);
    const second = buttons.nth(1);
    const secondPanel = page.locator(`#${await second.getAttribute('aria-controls')}`);

    // One item starts open; the second is collapsed and hidden from AT.
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await expect(secondPanel).toHaveAttribute('aria-hidden', 'true');

    await second.focus();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(secondPanel).toHaveAttribute('aria-hidden', 'false');
    await expect(secondPanel).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'false');

    // The panel is labelled by its button, as the pattern requires.
    await expect(secondPanel).toHaveAttribute(
      'aria-labelledby',
      (await second.getAttribute('id'))!,
    );

    await page.keyboard.press('Space');
    await expect(second).toHaveAttribute('aria-expanded', 'false');
  });
});
