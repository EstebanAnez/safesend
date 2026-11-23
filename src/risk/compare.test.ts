import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { compareAddresses, isIdentical, isLookalike } from './compare';
import type { LookalikeRule } from './types';

const ps = (minPrefix: number, minSuffix: number): LookalikeRule => ({
  kind: 'prefix-suffix',
  minPrefix,
  minSuffix,
});

const A = getAddress('0x7a3f9c21e4b8d05f6a1c3e9b2d47f80a5c16e4d2');
const LOOK = getAddress('0x7a3f04b1d9e27c8a53f6b0e19d2c4a7f83b5e4d2');

describe('compareAddresses', () => {
  it('measures matching prefix and suffix lengths', () => {
    const c = compareAddresses(LOOK, A);
    expect(c.prefixMatchLength).toBe(4);
    expect(c.suffixMatchLength).toBe(4);
    expect(c.positions).toHaveLength(40);
  });

  it('is case-insensitive on hex characters', () => {
    const c = compareAddresses(A, A.toLowerCase() as typeof A);
    expect(isIdentical(c)).toBe(true);
    expect(c.prefixMatchLength).toBe(40);
  });

  it('marks each differing middle position', () => {
    const c = compareAddresses(LOOK, A);
    expect(c.positions[4]?.match).toBe(false);
    expect(c.positions[0]?.match).toBe(true);
    expect(c.positions[39]?.match).toBe(true);
  });
});

describe('isLookalike', () => {
  const c = compareAddresses(LOOK, A);

  it('is true when both ends meet the thresholds', () => {
    expect(isLookalike(c, ps(3, 4))).toBe(true);
    expect(isLookalike(c, ps(4, 4))).toBe(true);
  });

  it('is false when either end falls short of its threshold', () => {
    expect(isLookalike(c, ps(5, 4))).toBe(false);
    expect(isLookalike(c, ps(4, 5))).toBe(false);
  });

  it('is never true for the identical address', () => {
    expect(isLookalike(compareAddresses(A, A), ps(3, 4))).toBe(false);
  });
});
