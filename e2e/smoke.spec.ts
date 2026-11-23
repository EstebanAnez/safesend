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

test('color scheme toggle is keyboard reachable and labelled', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /switch to (dark|light) mode/i });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  const before = await toggle.getAttribute('aria-label');
  await page.keyboard.press('Enter');
  await expect(toggle).not.toHaveAttribute('aria-label', before ?? '');
});
