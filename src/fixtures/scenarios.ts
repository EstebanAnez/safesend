import { getAddress, keccak256, toHex } from 'viem';
import type { Address, Hash } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { Contact, HistoryEntry, TxSigner } from '@/domain/types';

/**
 * Deterministic demo scenarios. Every address and hash here is synthetic:
 * hand-written hex for real people, derived lookalikes for attackers,
 * keccak256 of a label for tx hashes. None refer to real people or transactions.
 */

export interface DemoScenario {
  id: string;
  title: string;
  /** One sentence for the scenario picker. */
  tagline: string;
  summary: string;
  /** What to try, shown above the send form. */
  tryThis: string;
  kind: 'attack' | 'legit';
  user: { name: string; address: Address };
  contacts: readonly Contact[];
  history: readonly HistoryEntry[];
}

const addr = (hex: string): Address => getAddress(hex);
const txHash = (label: string): Hash => keccak256(toHex(`safesend-fixture:${label}`));
const HEX = '0123456789abcdef';

/**
 * A lookalike of `base`: exactly the first `p` and last `s` hex characters
 * match; every character in between differs from `base`.
 */
export function mimic(base: Address, p: number, s: number, seed: string): Address {
  const b = base.slice(2).toLowerCase();
  const fill = keccak256(toHex(`safesend-fixture-mimic:${seed}`)).slice(2);
  const out = Array.from(b, (ch, i) => {
    if (i < p || i >= 40 - s) return ch;
    const f = fill[i] ?? '0';
    return f === ch ? (HEX[(HEX.indexOf(ch) + 1) % 16] ?? '0') : f;
  });
  return getAddress(`0x${out.join('')}`);
}

export const PEOPLE = {
  daniela: addr('0xd4a1e0b6c2f39a7845e1d0c3b9f27a6e5c4d8b19'),
  lucia: addr('0x7a3f9c21e4b8d05f6a1c3e9b2d47f80a5c16e4d2'),
  mateo: addr('0x5b0e2a9d7c4f61e83b2a0d9c5e7f14a36b8c2d07'),
  landlord: addr('0x3c8d1f7a5e902b4c6d8e1a3f5b7c9d0e2f4a6b81'),
  rosa: addr('0x9e4b27c1d5a83f60b2e7c94d1a58f3e06b7d2c45'),
  carmen: addr('0x3f1c8e5a07b9d24e6c1a8f3b5d7e9c0a2b4d6f81'),
  /** Earlier pasanaku rounds: a different member each month. */
  pasanakuPast: [
    addr('0x61d0a7e3c95b28f4a0c7e1b3d5f9a2c4e6b8d0f1'),
    addr('0xa2c4e6b8d0f13579bdf02468ace13579bdf02468'),
    addr('0x48f2b6d0a4c8e2f6b0d4a8c2e6f0b4d8a2c6e0f4'),
  ],
  attacker: addr('0xbad0c0ffee5a1e0ddba11b0a7f00d5eed0bad000'),
  fakeUsdc: addr('0xfa4e05dc0000c0a11ed00000000000000000f4e5'),
  /** Attacker-generated: same first 4 and last 4 hex chars as Lucía. */
  luciaLookalike: addr('0x7a3f04b1d9e27c8a53f6b0e19d2c4a7f83b5e4d2'),
} as const;

export const LOOKALIKES = {
  landlordZeroValue: mimic(PEOPLE.landlord, 4, 5, 'landlord-zero'),
  luciaCounterfeit: mimic(PEOPLE.lucia, 3, 4, 'lucia-counterfeit'),
  /** Sent in a "my address changed" message. Never appears in history. */
  luciaNewWallet: mimic(PEOPLE.lucia, 5, 4, 'lucia-new-wallet'),
} as const;

/** 2026-11-20 14:00 UTC. Fixed so the demo and tests never drift. */
const T0 = 1_795_183_200;

interface EntrySpec {
  label: string;
  from: Address;
  to: Address;
  amount: bigint;
  signer: TxSigner;
  minutesAfterT0: number;
  blockNumber: bigint;
  token?: { contract: Address; symbol: string };
}

function transfer(user: Address, spec: EntrySpec): HistoryEntry {
  const direction =
    spec.to.toLowerCase() === user.toLowerCase()
      ? 'in'
      : spec.from.toLowerCase() === user.toLowerCase()
        ? 'out'
        : 'unknown';
  const hash = txHash(spec.label);
  const tokenContract = spec.token?.contract ?? CANONICAL_USDC.address;
  return {
    id: `${hash}:0`,
    source: 'fixture',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    tokenContract,
    tokenSymbolClaimed: spec.token?.symbol ?? 'USDC',
    isCanonicalUsdc: tokenContract === CANONICAL_USDC.address,
    direction,
    from: spec.from,
    to: spec.to,
    counterparty: direction === 'in' ? spec.from : spec.to,
    amount: spec.amount,
    tokenDecimals: CANONICAL_USDC.decimals,
    txHash: hash,
    logIndex: 0,
    txSigner: spec.signer,
    blockNumber: spec.blockNumber,
    blockTime: T0 + spec.minutesAfterT0 * 60,
    provenance: 'verified',
    confidence: 'high',
  };
}

const signedBy = (address: Address): TxSigner => ({ status: 'known', address, via: 'tx-from' });
const usdc = (n: number) => BigInt(Math.round(n * 1_000_000));
const DAY = 24 * 60;

const luciaContact: Contact = {
  id: 'contact-lucia',
  name: 'Lucía (sister)',
  address: PEOPLE.lucia,
  addedAt: (T0 - 60 * 24 * 3600) * 1000,
  addedVia: 'pasted',
  verifiedOutOfBand: true,
};

/**
 * Daniela's ordinary month-to-month life: her son sends money, she pays her
 * sister (40-60 USDC) and her landlord (250 USDC).
 */
function ordinaryLife(prefix: string): HistoryEntry[] {
  const d = PEOPLE.daniela;
  const months = [0, 1, 2];
  return months.flatMap((m) => [
    transfer(d, {
      label: `${prefix}-mateo-${m}`,
      from: PEOPLE.mateo,
      to: d,
      amount: usdc(300),
      signer: signedBy(PEOPLE.mateo),
      minutesAfterT0: -90 * DAY + m * 30 * DAY,
      blockNumber: 29_000_000n + BigInt(m) * 1_000_000n,
    }),
    transfer(d, {
      label: `${prefix}-lucia-${m}`,
      from: d,
      to: PEOPLE.lucia,
      amount: usdc([40, 50, 45][m] ?? 50),
      signer: signedBy(d),
      minutesAfterT0: -88 * DAY + m * 30 * DAY,
      blockNumber: 29_000_100n + BigInt(m) * 1_000_000n,
    }),
    transfer(d, {
      label: `${prefix}-rent-${m}`,
      from: d,
      to: PEOPLE.landlord,
      amount: usdc(250),
      signer: signedBy(d),
      minutesAfterT0: -87 * DAY + m * 30 * DAY,
      blockNumber: 29_000_200n + BigInt(m) * 1_000_000n,
    }),
  ]);
}

const base = {
  user: { name: 'Daniela', address: PEOPLE.daniela },
  contacts: [luciaContact],
} as const;

export const CLEAN_WALLET: DemoScenario = {
  ...base,
  id: 'clean-wallet',
  kind: 'legit',
  title: 'Clean wallet',
  tagline: 'Paying her sister as usual: no friction.',
  summary:
    'Daniela receives money from her son Mateo and sends some to her sister Lucía every month. Nothing suspicious in her history.',
  tryThis: 'Send 50 USDC to Lucía from your contacts. It should go straight through.',
  history: ordinaryLife('clean'),
};

export const DUST_POISONING_BASIC: DemoScenario = {
  ...base,
  id: 'dust-poisoning',
  kind: 'attack',
  title: 'Dust poisoning',
  tagline: 'A tiny transfer plants a fake "Lucía" next to her real payment.',
  summary:
    'Minutes after Daniela pays Lucía, an address that starts and ends like Lucía’s sends her 0.001 USDC so it shows up right next to her real payment to Lucía.',
  tryThis: 'Open the hidden entry, use it as the recipient, and try to send 50 USDC.',
  history: [
    ...ordinaryLife('dust'),
    transfer(PEOPLE.daniela, {
      label: 'dust-lookalike',
      from: PEOPLE.luciaLookalike,
      to: PEOPLE.daniela,
      amount: 1_000n,
      signer: signedBy(PEOPLE.luciaLookalike),
      minutesAfterT0: -88 * DAY + 60 * DAY + 3,
      blockNumber: 31_000_190n,
    }),
  ],
};

export const ZERO_VALUE_POISONING: DemoScenario = {
  ...base,
  id: 'zero-value-poisoning',
  kind: 'attack',
  title: 'Zero-value poisoning',
  tagline: 'A fake "you sent 0 USDC to your landlord" entry appears.',
  summary:
    'Right after Daniela pays rent, an attacker makes a 0 USDC transfer that shows Daniela as the sender and a lookalike of her landlord as the recipient. It looks exactly like one of her own payments.',
  tryThis: 'Copy the landlord address from the newest "sent" entry and pay 250 USDC rent.',
  history: [
    ...ordinaryLife('zero'),
    transfer(PEOPLE.daniela, {
      label: 'zero-value-lookalike',
      from: PEOPLE.daniela,
      to: LOOKALIKES.landlordZeroValue,
      amount: 0n,
      signer: signedBy(PEOPLE.attacker),
      minutesAfterT0: -87 * DAY + 60 * DAY + 4,
      blockNumber: 31_000_290n,
    }),
  ],
};

export const COUNTERFEIT_USDC: DemoScenario = {
  ...base,
  id: 'counterfeit-usdc',
  kind: 'attack',
  title: 'Counterfeit USDC',
  tagline: 'A fake token called "USDC" arrives from a lookalike of Lucía.',
  summary:
    'A token contract that only claims to be USDC sends Daniela 45 "USDC" from an address that looks like Lucía’s, matching her real payment amount.',
  tryThis: 'Use the address from the counterfeit entry and send 45 USDC.',
  history: [
    ...ordinaryLife('counterfeit'),
    transfer(PEOPLE.daniela, {
      label: 'counterfeit-usdc',
      from: LOOKALIKES.luciaCounterfeit,
      to: PEOPLE.daniela,
      amount: usdc(45),
      signer: signedBy(PEOPLE.attacker),
      minutesAfterT0: -88 * DAY + 60 * DAY + 5,
      blockNumber: 31_000_191n,
      token: { contract: PEOPLE.fakeUsdc, symbol: 'USDC' },
    }),
  ],
};

export const NEW_RECIPIENT_LARGE: DemoScenario = {
  ...base,
  id: 'new-recipient-large',
  kind: 'legit',
  title: 'New recipient, large amount',
  tagline: 'A first payment of 200 USDC to someone new.',
  summary:
    'Daniela is paying Rosa, a new member of her pasanaku savings group, for the first time. The address came from the group chat.',
  tryThis: `Paste Rosa’s address (${PEOPLE.rosa}) and send 200 USDC. Then try the test-send suggestion.`,
  history: ordinaryLife('newrecipient'),
};

export const AMOUNT_ANOMALY: DemoScenario = {
  ...base,
  id: 'amount-anomaly',
  kind: 'legit',
  title: 'Unusual amount',
  tagline: '400 USDC to her sister, who usually gets 40 to 50.',
  summary:
    'Lucía is a trusted contact, but Daniela usually sends her 40 to 50 USDC. Today someone on the phone says Lucía urgently needs 400.',
  tryThis: 'Send 400 USDC to Lucía from your contacts.',
  history: ordinaryLife('anomaly'),
};

export const PASANAKU: DemoScenario = {
  ...base,
  id: 'pasanaku',
  kind: 'legit',
  title: 'Pasanaku (savings group)',
  tagline: 'A new group member every month, without warning fatigue.',
  summary:
    'Daniela is in a pasanaku, a rotating savings group: every month she sends 50 USDC to a different member, using addresses shared in the group chat. This month the group is Rosa and Carmen.',
  tryThis: `First, paste Rosa’s address (${PEOPLE.rosa}) and review a 50 USDC send: a brand-new address gets the strongest confirmation. Then go back, use "Add group" to save "Pasanaku Mayo" with Rosa and Carmen (${PEOPLE.carmen}), and pay Rosa from your contacts.`,
  history: [
    ...ordinaryLife('pasanaku'),
    ...PEOPLE.pasanakuPast.map((member, i) =>
      transfer(PEOPLE.daniela, {
        label: `pasanaku-round-${i}`,
        from: PEOPLE.daniela,
        to: member,
        amount: usdc(50),
        signer: signedBy(PEOPLE.daniela),
        minutesAfterT0: -85 * DAY + i * 30 * DAY,
        blockNumber: 29_000_300n + BigInt(i) * 1_000_000n,
      }),
    ),
  ],
};

/**
 * D23: nothing is planted on-chain. The lookalike arrives in a message, so
 * provenance has nothing to say; the match itself is the evidence.
 */
export const ADDRESS_CHANGE_MESSAGE: DemoScenario = {
  ...base,
  id: 'address-change-message',
  kind: 'attack',
  title: '“My address changed”',
  tagline: 'A message from “Lucía” with a new wallet address. Nothing in her history.',
  summary:
    'Daniela gets a WhatsApp message from a number she doesn’t know: “Hi, it’s Lucía, I lost my phone and changed wallets. Send this month’s money here.” The new address starts and ends like Lucía’s. Nothing was planted in her history.',
  tryThis: `Paste the address from the message (${LOOKALIKES.luciaNewWallet}) and try to send 50 USDC.`,
  history: ordinaryLife('address-change'),
};

export const SCENARIO_LIST: readonly DemoScenario[] = [
  CLEAN_WALLET,
  DUST_POISONING_BASIC,
  ZERO_VALUE_POISONING,
  COUNTERFEIT_USDC,
  ADDRESS_CHANGE_MESSAGE,
  NEW_RECIPIENT_LARGE,
  AMOUNT_ANOMALY,
  PASANAKU,
];

export const SCENARIOS: Readonly<Record<string, DemoScenario>> = Object.fromEntries(
  SCENARIO_LIST.map((s) => [s.id, s]),
);
