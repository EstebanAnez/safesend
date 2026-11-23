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
  | 'NEW_RECIPIENT'
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

/**
 * What the user must do before a WARN can proceed (docs/DECISIONS.md D8).
 * Never the first or last characters: lookalikes are generated to match those.
 * - acknowledge: a checkbox stating the address was confirmed out of band.
 *   Only for a new recipient below the first-send threshold with no other signals.
 * - middle-characters: type `count` characters at positions chosen at random
 *   (by the UI, per review) from the hex index range [middleStart, middleEnd).
 */
export type ConfirmationRequirement =
  | { level: 'none' }
  | { level: 'acknowledge'; statement: string }
  | { level: 'middle-characters'; count: number; middleStart: number; middleEnd: number };

export type ConfirmationLevel = ConfirmationRequirement['level'];

export interface RiskResult {
  decision: Decision;
  /** 0 to 100. Informational ordering only; the decision comes from the policy, not a cut-off. */
  score: number;
  /** Ordered: block, then warn, then info. */
  reasons: readonly Reason[];
  /** 'none' for ALLOW and BLOCK (BLOCK cannot be confirmed past). */
  confirmation: ConfirmationRequirement;
  /** New recipient with a large amount or another signal: suggest a small test send first. */
  testSendSuggested: boolean;
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
  /** Confirmed sends needed before a "typical send" baseline exists. */
  amountBaselineMinSends: number;
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
  /**
   * False when no history source could be read. High-confidence lookalike
   * BLOCK then relies on the both-ends match alone.
   */
  historyAvailable: boolean;
  /**
   * Test sends SafeSend performed for this user (most recent last). Lookalikes of
   * a test-send recipient that appear in history after the test are high risk.
   */
  testSends?: readonly TestSend[];
  config: RiskConfig;
}

export interface TestSend {
  recipient: Address;
  amount: bigint;
  /** Block of the test send; history entries in later blocks are "after" it. */
  blockNumber: bigint;
  txHash?: Hash;
}
