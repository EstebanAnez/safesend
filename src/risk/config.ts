import type { RiskConfig } from './types';

/**
 * Shipped defaults. Every value is a documented hypothesis (docs/RISK_MODEL.md),
 * not a tuned fact.
 *
 * - lookalike "total >= 6, >= 2 each end" (D15): shipped after holdout v2.
 *   It replaced the CMU-style 3/4 rule, which remains an evaluated setting.
 *   Benign collision rate ~1 in 5.8M per protected address. Because v2
 *   informed this choice, v2 is no longer a clean holdout for it (docs/EVAL.md).
 * - protectInboundMinTransfers 1: one verified, above-dust inbound USDC
 *   transfer puts the sender in the protected set (never the trust set).
 * - amount anomaly: 5x the per-recipient median once there are 3 sends to
 *   that person; otherwise 5x the global median once there are 3 sends overall.
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  lookalike: { kind: 'total', minTotal: 6, minEachEnd: 2 },
  protectInboundMinTransfers: 1,
  firstSendThreshold: 25_000_000n, // 25 USDC
  amountAnomalyMultiplier: 5,
  amountRecipientMinSends: 3,
  amountBaselineMinSends: 3,
  dustThreshold: 10_000n, // 0.01 USDC
};
