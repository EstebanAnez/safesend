import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import type { TrustAnchor } from '@/domain/types';
import {
  a,
  contact,
  dustFrom,
  entry,
  lookalikeOf,
  riskInput,
  sendTo,
  SISTER,
  USER,
} from '@/test/builders';
import { buildProtectedSet, buildTrustAnchors } from './anchors';
import { compareAddresses, isLookalike } from './compare';
import { DEFAULT_RISK_CONFIG } from './config';
import { evaluateRisk } from './evaluate';
import type { LookalikeRule, RiskConfig } from './types';

const SON = a('5b0e2a9d7c4f61e83b2a0d9c5e7f14a36b8c2d07');
const sisterAnchor: TrustAnchor = {
  kind: 'contact',
  address: SISTER,
  contact: contact('Lucía', SISTER),
};
const fromSon = (amount = 200_000_000n, blockNumber?: bigint) =>
  entry({
    counterparty: SON,
    direction: 'in',
    amount,
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  });

describe('lookalike rule: total matched characters', () => {
  const total: LookalikeRule = { kind: 'total', minTotal: 6, minEachEnd: 2 };
  /** Same first p and last s chars as base, every other char different. */
  const look = (p: number, s: number) =>
    getAddress(
      `0x${Array.from(SISTER.slice(2).toLowerCase(), (ch, i) =>
        i < p || i >= 40 - s ? ch : ch === 'f' ? '1' : 'f',
      ).join('')}`,
    );

  it.each([
    [2, 4, true], // users who only check the end
    [4, 2, true],
    [3, 3, true],
    [3, 4, true],
    [2, 3, false], // total 5
    [1, 6, false], // one end below the minimum
    [6, 1, false],
  ])('prefix %i / suffix %i => lookalike %s', (p, s, expected) => {
    const c = compareAddresses(look(p, s), SISTER);
    expect([c.prefixMatchLength, c.suffixMatchLength]).toEqual([p, s]);
    expect(isLookalike(c, total)).toBe(expected);
  });

  it('is configurable end to end', () => {
    const config: Partial<RiskConfig> = { lookalike: total };
    const r = evaluateRisk(
      riskInput(look(2, 4), { anchors: [sisterAnchor], history: [dustFrom(look(2, 4))], config }),
    );
    expect(r.decision).toBe('BLOCK');
    // The same case under the 3/4 default is not a lookalike.
    const d = evaluateRisk(
      riskInput(look(2, 4), { anchors: [sisterAnchor], history: [dustFrom(look(2, 4))] }),
    );
    expect(d.reasons.map((x) => x.code)).not.toContain('LOOKALIKE_HIGH_CONFIDENCE');
  });
});

describe('trust vs protection (D14)', () => {
  it('a verified inbound sender is protected but never trusted', () => {
    const history = [fromSon()];
    const trust = buildTrustAnchors([], history, USER, DEFAULT_RISK_CONFIG);
    expect(trust).toEqual([]);
    const protectedSet = buildProtectedSet(trust, history, DEFAULT_RISK_CONFIG);
    expect(protectedSet).toMatchObject([{ kind: 'inbound-sender', address: SON }]);

    // Sending to the son himself is NOT an ALLOW: he is not a trust anchor.
    const r = evaluateRisk(riskInput(SON, { history }));
    expect(r.decision).toBe('WARN');
    expect(r.reasons.map((x) => x.code)).toContain('NEW_RECIPIENT');
  });

  it('BLOCKs a dust-planted lookalike of an inbound sender', () => {
    const look = lookalikeOf(SON, 4, 4);
    const r = evaluateRisk(
      riskInput(look, { history: [fromSon(200_000_000n, 10n), dustFrom(look, 20n)] }),
    );
    expect(r.decision).toBe('BLOCK');
    const ev = r.reasons[0]?.evidence;
    if (ev?.kind !== 'lookalike') throw new Error('expected lookalike evidence');
    expect(ev.anchor).toMatchObject({ kind: 'inbound-sender', address: SON });
  });

  it.each([
    ['dust-sized', entry({ counterparty: SON, direction: 'in', amount: 1_000n })],
    [
      'unknown signer',
      entry({ counterparty: SON, direction: 'in', txSigner: { status: 'unknown' } }),
    ],
    [
      'signed by someone else',
      entry({
        counterparty: SON,
        direction: 'in',
        txSigner: { status: 'known', address: USER, via: 'tx-from' },
      }),
    ],
    ['counterfeit token', entry({ counterparty: SON, direction: 'in', isCanonicalUsdc: false })],
    [
      'unverified provenance',
      entry({ counterparty: SON, direction: 'in', provenance: 'inferred' }),
    ],
  ])('an inbound transfer that is %s does not protect its sender', (_label, e) => {
    expect(buildProtectedSet([], [e], DEFAULT_RISK_CONFIG)).toEqual([]);
  });

  it('respects the configurable minimum number of inbound transfers', () => {
    const history = [fromSon(200_000_000n, 1n), fromSon(200_000_000n, 2n)];
    const cfg = { ...DEFAULT_RISK_CONFIG, protectInboundMinTransfers: 3 };
    expect(buildProtectedSet([], history, cfg)).toEqual([]);
    expect(buildProtectedSet([], [...history, fromSon(1_000_000n, 3n)], cfg)).toHaveLength(1);
  });
});

describe('amount anomaly: per-recipient baseline (D11)', () => {
  const LANDLORD = a('1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d');
  // Sister: 50, 50, 60 (median 50). Landlord: 300 x3. Global median is 175.
  const history = [
    sendTo(SISTER, 50_000_000n),
    sendTo(SISTER, 50_000_000n),
    sendTo(SISTER, 60_000_000n),
    sendTo(LANDLORD, 300_000_000n),
    sendTo(LANDLORD, 300_000_000n),
    sendTo(LANDLORD, 300_000_000n),
  ];

  it('uses the per-recipient median when there is enough history with that person', () => {
    const r = evaluateRisk(
      riskInput(SISTER, { anchors: [sisterAnchor], history, amount: 400_000_000n }),
    );
    expect(r.decision).toBe('WARN');
    const ev = r.reasons.find((x) => x.code === 'AMOUNT_ANOMALY')?.evidence;
    expect(ev).toMatchObject({
      kind: 'amount',
      reference: 50_000_000n,
      referenceLabel: 'your usual send to this person',
    });
  });

  it('a usual rent payment is not anomalous even though it is far above the sister median', () => {
    const anchors = buildTrustAnchors([], history, USER, DEFAULT_RISK_CONFIG);
    const r = evaluateRisk(riskInput(LANDLORD, { anchors, history, amount: 300_000_000n }));
    expect(r.decision).toBe('ALLOW');
  });

  it('falls back to the global median for a recipient with too little history', () => {
    const NEW = a('0f1e2d3c4b5a69788796a5b4c3d2e1f00a1b2c3d');
    const r = evaluateRisk(
      riskInput(NEW, { history: [...history, sendTo(NEW, 10_000_000n)], amount: 900_000_000n }),
    );
    const ev = r.reasons.find((x) => x.code === 'AMOUNT_ANOMALY')?.evidence;
    expect(ev).toMatchObject({ kind: 'amount', referenceLabel: 'your median send' });
  });

  it('gives no signal without any baseline', () => {
    const r = evaluateRisk(
      riskInput(SISTER, {
        anchors: [sisterAnchor],
        history: history.slice(0, 2),
        amount: 10n ** 12n,
      }),
    );
    expect(r.decision).toBe('ALLOW');
  });
});
