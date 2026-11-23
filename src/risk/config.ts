import type { RiskConfig } from './types';

/**
 * Shipped defaults. Every value is a documented hypothesis (docs/RISK_MODEL.md),
 * not a tuned fact.
 *
 * - lookalike 3/4: the criterion the CMU study (Tsuchiya et al., arXiv
 *   2501.16681) used to count lookalikes. Kept as the v1 baseline. The
 *   "total >= 6, >= 2 each end" rule is evaluated alongside it and is the
 *   candidate replacement pending holdout v2 (docs/EVAL.md).
 * - protectInboundMinTransfers 1: one verified, above-dust inbound USDC
 *   transfer puts the sender in the protected set (never the trust set).
 * - amount anomaly: 5x the per-recipient median once there are 3 sends to
 *   that person; otherwise 5x the global median once there are 3 sends overall.
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  lookalike: { kind: 'prefix-suffix', minPrefix: 3, minSuffix: 4 },
  protectInboundMinTransfers: 1,
  firstSendThreshold: 25_000_000n, // 25 USDC
  amountAnomalyMultiplier: 5,
  amountRecipientMinSends: 3,
  amountBaselineMinSends: 3,
  dustThreshold: 10_000n, // 0.01 USDC
};
