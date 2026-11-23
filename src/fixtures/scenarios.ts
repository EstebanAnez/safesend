import { getAddress, keccak256, toHex } from 'viem';
import type { Address, Hash } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { Contact, HistoryEntry, TxSigner } from '@/domain/types';

/**
 * Deterministic demo scenarios. Every address and hash here is synthetic:
 * hand-written hex for addresses, keccak256 of a label for tx hashes.
 * None of them refer to real people or real transactions.
 */

export interface DemoScenario {
  id: string;
  title: string;
  summary: string;
  user: { name: string; address: Address };
  contacts: readonly Contact[];
  history: readonly HistoryEntry[];
}

const addr = (hex: string): Address => getAddress(hex);
const txHash = (label: string): Hash => keccak256(toHex(`safesend-fixture:${label}`));

export const PEOPLE = {
  daniela: addr('0xd4a1e0b6c2f39a7845e1d0c3b9f27a6e5c4d8b19'),
  lucia: addr('0x7a3f9c21e4b8d05f6a1c3e9b2d47f80a5c16e4d2'),
  mateo: addr('0x5b0e2a9d7c4f61e83b2a0d9c5e7f14a36b8c2d07'),
  /** Attacker-generated: same first 4 and last 4 hex chars as Lucía. */
  luciaLookalike: addr('0x7a3f04b1d9e27c8a53f6b0e19d2c4a7f83b5e4d2'),
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
}

function usdcEntry(user: Address, spec: EntrySpec): HistoryEntry {
  const direction =
    spec.to.toLowerCase() === user.toLowerCase()
      ? 'in'
      : spec.from.toLowerCase() === user.toLowerCase()
        ? 'out'
        : 'unknown';
  const hash = txHash(spec.label);
  return {
    id: `${hash}:0`,
    source: 'fixture',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    tokenContract: CANONICAL_USDC.address,
    tokenSymbolClaimed: 'USDC',
    isCanonicalUsdc: true,
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

const luciaContact: Contact = {
  id: 'contact-lucia',
  name: 'Lucía (sister)',
  address: PEOPLE.lucia,
  addedAt: (T0 - 30 * 24 * 3600) * 1000,
  addedVia: 'pasted',
  verifiedOutOfBand: false,
};

export const DUST_POISONING_BASIC: DemoScenario = {
  id: 'dust-poisoning-basic',
  title: 'Dust poisoning after a real send',
  summary:
    'Daniela sends 50 USDC to her sister Lucía. Three minutes later a lookalike address sends her 0.001 USDC so it shows up in her history.',
  user: { name: 'Daniela', address: PEOPLE.daniela },
  contacts: [luciaContact],
  history: [
    usdcEntry(PEOPLE.daniela, {
      label: 'mateo-to-daniela',
      from: PEOPLE.mateo,
      to: PEOPLE.daniela,
      amount: 200_000_000n,
      signer: signedBy(PEOPLE.mateo),
      minutesAfterT0: 0,
      blockNumber: 30_000_000n,
    }),
    usdcEntry(PEOPLE.daniela, {
      label: 'daniela-to-lucia',
      from: PEOPLE.daniela,
      to: PEOPLE.lucia,
      amount: 50_000_000n,
      signer: signedBy(PEOPLE.daniela),
      minutesAfterT0: 90,
      blockNumber: 30_002_700n,
    }),
    usdcEntry(PEOPLE.daniela, {
      label: 'lookalike-dust-to-daniela',
      from: PEOPLE.luciaLookalike,
      to: PEOPLE.daniela,
      amount: 1_000n, // 0.001 USDC
      signer: signedBy(PEOPLE.luciaLookalike),
      minutesAfterT0: 93,
      blockNumber: 30_002_790n,
    }),
  ],
};

export const SCENARIOS: Readonly<Record<string, DemoScenario>> = {
  [DUST_POISONING_BASIC.id]: DUST_POISONING_BASIC,
};
