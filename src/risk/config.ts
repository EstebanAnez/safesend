import type { RiskConfig } from './types';

/**
 * PROVISIONAL defaults. The 3-leading / 4-trailing match is the criterion the
 * CMU study (Tsuchiya et al., arXiv 2501.16681) used to count lookalikes. It is
 * a starting hypothesis, not a tuned value: slice S3 evaluates 3/3, 3/4, 4/4
 * and 4/5 on a holdout set and picks the default from those results
 * (docs/RISK_MODEL.md).
 */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  prefixMatchLength: 3,
  suffixMatchLength: 4,
  firstSendThreshold: 25_000_000n, // 25 USDC
  amountAnomalyMultiplier: 5,
  dustThreshold: 10_000n, // 0.01 USDC
};
