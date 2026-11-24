import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test('home renders the product claim and passes axe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/testnet/i).first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('home: scale with its source, demo clip, author and code links', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/270 million attempts/)).toBeVisible();
  await expect(page.getByRole('link', { name: /arXiv 2501\.16681/ })).toHaveAttribute(
    'href',
    'https://arxiv.org/abs/2501.16681',
  );
  await expect(page.getByRole('link', { name: 'Esteban Anez' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/esteban-anez',
  );
  await expect(page.getByRole('link', { name: 'View the code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/EstebanAnez/safesend',
  );
  // The clip can always be paused (WCAG 2.2.2).
  await expect(page.locator('video')).toHaveAttribute('controls', '');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the home clip does not autoplay', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(800);
    expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });
});

test('color scheme toggle is keyboard reachable and labelled', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /switch to (dark|light) mode/i });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  const before = await toggle.getAttribute('aria-label');
  await page.keyboard.press('Enter');
  await expect(toggle).not.toHaveAttribute('aria-label', before ?? '');
});
