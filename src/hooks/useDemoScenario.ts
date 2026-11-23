'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import type { AsyncState, HistoryPage, TrustAnchor } from '@/domain/types';
import { SCENARIOS } from '@/fixtures/scenarios';
import type { DemoScenario } from '@/fixtures/scenarios';
import { FixtureHistoryProvider } from '@/providers/history/fixture';
import { buildTrustAnchors } from '@/risk/anchors';
import { DEFAULT_RISK_CONFIG } from '@/risk/config';
import { classifyHistoryEntry } from '@/risk/history';
import type { HistoryClassification } from '@/risk/history';
import { testSendAnchors } from '@/risk/testSend';
import type { RiskConfig, TestSend } from '@/risk/types';

export interface DemoScenarioState {
  scenario: DemoScenario;
  config: RiskConfig;
  history: AsyncState<HistoryPage>;
  anchors: readonly TrustAnchor[];
  /** Keyed by HistoryEntry.id. */
  classifications: ReadonlyMap<string, HistoryClassification>;
  /** Test sends made in this session (demo: simulated). */
  testSends: readonly TestSend[];
  recordTestSend: (recipient: Address, amount: bigint) => void;
}

export function useDemoScenario(scenarioId: string): DemoScenarioState {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown demo scenario: ${scenarioId}`);
  const config = DEFAULT_RISK_CONFIG;

  const [history, setHistory] = useState<AsyncState<HistoryPage>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const provider = new FixtureHistoryProvider(scenario);
    setHistory({ status: 'loading' });
    provider
      .getHistory({ account: scenario.user.address, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setHistory({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHistory({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => controller.abort();
  }, [scenario]);

  const entries = history.status === 'success' ? history.data.entries : null;

  const [testSends, setTestSends] = useState<readonly TestSend[]>([]);
  const recordTestSend = useCallback(
    (recipient: Address, amount: bigint) => {
      // Demo: the simulated test lands one block after the newest fixture entry.
      const latest = (entries ?? []).reduce((m, e) => (e.blockNumber > m ? e.blockNumber : m), 0n);
      setTestSends((prev) => [...prev, { recipient, amount, blockNumber: latest + 1n }]);
    },
    [entries],
  );

  const anchors = useMemo(() => {
    const base = buildTrustAnchors(scenario.contacts, entries ?? [], scenario.user.address, config);
    return [
      ...base,
      ...testSendAnchors(testSends, base, entries ?? [], scenario.user.address, config),
    ];
  }, [scenario, entries, config, testSends]);

  const classifications = useMemo(() => {
    const map = new Map<string, HistoryClassification>();
    for (const entry of entries ?? []) {
      map.set(
        entry.id,
        classifyHistoryEntry(entry, anchors, scenario.user.address, config, testSends),
      );
    }
    return map;
  }, [entries, anchors, scenario.user.address, config, testSends]);

  return { scenario, config, history, anchors, classifications, testSends, recordTestSend };
}
