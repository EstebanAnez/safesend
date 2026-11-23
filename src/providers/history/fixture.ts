import type { Address } from 'viem';
import type { HistoryPage } from '@/domain/types';
import type { DemoScenario } from '@/fixtures/scenarios';
import type { HistoryProvider } from './types';

/** Deterministic history for tests, demo mode and the video. Newest first. */
export class FixtureHistoryProvider implements HistoryProvider {
  readonly source = 'fixture' as const;

  constructor(private readonly scenario: DemoScenario) {}

  async getHistory({ account }: { account: Address; signal?: AbortSignal }): Promise<HistoryPage> {
    if (account.toLowerCase() !== this.scenario.user.address.toLowerCase()) {
      return { entries: [], coverage: { kind: 'fixture', scenarioId: this.scenario.id } };
    }
    const entries = [...this.scenario.history].sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? b.logIndex - a.logIndex
        : a.blockNumber < b.blockNumber
          ? 1
          : -1,
    );
    return { entries, coverage: { kind: 'fixture', scenarioId: this.scenario.id } };
  }
}
