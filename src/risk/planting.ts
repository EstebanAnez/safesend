import type { Address } from 'viem';
import type { HistoryEntry, PoisoningTechnique } from '@/domain/types';
import { sameAddress } from './address';
import type { RiskConfig } from './types';

/**
 * How an entry could have planted its counterparty in the user's history.
 * Returns null for entries that look like ordinary activity.
 * - counterfeit-token: any token other than canonical USDC (symbol is attacker-controlled).
 * - zero-value: a 0-amount transfer the user did not sign.
 * - dust: a tiny inbound canonical-USDC transfer.
 */
export function plantingTechnique(
  entry: HistoryEntry,
  user: Address,
  config: Pick<RiskConfig, 'dustThreshold'>,
): PoisoningTechnique | null {
  if (!entry.isCanonicalUsdc) return 'counterfeit-token';
  const signedByUser =
    entry.txSigner.status === 'known' && sameAddress(entry.txSigner.address, user);
  if (entry.amount === 0n && !signedByUser) return 'zero-value';
  if (entry.direction === 'in' && entry.amount > 0n && entry.amount <= config.dustThreshold) {
    return 'dust';
  }
  return null;
}

/** Entries that introduced `address` into history through a planting technique. */
export function plantedVia(
  address: Address,
  history: readonly HistoryEntry[],
  user: Address,
  config: Pick<RiskConfig, 'dustThreshold'>,
): { entryId: string; txHash: HistoryEntry['txHash']; technique: PoisoningTechnique }[] {
  const result: {
    entryId: string;
    txHash: HistoryEntry['txHash'];
    technique: PoisoningTechnique;
  }[] = [];
  for (const entry of history) {
    if (!sameAddress(entry.counterparty, address)) continue;
    const technique = plantingTechnique(entry, user, config);
    if (technique) result.push({ entryId: entry.id, txHash: entry.txHash, technique });
  }
  return result;
}

/** The earliest history entry involving `address` (by block, then log index). */
export function firstAppearance(
  address: Address,
  history: readonly HistoryEntry[],
): HistoryEntry | null {
  let first: HistoryEntry | null = null;
  for (const entry of history) {
    if (!sameAddress(entry.counterparty, address)) continue;
    if (
      first === null ||
      entry.blockNumber < first.blockNumber ||
      (entry.blockNumber === first.blockNumber && entry.logIndex < first.logIndex)
    ) {
      first = entry;
    }
  }
  return first;
}

/** True when `address` first entered history through a planting technique. */
export function firstAppearedViaPlanting(
  address: Address,
  history: readonly HistoryEntry[],
  user: Address,
  config: Pick<RiskConfig, 'dustThreshold'>,
): boolean {
  const first = firstAppearance(address, history);
  return first !== null && plantingTechnique(first, user, config) !== null;
}
