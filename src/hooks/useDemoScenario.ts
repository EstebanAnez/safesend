'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import type { Address } from 'viem';
import type {
  AsyncState,
  Contact,
  HistoryPage,
  ProtectedAddress,
  TrustAnchor,
} from '@/domain/types';
import { SCENARIOS } from '@/fixtures/scenarios';
import type { DemoScenario } from '@/fixtures/scenarios';
import { FixtureHistoryProvider } from '@/providers/history/fixture';
import type { HistorySimulation } from '@/providers/history/fixture';
import { buildProtectedSet, buildTrustAnchors } from '@/risk/anchors';
import { DEFAULT_RISK_CONFIG } from '@/risk/config';
import { classifyHistoryEntry } from '@/risk/history';
import { buildNameBook } from '@/risk/names';
import type { NameBook } from '@/risk/names';
import type { HistoryClassification } from '@/risk/history';
import { testSendAnchors } from '@/risk/testSend';
import type { RiskConfig, TestSend } from '@/risk/types';

export type { HistorySimulation };

export interface DemoScenarioState {
  scenario: DemoScenario;
  config: RiskConfig;
  history: AsyncState<HistoryPage>;
  /** Request history again (after an error). */
  retryHistory: () => void;
  /** Trust set: the only path to ALLOW. */
  anchors: readonly TrustAnchor[];
  /** Protected set: what lookalikes are compared against. */
  protectedSet: readonly ProtectedAddress[];
  /** Keyed by HistoryEntry.id. */
  classifications: ReadonlyMap<string, HistoryClassification>;
  /** Names for known addresses (contacts and wallet labels), exact match only. Display only. */
  names: NameBook;
  /** Session contacts: the scenario's plus any the user added (demo: not persisted). */
  contacts: readonly Contact[];
  addContact: (contact: Omit<Contact, 'id' | 'addedAt'>) => Contact;
  /** Add several contacts at once (a group, D18). */
  addContacts: (contacts: readonly Omit<Contact, 'id' | 'addedAt'>[]) => Contact[];
  /** Test sends made in this session (demo: simulated). */
  testSends: readonly TestSend[];
  recordTestSend: (recipient: Address, amount: bigint) => void;
}

const EMPTY: readonly never[] = [];

export function useDemoScenario(
  scenarioId: string,
  simulation: HistorySimulation = 'none',
): DemoScenarioState {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown demo scenario: ${scenarioId}`);
  const config = DEFAULT_RISK_CONFIG;

  const [history, setHistory] = useState<AsyncState<HistoryPage>>({ status: 'loading' });
  // One provider per scenario and simulation, so a retry counts as a second attempt.
  const provider = useMemo(
    () => new FixtureHistoryProvider(scenario, simulation),
    [scenario, simulation],
  );
  const [attempt, setAttempt] = useState(0);
  const retryHistory = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setHistory({ status: 'loading' });
    provider
      .getHistory({ account: scenario.user.address, signal: controller.signal })
      .then((data) => {
        // A transition: rendering a long list is time-sliced and never blocks input.
        if (!controller.signal.aborted) {
          startTransition(() => setHistory({ status: 'success', data }));
        }
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
  }, [provider, scenario, attempt]);

  const entries = history.status === 'success' ? history.data.entries : EMPTY;

  const [contacts, setContacts] = useState<readonly Contact[]>(scenario.contacts);
  const addContact = useCallback((draft: Omit<Contact, 'id' | 'addedAt'>): Contact => {
    const contact: Contact = {
      ...draft,
      id: `contact-${crypto.randomUUID()}`,
      addedAt: Date.now(),
    };
    setContacts((prev) => [...prev, contact]);
    return contact;
  }, []);

  const addContacts = useCallback(
    (drafts: readonly Omit<Contact, 'id' | 'addedAt'>[]): Contact[] => {
      const now = Date.now();
      const created = drafts.map((d) => ({
        ...d,
        id: `contact-${crypto.randomUUID()}`,
        addedAt: now,
      }));
      setContacts((prev) => [...prev, ...created]);
      return created;
    },
    [],
  );

  const [testSends, setTestSends] = useState<readonly TestSend[]>([]);
  const recordTestSend = useCallback(
    (recipient: Address, amount: bigint) => {
      // Demo: the simulated test lands one block after the newest fixture entry.
      const latest = entries.reduce((m, e) => (e.blockNumber > m ? e.blockNumber : m), 0n);
      setTestSends((prev) => [...prev, { recipient, amount, blockNumber: latest + 1n }]);
    },
    [entries],
  );

  const anchors = useMemo(() => {
    const base = buildTrustAnchors(contacts, entries, scenario.user.address, config);
    return [...base, ...testSendAnchors(testSends, base, entries, scenario.user.address, config)];
  }, [contacts, entries, scenario.user.address, config, testSends]);

  const protectedSet = useMemo(
    () => buildProtectedSet(anchors, entries, config),
    [anchors, entries, config],
  );

  const names = useMemo(
    // The user's own address reads "you" ("Signed by you"); it is never a recipient or an anchor.
    () => buildNameBook(contacts, { ...scenario.names, [scenario.user.address]: 'you' }),
    [contacts, scenario.names, scenario.user.address],
  );

  const classifications = useMemo(() => {
    const map = new Map<string, HistoryClassification>();
    for (const entry of entries) {
      map.set(
        entry.id,
        classifyHistoryEntry(entry, protectedSet, scenario.user.address, config, testSends),
      );
    }
    return map;
  }, [entries, protectedSet, scenario.user.address, config, testSends]);

  return {
    scenario,
    config,
    history,
    retryHistory,
    anchors,
    protectedSet,
    classifications,
    names,
    contacts,
    addContact,
    addContacts,
    testSends,
    recordTestSend,
  };
}
