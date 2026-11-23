import type { Address } from 'viem';
import type { CharacterComparison } from './types';

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

/** Matches on both ends at or past the thresholds, without being the same address. */
export function isLookalike(
  comparison: CharacterComparison,
  prefixMatchLength: number,
  suffixMatchLength: number,
): boolean {
  return (
    !isIdentical(comparison) &&
    comparison.prefixMatchLength >= prefixMatchLength &&
    comparison.suffixMatchLength >= suffixMatchLength
  );
}
