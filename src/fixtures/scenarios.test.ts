import { describe, expect, it } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import { counterpartyLabel } from '@/lib/counterparty';
import { anchorLabel, buildProtectedSet, buildTrustAnchors } from '@/risk/anchors';
import { compareAddresses } from '@/risk/compare';
import { DEFAULT_RISK_CONFIG } from '@/risk/config';
import { evaluateRisk } from '@/risk/evaluate';
import { classifyHistoryEntry } from '@/risk/history';
import { buildNameBook, displayAddress } from '@/risk/names';
import type { Decision } from '@/risk/types';
import { LOOKALIKES, PEOPLE, SCENARIO_LIST, SCENARIOS } from './scenarios';

describe('fixture scenarios', () => {
  it('use distinct synthetic addresses', () => {
    const all = [...Object.values(PEOPLE).flat(), ...Object.values(LOOKALIKES)].map((a) =>
      a.toLowerCase(),
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it.each([
    ['luciaLookalike', PEOPLE.luciaLookalike, PEOPLE.lucia, 4, 4],
    ['landlordZeroValue', LOOKALIKES.landlordZeroValue, PEOPLE.landlord, 4, 5],
    ['luciaCounterfeit', LOOKALIKES.luciaCounterfeit, PEOPLE.lucia, 3, 4],
    ['luciaNewWallet', LOOKALIKES.luciaNewWallet, PEOPLE.lucia, 5, 4],
  ] as const)(
    '%s matches its target on exactly the intended characters',
    (_n, look, real, p, s) => {
      const c = compareAddresses(look, real);
      expect([c.prefixMatchLength, c.suffixMatchLength]).toEqual([p, s]);
    },
  );

  it('have unique entry ids', () => {
    for (const s of SCENARIO_LIST) {
      const ids = s.history.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // Each scenario's "try this" story, run through the real engine.
  it.each([
    ['clean-wallet', PEOPLE.lucia, 50, 'ALLOW'],
    ['dust-poisoning', PEOPLE.luciaLookalike, 50, 'BLOCK'],
    ['zero-value-poisoning', LOOKALIKES.landlordZeroValue, 250, 'BLOCK'],
    ['counterfeit-usdc', LOOKALIKES.luciaCounterfeit, 45, 'BLOCK'],
    // D23: no planting anywhere, still a BLOCK.
    ['address-change-message', LOOKALIKES.luciaNewWallet, 50, 'BLOCK'],
    ['new-recipient-large', PEOPLE.rosa, 200, 'WARN'],
    ['amount-anomaly', PEOPLE.lucia, 400, 'WARN'],
  ] as const)('%s: the suggested send gets %s', (id, recipient, amount, expected: Decision) => {
    const s = SCENARIOS[id];
    if (!s) throw new Error(id);
    const anchors = buildTrustAnchors(s.contacts, s.history, s.user.address, DEFAULT_RISK_CONFIG);
    const r = evaluateRisk({
      intent: {
        recipientInput: recipient,
        amount: BigInt(amount) * 1_000_000n,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        tokenContract: CANONICAL_USDC.address,
      },
      userAddress: s.user.address,
      anchors,
      history: s.history,
      historyAvailable: true,
      config: DEFAULT_RISK_CONFIG,
    });
    expect(r.decision).toBe(expected);
  });
});

describe('pasanaku scenario (D18)', () => {
  const s = SCENARIOS['pasanaku'];
  if (!s) throw new Error('pasanaku scenario missing');
  const pay = (contacts: typeof s.contacts) =>
    evaluateRisk({
      intent: {
        recipientInput: PEOPLE.rosa,
        amount: 50_000_000n,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        tokenContract: CANONICAL_USDC.address,
      },
      userAddress: s.user.address,
      anchors: buildTrustAnchors(contacts, s.history, s.user.address, DEFAULT_RISK_CONFIG),
      history: s.history,
      historyAvailable: true,
      config: DEFAULT_RISK_CONFIG,
    });

  it('a brand-new member gets the strongest WARN before the group is added', () => {
    const r = pay(s.contacts);
    expect(r.decision).toBe('WARN');
    expect(r.confirmation.level).toBe('middle-characters');
  });

  it('once the member is saved as a group contact, the monthly payment is ALLOW', () => {
    const rosa = {
      id: 'g-rosa',
      name: 'Rosa',
      address: PEOPLE.rosa,
      addedAt: 0,
      addedVia: 'pasted' as const,
      verifiedOutOfBand: false,
      group: 'Pasanaku Mayo',
    };
    expect(pay([...s.contacts, rosa]).decision).toBe('ALLOW');
  });
});

// D24: the list must never show a lookalike and the person it imitates the same way.
describe('history labels: a lookalike and its target never render the same label', () => {
  for (const s of SCENARIO_LIST) {
    it(s.id, () => {
      const names = buildNameBook(s.contacts, { ...s.names, [s.user.address]: 'you' });
      const anchors = buildTrustAnchors(s.contacts, s.history, s.user.address, DEFAULT_RISK_CONFIG);
      const protectedSet = buildProtectedSet(anchors, s.history, DEFAULT_RISK_CONFIG);
      let planted = 0;
      for (const entry of s.history) {
        const c = classifyHistoryEntry(entry, protectedSet, s.user.address, DEFAULT_RISK_CONFIG);
        if (c.kind !== 'suspected-poisoning') continue;
        planted += 1;
        const shown = counterpartyLabel(entry.counterparty, names);
        const target = counterpartyLabel(c.anchor.address, names);
        expect(shown.text).not.toBe(target.text);
        // A planted address is never named.
        expect(shown.kind).toBe('address');
        expect(anchorLabel(c.anchor, names)).not.toBe(shown.text);
      }
      if (s.kind === 'attack' && s.id !== 'address-change-message')
        expect(planted).toBeGreaterThan(0);
    });
  }

  it('every fixture lookalike differs from its target in the short form too', () => {
    const pairs = [
      [PEOPLE.luciaLookalike, PEOPLE.lucia],
      [LOOKALIKES.luciaCounterfeit, PEOPLE.lucia],
      [LOOKALIKES.luciaNewWallet, PEOPLE.lucia],
      [LOOKALIKES.landlordZeroValue, PEOPLE.landlord],
    ] as const;
    for (const [look, real] of pairs) expect(displayAddress(look)).not.toBe(displayAddress(real));
  });
});
