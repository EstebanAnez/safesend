import type { Address, Hash } from 'viem';
import type { HistoryEntry, PoisoningTechnique, TrustAnchor } from '@/domain/types';

/**
 * Risk engine contract. Pure data in, pure data out. No React, no network.
 */

export type Decision = 'ALLOW' | 'WARN' | 'BLOCK';

export type Severity = 'block' | 'warn' | 'info';

export type ReasonCode =
  // BLOCK: structural
  | 'INVALID_ADDRESS'
  | 'ZERO_ADDRESS'
  | 'TOKEN_CONTRACT_AS_RECIPIENT'
  | 'SELF_SEND'
  | 'WRONG_NETWORK'
  | 'WRONG_TOKEN'
  // BLOCK: high-confidence lookalike
  | 'LOOKALIKE_HIGH_CONFIDENCE'
  // WARN
  | 'LOOKALIKE'
  | 'NEW_RECIPIENT_LARGE_AMOUNT'
  | 'AMOUNT_ANOMALY'
  | 'UNKNOWN_PROVENANCE'
  // INFO (positive signals, shown so ALLOW is explainable too)
  | 'TRUSTED_CONTACT'
  | 'CONFIRMED_PAST_RECIPIENT';

/** Character-level comparison against one anchor, used by the hero UI. */
export interface CharacterComparison {
  /** Checksummed forms; comparison itself is case-insensitive on hex. */
  candidate: Address;
  anchor: Address;
  /** One entry per hex char after `0x` (40 entries). */
  positions: readonly { index: number; candidate: string; anchor: string; match: boolean }[];
  prefixMatchLength: number;
  suffixMatchLength: number;
  totalMatching: number;
}

export type ReasonEvidence =
  | { kind: 'none' }
  | { kind: 'input'; raw: string; detail: string }
  | { kind: 'network'; expectedChainId: number; actualChainId: number }
  | { kind: 'token'; expected: Address; actual: Address }
  | {
      kind: 'lookalike';
      anchor: TrustAnchor;
      comparison: CharacterComparison;
      /** History entries through which the lookalike first appeared, if any. */
      plantedVia: readonly { entryId: string; txHash: Hash; technique: PoisoningTechnique }[];
    }
  | { kind: 'amount'; amount: bigint; reference: bigint; referenceLabel: string }
  | { kind: 'anchor'; anchor: TrustAnchor }
  | { kind: 'history'; entryIds: readonly string[] };

export interface Reason {
  code: ReasonCode;
  severity: Severity;
  /** Short, plain-language headline. */
  title: string;
  /** One or two sentences a non-expert can act on. */
  explanation: string;
  evidence: ReasonEvidence;
}

export interface RiskResult {
  decision: Decision;
  /** 0 to 100. Informational ordering only; the decision comes from the policy, not a cut-off. */
  score: number;
  /** Ordered: block, then warn, then info. */
  reasons: readonly Reason[];
}

export interface RiskConfig {
  /** Leading hex chars (after 0x) that must match an anchor. Hypothesis; see docs/RISK_MODEL.md. */
  prefixMatchLength: number;
  /** Trailing hex chars that must match an anchor. */
  suffixMatchLength: number;
  /** New-recipient amount (base units) above which a test send is suggested. */
  firstSendThreshold: bigint;
  /** WARN when amount exceeds this multiple of the user's typical send. */
  amountAnomalyMultiplier: number;
  /** Dust upper bound in base units for planting detection. */
  dustThreshold: bigint;
}

export interface SendIntent {
  /** Raw text the user entered or picked. Validated by the engine. */
  recipientInput: string;
  amount: bigint;
  chainId: number;
  tokenContract: Address;
}

export interface RiskInput {
  intent: SendIntent;
  userAddress: Address;
  anchors: readonly TrustAnchor[];
  history: readonly HistoryEntry[];
  config: RiskConfig;
}
