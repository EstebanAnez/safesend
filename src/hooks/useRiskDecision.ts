'use client';

import { useMemo } from 'react';
import { evaluateRisk } from '@/risk/evaluate';
import type { RiskInput, RiskResult } from '@/risk/types';

/** Memoized risk evaluation. Returns null until there is an intent to evaluate. */
export function useRiskDecision(input: RiskInput | null): RiskResult | null {
  return useMemo(() => (input ? evaluateRisk(input) : null), [input]);
}
