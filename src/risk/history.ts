import type { Address } from 'viem';
import type { HistoryEntry, PoisoningTechnique, TrustAnchor } from '@/domain/types';
import { sameAddress } from './address';
import { compareAddresses, isLookalike } from './compare';
import { plantingTechnique } from './planting';
import type { CharacterComparison, RiskConfig } from './types';

export type HistoryClassification =
  | { kind: 'normal' }
  /** Planted-looking entry whose counterparty imitates a trust anchor. Collapsed in the UI. */
  | {
      kind: 'suspected-poisoning';
      technique: PoisoningTechnique;
      anchor: TrustAnchor;
      comparison: CharacterComparison;
    }
  /** Planted-looking entry that does not imitate any anchor we know of. */
  | { kind: 'suspicious-origin'; technique: PoisoningTechnique };

export function classifyHistoryEntry(
  entry: HistoryEntry,
  anchors: readonly TrustAnchor[],
  user: Address,
  config: RiskConfig,
): HistoryClassification {
  const technique = plantingTechnique(entry, user, config);
  if (!technique) return { kind: 'normal' };

  for (const anchor of anchors) {
    if (sameAddress(anchor.address, entry.counterparty)) continue;
    const comparison = compareAddresses(entry.counterparty, anchor.address);
    if (isLookalike(comparison, config.prefixMatchLength, config.suffixMatchLength)) {
      return { kind: 'suspected-poisoning', technique, anchor, comparison };
    }
  }
  return { kind: 'suspicious-origin', technique };
}
