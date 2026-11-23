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
import { DEFAULT_RISK_CONFIG } from './config';
import { evaluateRisk } from './evaluate';
import { classifyHistoryEntry } from './history';
import type { RiskInput, TestSend } from './types';

const FRIEND = a('0f1e2d3c4b5a69788796a5b4c3d2e1f00a1b2c3d');
const LOOK = lookalikeOf(FRIEND, 4, 4);
const sisterAnchor: TrustAnchor = {
  kind: 'contact',
  address: SISTER,
  contact: contact('Lucía', SISTER),
};

const TEST: TestSend = { recipient: FRIEND, amount: 1_000_000n, blockNumber: 5_000n };
const testSendEntry = sendTo(FRIEND, 1_000_000n, 5_000n);

function withTest(recipient: string, history: RiskInput['history'], amount = 200_000_000n) {
  return {
    ...riskInput(recipient, { anchors: [sisterAnchor], history, amount }),
    testSends: [TEST],
  };
}

describe('test-send follow-up', () => {
  it('BLOCKs a dust lookalike of the test recipient that appeared after the test send', () => {
    const r = evaluateRisk(withTest(LOOK, [testSendEntry, dustFrom(LOOK, 5_002n)]));
    expect(r.decision).toBe('BLOCK');
    const reason = r.reasons[0];
    expect(reason?.code).toBe('LOOKALIKE_HIGH_CONFIDENCE');
    expect(reason?.explanation).toMatch(/right after your test send/);
    if (reason?.evidence.kind !== 'lookalike') throw new Error('expected lookalike evidence');
    expect(reason.evidence.anchor.address).toBe(FRIEND);
    expect(reason.evidence.plantedVia.map((p) => p.technique)).toContain('after-test-send');
  });

  it('BLOCKs even when the planting entry is not dust (mirrors the 1 USDC test amount)', () => {
    const mirror = entry({
      counterparty: LOOK,
      direction: 'in',
      amount: 1_000_000n,
      blockNumber: 5_003n,
    });
    const r = evaluateRisk(withTest(LOOK, [testSendEntry, mirror]));
    expect(r.decision).toBe('BLOCK');
  });

  it('does not apply the timing rule to a lookalike entry from BEFORE the test send', () => {
    const before = entry({
      counterparty: LOOK,
      direction: 'in',
      amount: 1_000_000n,
      blockNumber: 4_000n,
    });
    const r = evaluateRisk(withTest(LOOK, [before, testSendEntry]));
    // Ordinary first appearance: no timing evidence, but every lookalike is a BLOCK (D23).
    expect(r.decision).toBe('BLOCK');
    expect(r.reasons.map((x) => x.code)).toContain('LOOKALIKE');
  });

  it('ALLOWs the real send to the exact test-send recipient', () => {
    const r = evaluateRisk(withTest(FRIEND, [testSendEntry, dustFrom(LOOK, 5_002n)]));
    expect(r.decision).toBe('ALLOW');
    expect(r.reasons.map((x) => x.code)).toEqual(['CONFIRMED_PAST_RECIPIENT']);
  });

  it('a recorded test send counts as a recipient even before history shows it (demo, indexing lag)', () => {
    const r = evaluateRisk(withTest(FRIEND, []));
    expect(r.decision).toBe('ALLOW');
  });

  it('a recorded test send to an address that was itself planted does not become trusted', () => {
    const planted = lookalikeOf(SISTER, 5, 5);
    const r = evaluateRisk({
      ...riskInput(planted, { anchors: [sisterAnchor], history: [dustFrom(planted, 10n)] }),
      testSends: [{ recipient: planted, amount: 1_000_000n, blockNumber: 20n }],
    });
    expect(r.decision).toBe('BLOCK');
  });

  it('unrelated activity after a test send has no effect', () => {
    const unrelated = entry({
      counterparty: a('9999999999999999999999999999999999999999'),
      direction: 'in',
      blockNumber: 5_001n,
    });
    const r = evaluateRisk(withTest(FRIEND, [testSendEntry, unrelated]));
    expect(r.decision).toBe('ALLOW');
  });

  it('a pasted lookalike of the test recipient (nothing in history) is a BLOCK (D23)', () => {
    const r = evaluateRisk(withTest(LOOK, [testSendEntry]));
    expect(r.decision).toBe('BLOCK');
    expect(r.reasons.map((x) => x.code)).toContain('LOOKALIKE');
  });

  it('collapses the after-test entry in history as suspected poisoning', () => {
    const late = entry({
      counterparty: LOOK,
      direction: 'in',
      amount: 1_000_000n,
      blockNumber: 5_003n,
    });
    const anchors: TrustAnchor[] = [
      { kind: 'confirmed-recipient', address: FRIEND, evidenceTxHashes: [], lastSentAt: null },
    ];
    const c = classifyHistoryEntry(late, anchors, USER, DEFAULT_RISK_CONFIG, [TEST]);
    expect(c).toMatchObject({ kind: 'suspected-poisoning', technique: 'after-test-send' });
  });
});
