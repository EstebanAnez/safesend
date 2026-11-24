import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Page } from './fixtures';

const ROSA = '0x9e4b27c1d5a83f60b2e7c94d1a58f3e06b7d2c45';

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** One h1, and no level skipped on the way down (h2 -> h4 is a skip). */
async function expectHeadingOutline(page: Page) {
  const levels = await page
    .locator('h1, h2, h3, h4, h5, h6')
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => Number(el.tagName.slice(1))),
    );
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i]!, `heading ${i} after h${levels[i - 1]}`).toBeLessThanOrEqual(
      levels[i - 1]! + 1,
    );
  }
}

test('heading outline stays valid through the journey', async ({ page }) => {
  await page.goto('/demo');
  await expectHeadingOutline(page);

  await page.goto('/demo/pasanaku');
  await expectHeadingOutline(page);

  await page.getByRole('button', { name: 'Add group' }).click();
  await expectHeadingOutline(page); // h1 > h2 Send USDC > h3 Add a group > h4 Member 1
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByLabel('Recipient address').fill(ROSA);
  await page.getByLabel('Amount').fill('50');
  await page.getByRole('button', { name: 'Review send' }).click();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Check before you send' }),
  ).toBeVisible();
  await expectHeadingOutline(page);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('follows the OS setting and passes axe in every main state', async ({ page }) => {
    await page.goto('/demo/dust-poisoning');
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    await page.getByRole('button', { name: /Show details of the suspected lookalike/ }).click();
    await page
      .getByRole('button', { name: /^Sent to Landlord/ })
      .first()
      .click();
    await axe(page);

    // BLOCK, with the comparison.
    const suspicious = page.getByRole('listitem').filter({ hasText: 'Suspected lookalike' });
    await suspicious.getByRole('button', { name: /Use address/ }).click();
    await page.getByLabel('Amount').fill('50');
    await page.getByRole('button', { name: 'Review send' }).click();
    await expect(page.getByRole('heading', { name: 'SafeSend stopped this send' })).toBeVisible();
    await axe(page);

    // History error state.
    // Controlled radio: it updates on React's next render, so assert with retries.
    await page.getByRole('radio', { name: /Outage/ }).click();
    await expect(page.getByRole('radio', { name: /Outage/ })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await axe(page);
  });

  test('WARN challenge passes axe', async ({ page }) => {
    await page.goto('/demo/new-recipient-large');
    await page.getByLabel('Recipient address').fill(ROSA);
    await page.getByLabel('Amount').fill('200');
    await page.getByRole('button', { name: 'Review send' }).click();
    await expect(page.getByRole('textbox', { name: /Type characters/ })).toBeVisible();
    await axe(page);
  });
});

test('loading and empty history states pass axe', async ({ page }) => {
  await page.goto('/demo/clean-wallet');
  // Controlled radio: it updates on React's next render, so assert with retries.
  await page.getByRole('radio', { name: /Slow/ }).click();
  await expect(page.getByRole('radio', { name: /Slow/ })).toBeChecked();
  await expect(page.getByText('Loading activity…')).toBeVisible();
  await axe(page);
  // Controlled radio: it updates on React's next render, so assert with retries.
  await page.getByRole('radio', { name: 'No activity' }).click();
  await expect(page.getByRole('radio', { name: 'No activity' })).toBeChecked();
  await expect(page.getByText('No USDC activity yet')).toBeVisible();
  await axe(page);
});
