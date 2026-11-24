import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TrustAnchor } from '@/domain/types';
import { evaluateRisk } from '@/risk/evaluate';
import { a, contact, dustFrom, lookalikeOf, riskInput, SISTER } from '@/test/builders';
import { renderWithTheme } from '@/test/render';
import { DecisionPanel } from './DecisionPanel';

const sisterAnchor: TrustAnchor = {
  kind: 'contact',
  address: SISTER,
  contact: contact('Lucía', SISTER),
};
// Non-periodic on purpose: its last 4 chars must differ from any middle 4.
const NEWCOMER = a('0f1e2d3c4b5a69788796a5b4c3d2e1f00a1b2c3d');

function setup(result: ReturnType<typeof evaluateRisk>, recipient = NEWCOMER, random = () => 0) {
  const handlers = {
    onConfirm: vi.fn(),
    onRecover: vi.fn(),
    onCancel: vi.fn(),
    onUseTestAmount: vi.fn(),
  };
  renderWithTheme(
    <DecisionPanel
      result={result}
      recipient={recipient}
      amount={10_000_000n}
      random={random}
      {...handlers}
    />,
  );
  return handlers;
}

describe('DecisionPanel', () => {
  it('BLOCK: shows the recovery action and no way to send to the blocked address', async () => {
    const look = lookalikeOf(SISTER, 5, 5);
    const result = evaluateRisk(
      riskInput(look, { anchors: [sisterAnchor], history: [dustFrom(look)] }),
    );
    const { onRecover } = setup(result, look);

    expect(screen.queryByRole('button', { name: /^Send 10 USDC/ })).toBeNull();
    expect(screen.getByText(/cannot be overridden/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send to Lucía instead' }));
    expect(onRecover).toHaveBeenCalledWith(sisterAnchor);
  });

  it('BLOCK: only the blocking reason leads; other signals are folded away', async () => {
    const look = lookalikeOf(SISTER, 5, 5);
    // 50 USDC to a new address also raises "first send, large amount", a WARN-level signal.
    const result = evaluateRisk(
      riskInput(look, { amount: 50_000_000n, anchors: [sisterAnchor], history: [dustFrom(look)] }),
    );
    expect(result.reasons.some((r) => r.severity === 'warn')).toBe(true);
    setup(result, look);

    const reasons = screen.getByRole('list', { name: 'Reasons for this decision' });
    expect(within(reasons).getAllByRole('listitem')).toHaveLength(1);
    expect(within(reasons).getByText(/imitates Lucía/)).toBeInTheDocument();
    expect(screen.queryByText('First send to this address, and a large amount')).not.toBeVisible();

    const toggle = screen.getByRole('button', { name: 'Other signals (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByText('First send to this address, and a large amount')).toBeVisible();
  });

  it('light WARN: the send button stays disabled until the out-of-band checkbox is ticked', async () => {
    const result = evaluateRisk(riskInput(NEWCOMER));
    expect(result.confirmation.level).toBe('acknowledge');
    const { onConfirm } = setup(result);

    const send = screen.getByRole('button', { name: 'Send 10 USDC (simulated)' });
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /through another channel/ }));
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('middle-character WARN: the last 4 characters do not unlock it; the middle ones do', async () => {
    const result = evaluateRisk(riskInput(NEWCOMER, { amount: 10n ** 9n }));
    expect(result.confirmation.level).toBe('middle-characters');
    // random() = 0 picks the first 4 positions of the middle range: hex indexes 6..9.
    const { onConfirm } = setup(result, NEWCOMER, () => 0);

    const input = screen.getByRole('textbox', { name: /Type characters 9, 10, 11 and 12/ });
    const send = screen.getByRole('button', { name: 'Send 10 USDC (simulated)' });

    await userEvent.type(input, NEWCOMER.slice(-4));
    expect(send).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, NEWCOMER.slice(2 + 6, 2 + 10));
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('suggests a test send for a new recipient with a large amount', async () => {
    const result = evaluateRisk(riskInput(NEWCOMER, { amount: 10n ** 9n }));
    const { onUseTestAmount } = setup(result);
    expect(screen.getByText('Try a small test send first')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send 1 USDC as a test' }));
    expect(onUseTestAmount).toHaveBeenCalledOnce();
  });

  it('ALLOW: one tap to send, no confirmation', () => {
    const result = evaluateRisk(riskInput(SISTER, { anchors: [sisterAnchor] }));
    setup(result, SISTER);
    expect(screen.getByRole('button', { name: 'Send 10 USDC (simulated)' })).toBeEnabled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
