'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { pickChallengePositions } from '@/risk/confirmation';
import type { ConfirmationRequirement } from '@/risk/types';

/** Uniform float in [0, 1) from the platform CSPRNG. */
export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
}

/**
 * Fresh random middle positions for every review (the requirement object is
 * new per evaluation). Null when the WARN does not need a character challenge.
 */
export function useChallengePositions(
  requirement: ConfirmationRequirement,
  recipient: Address | null,
  random: () => number = cryptoRandom,
): readonly number[] | null {
  return useMemo(
    () =>
      requirement.level === 'middle-characters' && recipient
        ? pickChallengePositions(requirement, random)
        : null,
    [requirement, recipient, random],
  );
}
