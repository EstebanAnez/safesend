import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import type { Locator, Page } from './fixtures';

/**
 * The full journey with the keyboard alone: no clicks, no fills. Every control
 * is reached with Tab (or Shift+Tab) and used with Enter, Space or typing.
 * Also checks that focus lands on each new panel and what the live region says.
 */

// EIP-55 checksummed: typing it must parse as a valid address.
const LOOKALIKE = '0x7a3f04b1d9E27C8a53f6B0E19d2c4A7F83b5e4d2';
const ROSA = '0x9e4b27c1d5a83f60b2e7c94d1a58f3e06b7d2c45';
const CARMEN = '0x3f1c8e5a07b9d24e6c1a8f3b5d7e9c0a2b4d6f81';

declare global {
  interface Window {
    __announcements: string[];
  }
}

test.beforeEach(async ({ page }) => {
  // Record every message that passes through the polite live region (CDS clears it after 500 ms).
  await page.addInitScript(() => {
    window.__announcements = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[data-testid="cds-accessibility-announcer"]')) {
        const text = el.textContent?.trim();
        if (text && window.__announcements.at(-1) !== text) window.__announcements.push(text);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
});

/** Press Tab until `target` has focus. Fails if it is not reachable in `max` presses. */
async function tabTo(page: Page, target: Locator, { max = 80, back = false } = {}) {
  await expect(target).toBeVisible();
  for (let i = 0; i <= max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Not reachable with ${back ? 'Shift+Tab' : 'Tab'} in ${max} presses: ${target}`);
}

async function typeInto(page: Page, field: Locator, text: string) {
  await tabTo(page, field);
  await page.keyboard.type(text);
}

async function announcements(page: Page) {
  return page.evaluate(() => window.__announcements);
}

test('keyboard only: planted lookalike is blocked, recovery sends to the contact', async ({
  page,
}) => {
  await page.goto('/demo');
  await tabTo(page, page.getByRole('link', { name: 'Dust poisoning' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Dust poisoning' })).toBeVisible();

  // Open the hidden entry and use its address.
  await tabTo(page, page.getByRole('button', { name: /Show details of the suspected lookalike/ }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: `Use address ${LOOKALIKE} as recipient` }));
  await page.keyboard.press('Enter');
  const recipient = page.getByLabel('Recipient address');
  await expect(recipient).toBeFocused();
  await expect(recipient).toHaveValue(LOOKALIKE);

  await typeInto(page, page.getByLabel('Amount'), '50');
  await page.keyboard.press('Enter');

  // Focus moves to the decision; the live region gives the reason.
  await expect(page.getByRole('heading', { name: 'SafeSend stopped this send' })).toBeFocused();
  await expect
    .poll(() => announcements(page))
    .toContainEqual(
      expect.stringMatching(/^Blocked\. This send cannot go ahead\. .*imitates Lucía/),
    );
  await expect(page.getByRole('button', { name: /^Send 50 USDC/ })).toHaveCount(0);

  await tabTo(page, page.getByRole('button', { name: 'Send to Lucía (sister) instead' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeFocused();

  await tabTo(page, page.getByRole('button', { name: 'Send 50 USDC (simulated)' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeFocused();
  await expect
    .poll(() => announcements(page))
    .toContainEqual(
      expect.stringMatching(/^Simulated send complete: 50 USDC to Lucía \(sister\)\./),
    );
  // The page keeps its h1 after the send.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dust poisoning');
});

test('keyboard only: WARN middle-character challenge', async ({ page }) => {
  await page.goto('/demo/new-recipient-large');
  await typeInto(page, page.getByLabel('Recipient address'), ROSA);
  await typeInto(page, page.getByLabel('Amount'), '200');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Check before you send' })).toBeFocused();
  await expect
    .poll(() => announcements(page))
    .toContainEqual(expect.stringMatching(/^Check needed before you send\./));

  const challenge = page.getByRole('textbox', { name: /Type characters/ });
  const label = await page
    .getByText(/^Type characters/)
    .first()
    .innerText();
  const positions = [...label.matchAll(/\d+/g)].map((m) => Number(m[0]));
  expect(positions).toHaveLength(4);
  await typeInto(page, challenge, positions.map((p) => ROSA[p - 1]).join(''));

  const send = page.getByRole('button', { name: 'Send 200 USDC (simulated)' });
  await expect(send).toBeEnabled();
  await tabTo(page, send);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Simulated send complete' })).toBeFocused();
});

test('keyboard only: add a group (pasanaku), then pay a member', async ({ page }) => {
  await page.goto('/demo/pasanaku');
  await tabTo(page, page.getByRole('button', { name: 'Add group' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Add a group' })).toBeFocused();

  await typeInto(page, page.getByLabel('Group name'), 'Pasanaku Mayo');
  await typeInto(page, page.getByLabel('Member 1 name'), 'Rosa');
  await typeInto(page, page.getByLabel('Member 1 full address'), ROSA);
  await tabTo(page, page.getByRole('checkbox', { name: /Rosa's address directly from them/ }));
  await page.keyboard.press('Space');
  await typeInto(page, page.getByLabel('Member 2 name'), 'Carmen');
  await typeInto(page, page.getByLabel('Member 2 full address'), CARMEN);

  // Saving without Carmen's confirmation fails, and says so.
  await tabTo(page, page.getByRole('button', { name: 'Save group' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Not saved yet' })).toBeVisible();

  await tabTo(page, page.getByRole('checkbox', { name: /Carmen's address directly from them/ }), {
    back: true,
  });
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('button', { name: 'Save group' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Pasanaku Mayo saved: 2 contacts')).toBeFocused();

  await tabTo(page, page.getByRole('button', { name: 'Send to Rosa' }));
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Amount')).toBeFocused();
  await page.keyboard.type('50');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Ready to send' })).toBeFocused();
});

test('keyboard only: "This is a different person" never resumes the blocked send', async ({
  page,
}) => {
  await page.goto('/demo/dust-poisoning');
  await tabTo(page, page.getByRole('button', { name: /Show details of the suspected lookalike/ }));
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByRole('button', { name: `Use address ${LOOKALIKE} as recipient` }));
  await page.keyboard.press('Enter');
  await typeInto(page, page.getByLabel('Amount'), '50');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'SafeSend stopped this send' })).toBeFocused();

  await tabTo(page, page.getByRole('button', { name: 'This is a different person' }));
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Add a different person as a contact' }),
  ).toBeFocused();
  await expect(page.getByLabel('Full address')).toHaveValue('');

  await typeInto(page, page.getByLabel('Name'), 'Someone else');
  await typeInto(page, page.getByLabel('Full address'), LOOKALIKE);
  await expect(page.getByText(/This looks like Lucía/)).toBeVisible();
  await typeInto(page, page.getByLabel('Type or paste the full address again'), LOOKALIKE);
  await tabTo(page, page.getByRole('checkbox', { name: /through another channel/ }));
  await page.keyboard.press('Space');
  await tabTo(page, page.getByRole('button', { name: 'Save contact' }));
  await page.keyboard.press('Enter');

  await expect(page.getByText('Someone else saved as a contact')).toBeFocused();
  await expect(page.getByText('The blocked send stays cancelled.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Recipient address')).toHaveValue('');
});

test('keyboard only: history outage, retry, and the states are announced', async ({ page }) => {
  await page.goto('/demo/dust-poisoning');
  await expect(page.getByRole('list', { name: /USDC activity/ })).toBeVisible();

  // Radio group: Tab into it, arrow keys to choose.
  await tabTo(page, page.getByRole('radio', { name: 'Normal' }));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /Outage/ })).toBeChecked();

  await expect(page.getByText('Could not load activity', { exact: true })).toBeVisible();
  await expect
    .poll(() => announcements(page))
    .toContainEqual(expect.stringMatching(/^Could not load activity\./));
  await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
    .then((r) => expect(r.violations).toEqual([]));

  await tabTo(page, page.getByRole('button', { name: 'Try again' }), { back: true });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('list', { name: /USDC activity/ })).toBeVisible();
  await expect
    .poll(() => announcements(page))
    .toContainEqual(expect.stringMatching(/^Activity loaded: \d+ transfers\./));
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the sending spinner does not spin', async ({ page }) => {
    await page.goto('/demo/clean-wallet');
    await tabTo(page, page.getByRole('button', { name: 'Send to Lucía (sister)' }));
    await page.keyboard.press('Enter');
    await page.keyboard.type('50');
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: 'Send 50 USDC (simulated)' }));
    await page.keyboard.press('Enter');
    const spinner = page.getByRole('status').filter({ hasText: 'Sending 50 USDC (simulated)' });
    await expect(spinner).toBeVisible();
    const duration = await spinner.evaluate((el) =>
      parseFloat(getComputedStyle(el).animationDuration),
    );
    expect(duration).toBeLessThan(0.01);
  });
});
