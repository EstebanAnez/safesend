import type { Address, Hash } from 'viem';

/**
 * Core domain types. Shared by providers, hooks, the risk engine and the UI.
 * Amounts are always bigint base units (USDC has 6 decimals). Addresses are
 * always checksummed (viem getAddress) once they cross into the domain.
 */

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type HistorySource = 'fixture' | 'explorer' | 'rpc';

export type Direction = 'in' | 'out' | 'unknown';

/**
 * How we know what an entry says.
 * - verified: read directly from chain data, including who signed the tx.
 * - inferred: derived from event data alone (for example a Transfer log
 *   without a signer lookup). Never used to create a trust anchor.
 * - unknown: we could not establish it. The UI must say "unknown".
 */
export type Provenance = 'verified' | 'inferred' | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

/**
 * Who authorized the transaction that emitted this transfer.
 * A Transfer event naming the user as `from` is NOT proof the user sent it:
 * zero-value poisoning emits exactly that. Only `known` signers count.
 *
 * `via` matters for Coinbase Smart Wallet (ERC-4337): the outer tx is signed
 * by a bundler, so the user's account appears as a UserOperation sender.
 */
export type TxSigner =
  { status: 'unknown' } | { status: 'known'; address: Address; via: 'tx-from' | 'user-operation' };

/** Planting technique, when an entry looks like a poisoning attempt. */
export type PoisoningTechnique = 'zero-value' | 'dust' | 'counterfeit-token';

export interface HistoryEntry {
  /** Stable id: `${txHash}:${logIndex}`. */
  id: string;
  source: HistorySource;
  chainId: number;
  tokenContract: Address;
  /** Symbol the token contract reports. Attackers control this for fake tokens. */
  tokenSymbolClaimed: string | null;
  isCanonicalUsdc: boolean;
  direction: Direction;
  /** Raw Transfer event parties, kept for evidence. */
  from: Address;
  to: Address;
  /** The other side relative to the user. */
  counterparty: Address;
  /** Base units of `tokenContract`. */
  amount: bigint;
  tokenDecimals: number | null;
  txHash: Hash;
  logIndex: number;
  txSigner: TxSigner;
  blockNumber: bigint;
  /** Unix seconds, or null when the source did not provide it. */
  blockTime: number | null;
  provenance: Provenance;
  confidence: Confidence;
}

/** What a provider could see. The UI must surface anything short of complete. */
export type HistoryCoverage =
  | { kind: 'fixture'; scenarioId: string }
  | { kind: 'complete'; seesNonCanonicalTokens: boolean }
  | {
      kind: 'partial';
      fromBlock: bigint;
      toBlock: bigint;
      seesNonCanonicalTokens: boolean;
      note: string;
    };

export interface HistoryPage {
  entries: readonly HistoryEntry[];
  coverage: HistoryCoverage;
}

// ---------------------------------------------------------------------------
// Contacts and trust anchors
// ---------------------------------------------------------------------------

/** Added only through a deliberate action. Never created from history. */
export interface Contact {
  id: string;
  name: string;
  address: Address;
  /** Unix ms. */
  addedAt: number;
  /** How the user supplied the full address when adding the contact. */
  addedVia: 'typed' | 'pasted';
  /** Set when added through the post-BLOCK "new person" flow. */
  verifiedOutOfBand: boolean;
}

/**
 * The only addresses lookalikes are compared against.
 * Inbound transfers, arbitrary history entries and anything with unknown
 * provenance are never trust anchors.
 */
export type TrustAnchor =
  | { kind: 'contact'; address: Address; contact: Contact }
  | {
      kind: 'confirmed-recipient';
      address: Address;
      /** Entries proving the user signed a canonical-USDC send to this address. */
      evidenceTxHashes: readonly Hash[];
      /** Unix seconds of the most recent confirmed send, if known. */
      lastSentAt: number | null;
    };

// ---------------------------------------------------------------------------
// Async state (discriminated, no booleans soup)
// ---------------------------------------------------------------------------

export type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };
