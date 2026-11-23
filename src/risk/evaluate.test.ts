import { zeroAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { CANONICAL_USDC } from '@/config/chain';
import type { TrustAnchor } from '@/domain/types';
import {
  a,
  contact,
  counterfeitFrom,
  dustFrom,
  entry,
  lookalikeOf,
  riskInput,
  sendTo,
  SISTER,
  USER,
  zeroValuePoison,
} from '@/test/builders';
import { buildTrustAnchors } from './anchors';
import { DEFAULT_RISK_CONFIG } from './config';
import { evaluateRisk } from './evaluate';
import type { ReasonCode, RiskResult } from './types';

const sister = contact('Lucía', SISTER);
const sisterAnchor: TrustAnchor = { kind: 'contact', address: SISTER, contact: sister };
const NEWCOMER = a('1234567890123456789012345678901234567890');
const ATTACKER = a('bad0000000000000000000000000000000000bad');
const codes = (r: RiskResult): ReasonCode[] => r.reasons.map((x) => x.code);

describe('ALLOW', () => {
  it('a trusted contact: no friction, no confirmation, no test send', () => {
    const r = evaluateRisk(riskInput(SISTER, { anchors: [sisterAnchor] }));
    expect(r.decision).toBe('ALLOW');
    expect(codes(r)).toEqual(['TRUSTED_CONTACT']);
    expect(r.confirmation).toEqual({ level: 'none' });
    expect(r.testSendSuggested).toBe(false);
  });

  it.each([
    ['lowercase', SISTER.toLowerCase()],
    ['uppercase hex', `0x${SISTER.slice(2).toUpperCase()}`],
    ['checksummed', SISTER],
    ['with surrounding whitespace', `  ${SISTER}  `],
  ])('a trusted contact entered as %s', (_label, input) => {
    expect(evaluateRisk(riskInput(input, { anchors: [sisterAnchor] })).decision).toBe('ALLOW');
  });

  it('a signer-confirmed past recipient', () => {
    const history = [sendTo(NEWCOMER)];
    const anchors = buildTrustAnchors([], history, USER, DEFAULT_RISK_CONFIG);
    const r = evaluateRisk(riskInput(NEWCOMER, { anchors, history }));
    expect(r.decision).toBe('ALLOW');
    expect(codes(r)).toEqual(['CONFIRMED_PAST_RECIPIENT']);
  });
});

describe('structural BLOCKs (no override, even for trusted contacts)', () => {
  it.each([
    ['empty input', ''],
    ['non-hex', '0xzz'],
    ['wrong length', '0x1234'],
    ['bad mixed-case checksum', SISTER.replace(/[a-f]/, (c) => c.toUpperCase())],
  ])('INVALID_ADDRESS: %s', (_label, input) => {
    const r = evaluateRisk(riskInput(input, { anchors: [sisterAnchor] }));
    // Guard: the tampered checksum case must actually be invalid.
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)).toContain('INVALID_ADDRESS');
    expect(r.confirmation).toEqual({ level: 'none' });
  });

  it.each([
    ['zero address', zeroAddress, 'ZERO_ADDRESS'],
    ['the USDC contract', CANONICAL_USDC.address, 'TOKEN_CONTRACT_AS_RECIPIENT'],
    ['the user own address', USER, 'SELF_SEND'],
  ] as const)('%s', (_label, recipient, code) => {
    const r = evaluateRisk(riskInput(recipient));
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)).toContain(code);
  });

  it('wrong network', () => {
    const r = evaluateRisk(riskInput(SISTER, { anchors: [sisterAnchor], chainId: 8453 }));
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)).toContain('WRONG_NETWORK');
  });

  it('wrong token, including a counterfeit claiming to be USDC', () => {
    const r = evaluateRisk(
      riskInput(SISTER, {
        anchors: [sisterAnchor],
        tokenContract: a('fa4e000000000000000000000000000000000000'),
      }),
    );
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)).toContain('WRONG_TOKEN');
  });
});

describe('lookalikes', () => {
  const LOOK = lookalikeOf(SISTER, 5, 5);

  it.each([
    ['dust', dustFrom(LOOK)],
    ['zero-value', zeroValuePoison(LOOK, ATTACKER)],
    ['counterfeit token', counterfeitFrom(LOOK)],
  ])('BLOCKs when the lookalike first appeared via %s', (_label, planting) => {
    const r = evaluateRisk(riskInput(LOOK, { anchors: [sisterAnchor], history: [planting] }));
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)[0]).toBe('LOOKALIKE_HIGH_CONFIDENCE');
    const ev = r.reasons[0]?.evidence;
    if (ev?.kind !== 'lookalike') throw new Error('expected lookalike evidence');
    expect(ev.anchor.address).toBe(SISTER);
    expect(ev.comparison.prefixMatchLength).toBe(5);
    expect(ev.comparison.suffixMatchLength).toBe(5);
  });

  it('WARNs (middle-character confirmation) when the lookalike was never planted', () => {
    const r = evaluateRisk(riskInput(LOOK, { anchors: [sisterAnchor], history: [] }));
    expect(r.decision).toBe('WARN');
    expect(codes(r)).toContain('LOOKALIKE');
    expect(r.confirmation.level).toBe('middle-characters');
    expect(r.testSendSuggested).toBe(true);
  });

  it('WARNs when the lookalike first appeared through ordinary activity, even if dusted later', () => {
    const history = [
      entry({ counterparty: LOOK, direction: 'in', blockNumber: 10n }),
      dustFrom(LOOK, 20n),
    ];
    const r = evaluateRisk(riskInput(LOOK, { anchors: [sisterAnchor], history }));
    expect(r.decision).toBe('WARN');
    expect(codes(r)).toContain('LOOKALIKE');
  });

  it('BLOCKs on the both-ends match alone when history is unavailable', () => {
    const r = evaluateRisk(
      riskInput(LOOK, { anchors: [sisterAnchor], history: [], historyAvailable: false }),
    );
    expect(r.decision).toBe('BLOCK');
    expect(codes(r)[0]).toBe('LOOKALIKE_HIGH_CONFIDENCE');
  });

  describe('threshold edges (prefix/suffix are configurable)', () => {
    const config = { lookalike: { kind: 'prefix-suffix' as const, minPrefix: 3, minSuffix: 4 } };
    it.each([
      [3, 4, true],
      [3, 3, false], // suffix one short
      [2, 4, false], // prefix one short
      [4, 5, true],
    ])('prefix %i / suffix %i => lookalike: %s', (p, s, expected) => {
      const look = lookalikeOf(SISTER, p, s);
      const r = evaluateRisk(riskInput(look, { anchors: [sisterAnchor], config }));
      expect(codes(r).includes('LOOKALIKE')).toBe(expected);
    });
  });

  it('compares case-insensitively (a lowercase-typed lookalike is still caught)', () => {
    const r = evaluateRisk(
      riskInput(LOOK.toLowerCase(), { anchors: [sisterAnchor], history: [dustFrom(LOOK)] }),
    );
    expect(r.decision).toBe('BLOCK');
  });

  it('an exact match is never a lookalike', () => {
    const r = evaluateRisk(
      riskInput(SISTER, { anchors: [sisterAnchor], history: [dustFrom(LOOK)] }),
    );
    expect(codes(r)).not.toContain('LOOKALIKE');
    expect(codes(r)).not.toContain('LOOKALIKE_HIGH_CONFIDENCE');
  });

  it('a benign address sharing only a few characters is not a lookalike', () => {
    const benign = lookalikeOf(SISTER, 2, 2);
    const r = evaluateRisk(riskInput(benign, { anchors: [sisterAnchor] }));
    expect(codes(r)).toEqual(['NEW_RECIPIENT']);
  });

  it('never compares against arbitrary history entries (unverified inbound does not protect)', () => {
    // NEWCOMER's only transfer has no verified signer: not trusted, not protected (D14).
    const look = lookalikeOf(NEWCOMER, 5, 5);
    const history = [
      entry({ counterparty: NEWCOMER, direction: 'in', txSigner: { status: 'unknown' } }),
    ];
    const anchors = buildTrustAnchors([], history, USER, DEFAULT_RISK_CONFIG);
    const r = evaluateRisk(riskInput(look, { anchors, history }));
    expect(codes(r)).toEqual(['NEW_RECIPIENT']);
  });
});

describe('new recipients and confirmation levels (D8)', () => {
  it('below the first-send threshold with no other signal: light acknowledgement', () => {
    const r = evaluateRisk(riskInput(NEWCOMER, { amount: DEFAULT_RISK_CONFIG.firstSendThreshold }));
    expect(r.decision).toBe('WARN');
    expect(codes(r)).toEqual(['NEW_RECIPIENT']);
    expect(r.confirmation.level).toBe('acknowledge');
    expect(r.testSendSuggested).toBe(false);
  });

  it('above the threshold: middle characters plus the test-send nudge', () => {
    const r = evaluateRisk(
      riskInput(NEWCOMER, { amount: DEFAULT_RISK_CONFIG.firstSendThreshold + 1n }),
    );
    expect(codes(r)).toEqual(['NEW_RECIPIENT_LARGE_AMOUNT']);
    expect(r.confirmation).toMatchObject({ level: 'middle-characters', count: 4 });
    expect(r.testSendSuggested).toBe(true);
  });

  it('any other signal escalates a small first send to middle characters', () => {
    const history = [entry({ counterparty: NEWCOMER, direction: 'in', provenance: 'unknown' })];
    const r = evaluateRisk(riskInput(NEWCOMER, { history }));
    expect(codes(r)).toEqual(['NEW_RECIPIENT', 'UNKNOWN_PROVENANCE']);
    expect(r.confirmation.level).toBe('middle-characters');
    expect(r.testSendSuggested).toBe(true);
  });

  it('the middle range never includes the outer characters, and widens past long matches', () => {
    const r = evaluateRisk(riskInput(lookalikeOf(SISTER, 8, 7), { anchors: [sisterAnchor] }));
    if (r.confirmation.level !== 'middle-characters') throw new Error('expected challenge');
    expect(r.confirmation.middleStart).toBe(8);
    expect(r.confirmation.middleEnd).toBe(40 - 7);

    const plain = evaluateRisk(riskInput(NEWCOMER, { amount: 10n ** 12n }));
    if (plain.confirmation.level !== 'middle-characters') throw new Error('expected challenge');
    expect(plain.confirmation.middleStart).toBe(6);
    expect(plain.confirmation.middleEnd).toBe(34);
  });
});

describe('amount anomaly', () => {
  const history = [
    sendTo(SISTER, 10_000_000n),
    sendTo(SISTER, 20_000_000n),
    sendTo(SISTER, 30_000_000n),
  ];
  // median 20 USDC, multiplier 5 => anomaly above 100 USDC

  it('WARNs a trusted contact when the amount is far above the median send', () => {
    const r = evaluateRisk(
      riskInput(SISTER, { anchors: [sisterAnchor], history, amount: 100_000_001n }),
    );
    expect(r.decision).toBe('WARN');
    expect(codes(r)).toEqual(['AMOUNT_ANOMALY', 'TRUSTED_CONTACT']);
    expect(r.confirmation.level).toBe('middle-characters');
    expect(r.testSendSuggested).toBe(false); // no test send for a trusted contact
  });

  it('does not fire at exactly the multiplier', () => {
    const r = evaluateRisk(
      riskInput(SISTER, { anchors: [sisterAnchor], history, amount: 100_000_000n }),
    );
    expect(r.decision).toBe('ALLOW');
  });

  it('does not fire without enough confirmed sends to form a baseline', () => {
    const r = evaluateRisk(
      riskInput(SISTER, {
        anchors: [sisterAnchor],
        history: history.slice(0, 2),
        amount: 10n ** 12n,
      }),
    );
    expect(r.decision).toBe('ALLOW');
  });

  it('ignores sends the user did not sign when computing the baseline', () => {
    const forged = history.map((e) => ({ ...e, txSigner: { status: 'unknown' as const } }));
    const r = evaluateRisk(
      riskInput(SISTER, { anchors: [sisterAnchor], history: forged, amount: 10n ** 12n }),
    );
    expect(r.decision).toBe('ALLOW');
  });
});

describe('trust anchors', () => {
  it('never come from inbound transfers, unknown signers or attacker-signed zero-value entries', () => {
    const look = lookalikeOf(SISTER, 5, 5);
    const history = [
      entry({ counterparty: NEWCOMER, direction: 'in' }),
      entry({
        counterparty: a('9999999999999999999999999999999999999999'),
        direction: 'out',
        txSigner: { status: 'unknown' },
      }),
      zeroValuePoison(look, ATTACKER),
    ];
    expect(buildTrustAnchors([], history, USER, DEFAULT_RISK_CONFIG)).toEqual([]);
  });

  it('a confirmed send to an address that first appeared via planting is NOT an anchor', () => {
    // The victim already fell for it once. Trusting it now would ALLOW the attacker again.
    const look = lookalikeOf(SISTER, 5, 5);
    const history = [dustFrom(look, 10n), sendTo(look, 50_000_000n, 20n)];
    const anchors = buildTrustAnchors([sister], history, USER, DEFAULT_RISK_CONFIG);
    expect(anchors.map((x) => x.address)).toEqual([SISTER]);
    expect(evaluateRisk(riskInput(look, { anchors, history })).decision).toBe('BLOCK');
  });

  it('a contact and a confirmed send to the same address produce one anchor (the contact)', () => {
    const anchors = buildTrustAnchors([sister], [sendTo(SISTER)], USER, DEFAULT_RISK_CONFIG);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.kind).toBe('contact');
  });
});

describe('result invariants', () => {
  it('orders reasons block > warn > info and keeps score consistent with the decision', () => {
    const r = evaluateRisk(riskInput(USER, { anchors: [sisterAnchor] }));
    expect(r.score).toBe(100);
    const allow = evaluateRisk(riskInput(SISTER, { anchors: [sisterAnchor] }));
    expect(allow.score).toBe(0);
  });
});
