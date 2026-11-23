import { zeroAddress } from 'viem';
import type { Address } from 'viem';
import { describe, expect, it } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { HistoryEntry } from '@/domain/types';
import { DUST_POISONING_BASIC, PEOPLE } from '@/fixtures/scenarios';
import { buildTrustAnchors, isConfirmedUserSend } from './anchors';
import { DEFAULT_RISK_CONFIG } from './config';
import { evaluateRisk } from './evaluate';
import type { RiskInput } from './types';

const scenario = DUST_POISONING_BASIC;
const user = scenario.user.address;
const anchors = buildTrustAnchors(scenario.contacts, scenario.history, user);

function input(recipientInput: string, overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    intent: {
      recipientInput,
      amount: 10_000_000n,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      tokenContract: CANONICAL_USDC.address,
    },
    userAddress: user,
    anchors,
    history: scenario.history,
    historyAvailable: true,
    config: DEFAULT_RISK_CONFIG,
    ...overrides,
  };
}

describe('evaluateRisk (S1 policy)', () => {
  it('ALLOWs a trusted contact with no friction', () => {
    const r = evaluateRisk(input(PEOPLE.lucia));
    expect(r.decision).toBe('ALLOW');
    expect(r.reasons.map((x) => x.code)).toEqual(['TRUSTED_CONTACT']);
  });

  it('ALLOWs a trusted contact typed in lowercase', () => {
    expect(evaluateRisk(input(PEOPLE.lucia.toLowerCase())).decision).toBe('ALLOW');
  });

  it('BLOCKs the dust-planted lookalike and names the contact it imitates', () => {
    const r = evaluateRisk(input(PEOPLE.luciaLookalike));
    expect(r.decision).toBe('BLOCK');
    const reason = r.reasons[0];
    expect(reason?.code).toBe('LOOKALIKE_HIGH_CONFIDENCE');
    if (reason?.evidence.kind !== 'lookalike') throw new Error('expected lookalike evidence');
    expect(reason.evidence.anchor.address).toBe(PEOPLE.lucia);
    expect(reason.evidence.plantedVia.map((p) => p.technique)).toEqual(['dust']);
  });

  it('WARNs (not BLOCKs) a lookalike with no planting origin when history is available', () => {
    const r = evaluateRisk(input(PEOPLE.luciaLookalike, { history: [] }));
    expect(r.decision).toBe('WARN');
    expect(r.reasons[0]?.code).toBe('LOOKALIKE');
  });

  it('BLOCKs on the both-ends match alone when history is unavailable', () => {
    const r = evaluateRisk(input(PEOPLE.luciaLookalike, { history: [], historyAvailable: false }));
    expect(r.decision).toBe('BLOCK');
  });

  it('WARNs on a new recipient and flags large first sends', () => {
    const small = evaluateRisk(input(PEOPLE.mateo));
    expect(small.decision).toBe('WARN');
    expect(small.reasons[0]?.code).toBe('NEW_RECIPIENT');

    const base = input(PEOPLE.mateo);
    const large = evaluateRisk({
      ...base,
      intent: { ...base.intent, amount: DEFAULT_RISK_CONFIG.firstSendThreshold + 1n },
    });
    expect(large.reasons[0]?.code).toBe('NEW_RECIPIENT_LARGE_AMOUNT');
  });

  it.each([
    ['an invalid address', 'not-an-address', 'INVALID_ADDRESS'],
    ['the zero address', zeroAddress, 'ZERO_ADDRESS'],
    ['the token contract', CANONICAL_USDC.address, 'TOKEN_CONTRACT_AS_RECIPIENT'],
    ['the user own address', user, 'SELF_SEND'],
  ] as const)('BLOCKs %s', (_label, recipient, code) => {
    const r = evaluateRisk(input(recipient));
    expect(r.decision).toBe('BLOCK');
    expect(r.reasons.map((x) => x.code)).toContain(code);
  });

  it('BLOCKs the wrong network and the wrong token even for a trusted contact', () => {
    const base = input(PEOPLE.lucia);
    expect(evaluateRisk({ ...base, intent: { ...base.intent, chainId: 8453 } }).decision).toBe(
      'BLOCK',
    );
    const fakeToken: Address = '0x1111111111111111111111111111111111111111';
    expect(
      evaluateRisk({ ...base, intent: { ...base.intent, tokenContract: fakeToken } }).decision,
    ).toBe('BLOCK');
  });
});

describe('trust anchors', () => {
  it('uses contacts and signer-confirmed sends, never inbound transfers', () => {
    const addresses = anchors.map((a) => a.address);
    expect(addresses).toContain(PEOPLE.lucia);
    expect(addresses).not.toContain(PEOPLE.mateo); // inbound only
    expect(addresses).not.toContain(PEOPLE.luciaLookalike); // dust sender
  });

  it('does not treat a transfer "from" the user as a confirmed send unless the user signed it', () => {
    const real = scenario.history.find((e) => e.direction === 'out');
    if (!real) throw new Error('fixture needs an outgoing entry');
    const poisoned: HistoryEntry = {
      ...real,
      id: 'poison',
      to: PEOPLE.luciaLookalike,
      counterparty: PEOPLE.luciaLookalike,
      amount: 0n,
      txSigner: { status: 'known', address: PEOPLE.luciaLookalike, via: 'tx-from' },
    };
    expect(isConfirmedUserSend(poisoned, user)).toBe(false);
    // Even with a non-zero amount, an attacker-signed tx is not the user's send.
    expect(isConfirmedUserSend({ ...poisoned, amount: 5n }, user)).toBe(false);
    // An unknown signer is never enough.
    expect(isConfirmedUserSend({ ...real, txSigner: { status: 'unknown' } }, user)).toBe(false);
    // The real, user-signed send is confirmed.
    expect(isConfirmedUserSend(real, user)).toBe(true);
  });
});
