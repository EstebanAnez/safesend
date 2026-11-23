import type { Address } from 'viem';
import type { CharacterComparison, ConfirmationRequirement } from './types';

export const CHALLENGE_LENGTH = 4;
/** Never challenge on the outer characters, which lookalikes are built to match. */
export const MIN_OUTER_MARGIN = 6;
const HEX_LENGTH = 40;

export const ACKNOWLEDGE_STATEMENT =
  'I confirmed this address with the recipient through another channel (for example, a phone call).';

/**
 * The hex index range the challenge is drawn from. Excludes at least
 * MIN_OUTER_MARGIN characters at each end, and more when a lookalike
 * comparison shows a longer matching prefix or suffix.
 */
export function middleRange(comparisons: readonly CharacterComparison[]): {
  middleStart: number;
  middleEnd: number;
} {
  const prefix = Math.max(MIN_OUTER_MARGIN, ...comparisons.map((c) => c.prefixMatchLength));
  const suffix = Math.max(MIN_OUTER_MARGIN, ...comparisons.map((c) => c.suffixMatchLength));
  const middleStart = prefix;
  const middleEnd = HEX_LENGTH - suffix;
  if (middleEnd - middleStart < CHALLENGE_LENGTH * 2) {
    return { middleStart: MIN_OUTER_MARGIN, middleEnd: HEX_LENGTH - MIN_OUTER_MARGIN };
  }
  return { middleStart, middleEnd };
}

/**
 * Picks `count` distinct positions in [middleStart, middleEnd), sorted.
 * `random` returns a float in [0, 1); inject it so tests are deterministic and
 * the UI can use crypto.getRandomValues.
 */
export function pickChallengePositions(
  requirement: Extract<ConfirmationRequirement, { level: 'middle-characters' }>,
  random: () => number,
): number[] {
  const pool: number[] = [];
  for (let i = requirement.middleStart; i < requirement.middleEnd; i += 1) pool.push(i);
  // Partial Fisher-Yates.
  for (let i = 0; i < requirement.count && i < pool.length; i += 1) {
    const j = i + Math.floor(random() * (pool.length - i));
    const a = pool[i];
    const b = pool[j];
    if (a === undefined || b === undefined) break;
    pool[i] = b;
    pool[j] = a;
  }
  return pool.slice(0, requirement.count).sort((x, y) => x - y);
}

/** Case-insensitive; ignores spaces the user may type between characters. */
export function checkChallengeAnswer(
  address: Address,
  positions: readonly number[],
  answer: string,
): boolean {
  const hex = address.slice(2).toLowerCase();
  const expected = positions.map((p) => hex[p] ?? '').join('');
  return (
    expected.length === positions.length && answer.replace(/\s+/g, '').toLowerCase() === expected
  );
}

/** Human position labels, 1-based and counting the "0x" prefix as characters 1-2. */
export function displayPosition(hexIndex: number): number {
  return hexIndex + 3;
}
