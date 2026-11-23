import type { Address } from 'viem';
import type { HistoryPage, HistorySource } from '@/domain/types';

/**
 * One interface for every history source. Implementations:
 * - FixtureHistoryProvider: deterministic scenarios (tests, demo, video).
 * - ExplorerHistoryProvider: Blockscout Base Sepolia v2 API (no key needed,
 *   verified 2026-11-23). Can see counterfeit tokens.
 * - RpcHistoryProvider: viem getLogs fallback over a bounded block range.
 *   Partial coverage; canonical USDC only unless the RPC supports a
 *   topic-filtered query across all contracts.
 */
export interface HistoryProvider {
  readonly source: HistorySource;
  getHistory(params: { account: Address; signal?: AbortSignal }): Promise<HistoryPage>;
}
