import { getAddress, keccak256, toHex } from 'viem';
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { Contact, HistoryEntry } from '@/domain/types';
import { DEFAULT_RISK_CONFIG } from '@/risk/config';
import type { RiskConfig, RiskInput } from '@/risk/types';

/** Synthetic test addresses. `hex40` must be 40 hex chars. */
export const a = (hex40: string): Address => getAddress(`0x${hex40}`);

export const USER = a('d4a1e0b6c2f39a7845e1d0c3b9f27a6e5c4d8b19');
//            prefix 'abcde'                         suffix '98765'
export const SISTER = a('abcde00000000000000000000000000000098765');

/** Same first `p` and last `s` hex chars as SISTER, everything else different. */
export function lookalikeOf(target: Address, p: number, s: number): Address {
  const hex = target.slice(2).toLowerCase();
  const out = Array.from(hex, (ch, i) => {
    if (i < p || i >= 40 - s) return ch;
    // A different hex char at every other position.
    return ch === 'f' ? '1' : 'f';
  }).join('');
  return a(out);
}

let counter = 0;

export function entry(overrides: Partial<HistoryEntry> & { counterparty: Address }): HistoryEntry {
  counter += 1;
  const direction = overrides.direction ?? 'in';
  const from = overrides.from ?? (direction === 'out' ? USER : overrides.counterparty);
  const to = overrides.to ?? (direction === 'out' ? overrides.counterparty : USER);
  const txHash = overrides.txHash ?? keccak256(toHex(`test-${counter}`));
  return {
    id: `${txHash}:${overrides.logIndex ?? 0}`,
    source: 'fixture',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    tokenContract: CANONICAL_USDC.address,
    tokenSymbolClaimed: 'USDC',
    isCanonicalUsdc: true,
    from,
    to,
    amount: 10_000_000n,
    tokenDecimals: 6,
    txHash,
    logIndex: 0,
    txSigner: { status: 'known', address: from, via: 'tx-from' },
    blockNumber: BigInt(1_000 + counter),
    blockTime: 1_795_183_200 + counter * 60,
    provenance: 'verified',
    confidence: 'high',
    ...overrides,
    direction,
  };
}

/** A real, user-signed USDC send. */
export const sendTo = (to: Address, amount = 10_000_000n, blockNumber?: bigint) =>
  entry({
    counterparty: to,
    direction: 'out',
    amount,
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  });

export const dustFrom = (from: Address, blockNumber?: bigint) =>
  entry({
    counterparty: from,
    direction: 'in',
    amount: 1_000n,
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  });

export const zeroValuePoison = (lookalike: Address, attacker: Address, blockNumber?: bigint) =>
  entry({
    counterparty: lookalike,
    direction: 'out',
    from: USER,
    to: lookalike,
    amount: 0n,
    txSigner: { status: 'known', address: attacker, via: 'tx-from' },
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  });

export const counterfeitFrom = (from: Address, blockNumber?: bigint) =>
  entry({
    counterparty: from,
    direction: 'in',
    amount: 50_000_000n,
    tokenContract: a('fa4e000000000000000000000000000000000000'),
    tokenSymbolClaimed: 'USDC',
    isCanonicalUsdc: false,
    ...(blockNumber !== undefined ? { blockNumber } : {}),
  });

export function contact(name: string, address: Address): Contact {
  return {
    id: `contact-${name}`,
    name,
    address,
    addedAt: 0,
    addedVia: 'typed',
    verifiedOutOfBand: false,
  };
}

export function riskInput(
  recipientInput: string,
  opts: {
    amount?: bigint;
    anchors?: RiskInput['anchors'];
    history?: readonly HistoryEntry[];
    historyAvailable?: boolean;
    config?: Partial<RiskConfig>;
    chainId?: number;
    tokenContract?: Address;
  } = {},
): RiskInput {
  return {
    intent: {
      recipientInput,
      amount: opts.amount ?? 10_000_000n,
      chainId: opts.chainId ?? BASE_SEPOLIA_CHAIN_ID,
      tokenContract: opts.tokenContract ?? CANONICAL_USDC.address,
    },
    userAddress: USER,
    anchors: opts.anchors ?? [],
    history: opts.history ?? [],
    historyAvailable: opts.historyAvailable ?? true,
    config: { ...DEFAULT_RISK_CONFIG, ...opts.config },
  };
}
