import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Mateo only ever SENT to Daniela: inbound history never makes an address trusted.
const MATEO = '0x5b0e2a9d7c4f61e83b2a0d9c5e7f14a36b8c2d07';

async function reviewMateo(page: Page, amount: string) {
  await page.goto('/demo/dust-poisoning');
  // History rows are collapsed: open one of Mateo's, then use its address.
  await page
    .getByRole('button', { name: /^Received from 0x5b0E…2D07/ })
    .first()
    .click();
  await page.getByRole('button', { name: new RegExp(`Use address ${MATEO}`, 'i') }).click();
  await page.getByLabel('Amount').fill(amount);
  await page.getByRole('button', { name: 'Review send' }).click();
  await expect(page.getByRole('heading', { name: 'Check before you send' })).toBeVisible();
}

test('small first send: light confirmation (checkbox)', async ({ page }) => {
  await reviewMateo(page, '10');
  const send = page.getByRole('button', { name: 'Send 10 USDC (simulated)' });
  await expect(send).toBeDisabled();
  await page.getByRole('checkbox', { name: /through another channel/ }).check();
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeVisible();
});

test('large first send: middle-character confirmation and test-send nudge', async ({ page }) => {
  await reviewMateo(page, '50');
  await expect(page.getByText('Try a small test send first')).toBeVisible();

  const input = page.getByRole('textbox', { name: /Type characters/ });
  const send = page.getByRole('button', { name: 'Send 50 USDC (simulated)' });

  // The old, attackable confirmation (last 4 characters) does not work.
  await input.fill(MATEO.slice(-4));
  await expect(send).toBeDisabled();

  // Read the randomly chosen positions from the label (1-based, counting "0x").
  const label =
    (await input.getAttribute('aria-label')) ??
    (await page
      .getByText(/Type characters/)
      .first()
      .innerText());
  const positions = [...label.matchAll(/\d+/g)].map((m) => Number(m[0]));
  expect(positions).toHaveLength(4);
  for (const p of positions) {
    expect(p).toBeGreaterThan(2 + 6); // never the first 6 hex characters
    expect(p).toBeLessThanOrEqual(2 + 34); // never the last 6
  }
  await input.fill(positions.map((p) => MATEO[p - 1]).join(''));
  await expect(send).toBeEnabled();

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);

  await send.click();
  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeVisible();
});

test('test-send nudge switches the amount to 1 USDC', async ({ page }) => {
  await reviewMateo(page, '50');
  await page.getByRole('button', { name: 'Send 1 USDC as a test' }).click();
  await expect(page.getByRole('button', { name: 'Send 1 USDC (simulated)' })).toBeVisible();
});

test('after a test send, the real send is steered away from history and goes through', async ({
  page,
}) => {
  await reviewMateo(page, '50');
  await page.getByRole('button', { name: 'Send 1 USDC as a test' }).click();
  // A 1 USDC first send gets the light confirmation.
  await page.getByRole('checkbox', { name: /through another channel/ }).check();
  await page.getByRole('button', { name: 'Send 1 USDC (simulated)' }).click();

  await expect(page.getByRole('heading', { name: 'Test send complete (simulated)' })).toBeVisible();
  await expect(page.getByText(/Do not copy the address from your activity/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send to Lucía (sister) (contact)' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Send the rest to the same address' }).click();
  await expect(page.getByLabel('Recipient address')).toHaveValue(new RegExp(MATEO, 'i'));
  await expect(page.getByText('You just made a test send')).toBeVisible();
  await page.getByLabel('Amount').fill('49');
  await page.getByRole('button', { name: 'Review send' }).click();

  // The tested address is now a confirmed recipient: no friction for the rest.
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeVisible();
});
