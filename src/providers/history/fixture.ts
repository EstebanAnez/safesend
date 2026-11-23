import type { Address } from 'viem';
import type { HistoryPage } from '@/domain/types';
import type { DemoScenario } from '@/fixtures/scenarios';
import type { HistoryProvider } from './types';

/**
 * Demo only: make the fixture behave like a real source on a bad day, so the
 * loading, empty and error states can be seen and tested.
 * - `slow`: every request takes SLOW_MS.
 * - `outage`: the first request fails; later requests (a retry) succeed.
 * - `empty`: the account has no USDC activity.
 */
export type HistorySimulation = 'none' | 'slow' | 'outage' | 'empty';

export const SLOW_MS = 2500;

/** Deterministic history for tests, demo mode and the video. Newest first. */
export class FixtureHistoryProvider implements HistoryProvider {
  readonly source = 'fixture' as const;
  private failedOnce = false;

  constructor(
    private readonly scenario: DemoScenario,
    private readonly simulation: HistorySimulation = 'none',
  ) {}

  async getHistory({
    account,
    signal,
  }: {
    account: Address;
    signal?: AbortSignal;
  }): Promise<HistoryPage> {
    const coverage = { kind: 'fixture', scenarioId: this.scenario.id } as const;
    if (this.simulation === 'slow') await delay(SLOW_MS, signal);
    if (this.simulation === 'outage' && !this.failedOnce) {
      // An aborted request (unmount, React Strict Mode) never reaches here, so it does not count.
      await delay(400, signal);
      this.failedOnce = true;
      throw new Error('The activity service did not respond.');
    }
    if (
      this.simulation === 'empty' ||
      account.toLowerCase() !== this.scenario.user.address.toLowerCase()
    ) {
      return { entries: [], coverage };
    }
    const entries = [...this.scenario.history].sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? b.logIndex - a.logIndex
        : a.blockNumber < b.blockNumber
          ? 1
          : -1,
    );
    return { entries, coverage };
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
