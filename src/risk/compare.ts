import type { Address } from 'viem';
import type { CharacterComparison, LookalikeRule } from './types';

/**
 * Character-level comparison of two normalized addresses.
 * Case-insensitive on hex: checksum casing is presentation, not identity.
 */
export function compareAddresses(candidate: Address, anchor: Address): CharacterComparison {
  const a = candidate.slice(2).toLowerCase();
  const b = anchor.slice(2).toLowerCase();

  const positions = Array.from(a, (char, index) => {
    const other = b[index] ?? '';
    return { index, candidate: char, anchor: other, match: char === other };
  });

  let prefixMatchLength = 0;
  while (prefixMatchLength < positions.length && positions[prefixMatchLength]?.match) {
    prefixMatchLength += 1;
  }

  let suffixMatchLength = 0;
  while (
    suffixMatchLength < positions.length &&
    positions[positions.length - 1 - suffixMatchLength]?.match
  ) {
    suffixMatchLength += 1;
  }

  return {
    candidate,
    anchor,
    positions,
    prefixMatchLength,
    suffixMatchLength,
    totalMatching: positions.filter((p) => p.match).length,
  };
}

export function isIdentical(comparison: CharacterComparison): boolean {
  return comparison.totalMatching === comparison.positions.length;
}

/**
 * Lookalike under the configured rule (never the identical address).
 * - prefix-suffix: prefix >= minPrefix AND suffix >= minSuffix.
 * - total: prefix + suffix >= minTotal, with each end >= minEachEnd.
 */
export function isLookalike(comparison: CharacterComparison, rule: LookalikeRule): boolean {
  if (isIdentical(comparison)) return false;
  const { prefixMatchLength: p, suffixMatchLength: s } = comparison;
  switch (rule.kind) {
    case 'prefix-suffix':
      return p >= rule.minPrefix && s >= rule.minSuffix;
    case 'total':
      return p >= rule.minEachEnd && s >= rule.minEachEnd && p + s >= rule.minTotal;
  }
}
