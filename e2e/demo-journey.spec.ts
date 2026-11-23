import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const LOOKALIKE = '0x7a3f04b1d9E27c8A53F6b0e19d2C4a7f83b5E4d2';

test('demo: planted lookalike is blocked, recovery sends to the contact (simulated)', async ({
  page,
}) => {
  await page.goto('/demo/dust-poisoning');

  // History shows the planted entry collapsed, with an explanation.
  await expect(page.getByText('Suspected lookalike')).toBeVisible();
  await expect(page.getByText(/Hidden: imitates Lucía/)).toBeVisible();

  // The user expands it and picks the lookalike as recipient.
  await page.getByRole('button', { name: /Show details of the suspected lookalike/ }).click();
  // Addresses keep their real casing (no text-transform on metadata).
  const suspicious = page.getByRole('listitem').filter({ hasText: 'Suspected lookalike' });
  const signer = suspicious.getByText(/Signed by/);
  await expect(signer).toBeVisible();
  expect(await signer.evaluate((el) => getComputedStyle(el).textTransform)).toBe('none');
  await page.getByRole('button', { name: new RegExp(`Use address ${LOOKALIKE}`, 'i') }).click();
  await expect(page.getByLabel('Recipient address')).toHaveValue(new RegExp(LOOKALIKE, 'i'));

  await page.getByLabel('Amount').fill('50');
  await page.getByRole('button', { name: 'Review send' }).click();

  // BLOCK with a reason and a character comparison.
  await expect(page.getByRole('heading', { name: 'SafeSend stopped this send' })).toBeVisible();
  // exact: the live region also carries the reason, for screen readers.
  await expect(
    page.getByText('This address imitates Lucía (sister)', { exact: true }),
  ).toBeVisible();
  // The full explanation is readable, never clamped mid-sentence.
  await expect(
    page.getByText(/not from someone you know. This is how address poisoning scams work./),
  ).toBeVisible();
  await expect(page.getByText(/first 4 and last 4 characters match Lucía/i)).toBeVisible();
  await expect(page.getByText(/cannot be overridden/)).toBeVisible();
  // No path forward to the blocked address.
  await expect(page.getByRole('button', { name: /^Send 50 USDC/ })).toHaveCount(0);

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);

  // Recovery: one tap to the trusted contact, which is ALLOWed with no friction.
  await page.getByRole('button', { name: /Send to Lucía \(sister\) instead/ }).click();
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
  await page.getByRole('button', { name: 'Send 50 USDC (simulated)' }).click();

  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeVisible();
  await expect(page.getByText('Demo mode: nothing was sent')).toBeVisible();
  await expect(page.getByText('50 USDC to Lucía (sister)', { exact: true })).toBeVisible();
});
