import { describe, expect, it } from 'vitest';
import type { TrustAnchor } from '@/domain/types';
import { a, contact, dustFrom, lookalikeOf, riskInput, SISTER } from '@/test/builders';
import { evaluateRisk } from './evaluate';
import { reverifySend } from './reverify';
import type { RiskInput } from './types';

const sisterAnchor: TrustAnchor = {
  kind: 'contact',
  address: SISTER,
  contact: contact('Lucía', SISTER),
};
const NEWCOMER = a('1234567890123456789012345678901234567890');

function reviewed(input: RiskInput) {
  return { intent: input.intent, result: evaluateRisk(input) };
}

describe('reverifySend', () => {
  const allowInput = riskInput(SISTER, { anchors: [sisterAnchor] });

  it('proceeds when nothing changed and the decision is ALLOW', () => {
    const r = reverifySend({
      reviewed: reviewed(allowInput),
      final: allowInput,
      confirmationSatisfied: false,
    });
    expect(r.ok).toBe(true);
  });

  it('accepts the same recipient written differently (normalization)', () => {
    const final = {
      ...allowInput,
      intent: { ...allowInput.intent, recipientInput: SISTER.toLowerCase() },
    };
    expect(
      reverifySend({ reviewed: reviewed(allowInput), final, confirmationSatisfied: false }).ok,
    ).toBe(true);
  });

  it.each([
    ['RECIPIENT_CHANGED', { recipientInput: NEWCOMER }],
    ['AMOUNT_CHANGED', { amount: 999n }],
    ['WRONG_NETWORK', { chainId: 8453 }],
    ['WRONG_TOKEN', { tokenContract: a('fa4e000000000000000000000000000000000000') }],
  ] as const)('aborts with %s', (failure, change) => {
    const final = { ...allowInput, intent: { ...allowInput.intent, ...change } };
    const r = reverifySend({ reviewed: reviewed(allowInput), final, confirmationSatisfied: true });
    expect(r).toMatchObject({ ok: false, failure });
  });

  it('aborts when the final check BLOCKs (e.g. poisoning landed after review)', () => {
    const look = lookalikeOf(SISTER, 5, 5);
    const before = riskInput(look, { anchors: [sisterAnchor], history: [] }); // WARN
    const after = { ...before, history: [dustFrom(look)] }; // now BLOCK
    const r = reverifySend({
      reviewed: reviewed(before),
      final: after,
      confirmationSatisfied: true,
    });
    expect(r).toMatchObject({ ok: false, failure: 'BLOCKED' });
  });

  it('aborts when an ALLOW became a WARN the user never saw', () => {
    const before = riskInput(NEWCOMER, {
      anchors: [
        { kind: 'confirmed-recipient', address: NEWCOMER, evidenceTxHashes: [], lastSentAt: null },
      ],
    });
    const after = { ...before, anchors: [] };
    const r = reverifySend({
      reviewed: reviewed(before),
      final: after,
      confirmationSatisfied: true,
    });
    expect(r).toMatchObject({ ok: false, failure: 'DECISION_CHANGED' });
  });

  it('aborts when the WARN confirmation level escalated', () => {
    const before = riskInput(NEWCOMER, { amount: 1_000_000n }); // acknowledge
    const after = {
      ...before,
      intent: { ...before.intent },
      config: { ...before.config, firstSendThreshold: 0n },
    }; // middle-characters
    const r = reverifySend({
      reviewed: reviewed(before),
      final: after,
      confirmationSatisfied: true,
    });
    expect(r).toMatchObject({ ok: false, failure: 'DECISION_CHANGED' });
  });

  it('requires the WARN to have been confirmed', () => {
    const input = riskInput(NEWCOMER);
    expect(
      reverifySend({ reviewed: reviewed(input), final: input, confirmationSatisfied: false }),
    ).toMatchObject({
      ok: false,
      failure: 'NOT_CONFIRMED',
    });
    expect(
      reverifySend({ reviewed: reviewed(input), final: input, confirmationSatisfied: true }).ok,
    ).toBe(true);
  });
});
