import { describe, expect, it } from 'vitest';
import { SISTER } from '@/test/builders';
import {
  checkChallengeAnswer,
  displayPosition,
  middleRange,
  pickChallengePositions,
} from './confirmation';
import { compareAddresses } from './compare';

const requirement = {
  level: 'middle-characters' as const,
  count: 4,
  middleStart: 6,
  middleEnd: 34,
};

/** Deterministic PRNG for tests (mulberry32). */
function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pickChallengePositions', () => {
  it('returns 4 distinct sorted positions inside the middle range, never the outer chars', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const positions = pickChallengePositions(requirement, seeded(seed));
      expect(positions).toHaveLength(4);
      expect(new Set(positions).size).toBe(4);
      expect([...positions].sort((x, y) => x - y)).toEqual(positions);
      for (const p of positions) {
        expect(p).toBeGreaterThanOrEqual(6);
        expect(p).toBeLessThan(34);
      }
    }
  });

  it('varies between reviews', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed += 1) {
      seen.add(pickChallengePositions(requirement, seeded(seed)).join(','));
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  it('handles a random() that returns values at the edges', () => {
    expect(pickChallengePositions(requirement, () => 0)).toHaveLength(4);
    expect(pickChallengePositions(requirement, () => 0.9999999)).toHaveLength(4);
  });
});

describe('checkChallengeAnswer', () => {
  const positions = [6, 10, 20, 33];
  const hex = SISTER.slice(2).toLowerCase();
  const correct = positions.map((p) => hex[p]).join('');

  it('accepts the right characters, case-insensitively and ignoring spaces', () => {
    expect(checkChallengeAnswer(SISTER, positions, correct)).toBe(true);
    expect(checkChallengeAnswer(SISTER, positions, correct.toUpperCase())).toBe(true);
    expect(checkChallengeAnswer(SISTER, positions, correct.split('').join(' '))).toBe(true);
  });

  it('rejects wrong, partial or reordered answers', () => {
    expect(checkChallengeAnswer(SISTER, positions, '')).toBe(false);
    expect(checkChallengeAnswer(SISTER, positions, correct.slice(0, 3))).toBe(false);
    expect(checkChallengeAnswer(SISTER, positions, `${correct}0`)).toBe(false);
    // The last 4 characters, the old (attackable) confirmation, is not accepted.
    expect(checkChallengeAnswer(SISTER, positions, SISTER.slice(-4))).toBe(false);
  });
});

describe('middleRange', () => {
  it('defaults to 6 characters of margin on each side', () => {
    expect(middleRange([])).toEqual({ middleStart: 6, middleEnd: 34 });
  });

  it('widens the margin past a longer matching prefix or suffix', () => {
    const look = `0x${'abcdef12'}${'0'.repeat(25)}${'9876543'}` as const;
    const c = compareAddresses(look, `0x${'abcdef12'}${'f'.repeat(25)}${'9876543'}`);
    expect(middleRange([c])).toEqual({ middleStart: 8, middleEnd: 33 });
  });
});

describe('displayPosition', () => {
  it('counts the 0x prefix so humans can find the character', () => {
    expect(displayPosition(0)).toBe(3);
  });
});
