import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ROSA = '0x9e4b27c1d5a83f60b2e7c94d1a58f3e06b7d2c45';

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function review(page: Page, amount: string) {
  await page.getByLabel('Amount').fill(amount);
  await page.getByRole('button', { name: 'Review send' }).click();
}

test('scenario picker lists all six scenarios and passes axe', async ({ page }) => {
  await page.goto('/demo');
  const list = page.getByRole('list', { name: 'Demo scenarios' });
  await expect(list.getByRole('listitem')).toHaveCount(6);
  await axe(page);
});

test('clean wallet: a trusted contact is one tap, no friction', async ({ page }) => {
  await page.goto('/demo/clean-wallet');
  await page.getByRole('button', { name: 'Send to Lucía (sister)' }).click();
  await expect(page.getByLabel('Amount')).toBeFocused();
  await review(page, '50');
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Send 50 USDC (simulated)' }).click();
  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeVisible();
});

for (const { id, name, amount, imitates } of [
  { id: 'dust-poisoning', name: /Show details/, amount: '50', imitates: 'Lucía' },
  { id: 'zero-value-poisoning', name: /Show details/, amount: '250', imitates: 'an address you' },
  { id: 'counterfeit-usdc', name: /Show details/, amount: '45', imitates: 'Lucía' },
]) {
  test(`${id}: the planted entry is hidden, BLOCKed with a reason, and recoverable`, async ({
    page,
  }) => {
    await page.goto(`/demo/${id}`);
    await expect(page.getByText('Suspected lookalike')).toBeVisible();
    await page.getByRole('button', { name }).click();
    // Use the planted address (the only "Use as recipient" inside the expanded suspicious entry).
    const suspicious = page.getByRole('listitem').filter({ hasText: 'Suspected lookalike' });
    await suspicious.getByRole('button', { name: /Use address/ }).click();
    await review(page, amount);

    await expect(page.getByRole('heading', { name: 'SafeSend stopped this send' })).toBeVisible();
    await expect(page.getByText(new RegExp(`imitates ${imitates}`)).first()).toBeVisible();
    await expect(page.getByText('Same start and end. Different middle.')).toBeVisible();
    // No way to send to the blocked address.
    await expect(page.getByRole('button', { name: /^Send \d+ USDC/ })).toHaveCount(0);
    await axe(page);

    await page.getByRole('button', { name: /instead$/ }).click();
    await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
  });
}

test('new recipient, large amount: middle-character WARN and test-send nudge', async ({ page }) => {
  await page.goto('/demo/new-recipient-large');
  await page.getByLabel('Recipient address').fill(ROSA);
  await review(page, '200');
  await expect(page.getByRole('heading', { name: 'Check before you send' })).toBeVisible();
  await expect(page.getByText('Try a small test send first')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Type characters/ })).toBeVisible();
  await axe(page);
});

test('amount anomaly: a trusted contact still gets a WARN for an unusual amount', async ({
  page,
}) => {
  await page.goto('/demo/amount-anomaly');
  await page.getByRole('button', { name: 'Send to Lucía (sister)' }).click();
  await review(page, '400');
  await expect(page.getByText('Much larger than your usual send')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Type characters/ })).toBeVisible();
  // Not a test-send nudge: she is a trusted contact.
  await expect(page.getByText('Try a small test send first')).toHaveCount(0);
});

test('adding a contact is deliberate and then frictionless', async ({ page }) => {
  await page.goto('/demo/new-recipient-large');
  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByLabel('Name').fill('Rosa');
  await page.getByLabel('Full address').fill(ROSA);
  await page.getByRole('button', { name: 'Save contact' }).click();
  // Not saved without the explicit confirmation.
  await expect(page.getByText('Confirm you got this address directly from Rosa.')).toBeVisible();
  await page.getByRole('checkbox', { name: /directly from Rosa/ }).check();
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByText('Rosa saved as a contact')).toBeVisible();

  await page.getByRole('button', { name: 'Send to Rosa' }).click();
  await review(page, '200');
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
});

test('BLOCK has no bypass: "different person" requires re-entry and never resumes the send', async ({
  page,
}) => {
  await page.goto('/demo/dust-poisoning');
  await page.getByRole('button', { name: /Show details/ }).click();
  const suspicious = page.getByRole('listitem').filter({ hasText: 'Suspected lookalike' });
  await suspicious.getByRole('button', { name: /Use address/ }).click();
  const blocked = await page.getByLabel('Recipient address').inputValue();
  await review(page, '50');
  await page.getByRole('button', { name: 'This is a different person' }).click();

  // Nothing is prefilled: the user must enter the full address themselves.
  await expect(page.getByLabel('Full address')).toHaveValue('');
  await page.getByLabel('Name').fill('Someone else');
  await page.getByLabel('Full address').fill(blocked);
  await expect(page.getByText(/This looks like Lucía/)).toBeVisible();
  await page.getByRole('checkbox', { name: /through another channel/ }).check();
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByText('Type or paste the full address a second time.')).toBeVisible();

  await page.getByLabel('Type or paste the full address again').fill(blocked);
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByText('The blocked send stays cancelled.')).toBeVisible();
  // The form was cleared, and nothing was sent.
  await expect(page.getByLabel('Recipient address')).toHaveValue('');
  await expect(page.getByRole('heading', { name: /send complete/ })).toHaveCount(0);
});
