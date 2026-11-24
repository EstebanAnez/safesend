'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AccessibilityAnnouncer } from '@coinbase/cds-web/AccessibilityAnnouncer';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { ControlGroup, Radio, TextInput } from '@coinbase/cds-web/controls';
import { Box, Grid, HStack, VStack } from '@coinbase/cds-web/layout';
import { Spinner } from '@coinbase/cds-web/loaders';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { HistoryEntry, ProtectedAddress } from '@/domain/types';
import { useDemoScenario } from '@/hooks/useDemoScenario';
import type { HistorySimulation } from '@/hooks/useDemoScenario';
import { useRiskDecision } from '@/hooks/useRiskDecision';
import { useSimulatedSend } from '@/hooks/useSimulatedSend';
import { AMOUNT_ERROR_TEXT, formatUsdc, parseUsdcAmount } from '@/lib/amount';
import { decisionAnnouncement, sentAnnouncement } from '@/lib/announce';
import { parseAddress, sameAddress } from '@/risk/address';
import { anchorLabel } from '@/risk/anchors';
import { reverifySend } from '@/risk/reverify';
import type { RiskInput, SendIntent } from '@/risk/types';
import { FOCUS_ON_SHOW, focusWhenShown } from '@/components/a11y/focus';
import { ContactsPanel } from '@/components/Contacts/ContactsPanel';
import { HistoryList } from '@/components/HistoryList/HistoryList';

// Panels that only appear after a user action are code-split (docs/DECISIONS.md D20), then
// prefetched when the browser is idle so they are normally ready before the first click.
const loadDecisionPanel = () => import('@/components/DecisionPanel/DecisionPanel');
const loadAddContactForm = () => import('@/components/Contacts/AddContactForm');
const loadAddGroupForm = () => import('@/components/Contacts/AddGroupForm');
const panelLoading = () => (
  <Text as="p" font="body" color="fgMuted">
    Loading…
  </Text>
);
const DecisionPanel = dynamic(() => loadDecisionPanel().then((m) => m.DecisionPanel), {
  loading: panelLoading,
});
const AddContactForm = dynamic(() => loadAddContactForm().then((m) => m.AddContactForm), {
  loading: panelLoading,
});
const AddGroupForm = dynamic(() => loadAddGroupForm().then((m) => m.AddGroupForm), {
  loading: panelLoading,
});

const EMPTY_HISTORY: readonly HistoryEntry[] = [];

const SIMULATIONS: { value: HistorySimulation; children: string }[] = [
  { value: 'none', children: 'Normal' },
  { value: 'slow', children: 'Slow (2.5 seconds)' },
  { value: 'outage', children: 'Outage (first load fails, retry works)' },
  { value: 'empty', children: 'No activity' },
];

type Step =
  | { kind: 'compose' }
  | { kind: 'review'; intent: SendIntent }
  | { kind: 'add-contact'; mode: 'normal' | 'after-block' }
  | { kind: 'add-group' }
  | { kind: 'notice'; tone: 'warning' | 'informational'; title: string; message: string };

export function DemoJourney({ scenarioId }: { scenarioId: string }) {
  const [simulation, setSimulation] = useState<HistorySimulation>('none');
  const {
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
  } = useDemoScenario(scenarioId, simulation);
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'compose' });
  /** The current review was started from the test-send nudge. */
  const [testPending, setTestPending] = useState(false);
  const [lastSendWasTest, setLastSendWasTest] = useState(false);
  const { state: sendState, send, reset } = useSimulatedSend();
  const recipientRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const sendSectionRef = useRef<HTMLElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  /** Set by user actions that replace the send panel; focus follows them (WCAG 2.4.3). */
  const focusPanelOnShow = useRef(false);
  /** Set when the user changes or retries the history source, so the result is announced. */
  const historyActionPending = useRef(false);

  const [announcement, setAnnouncement] = useState<string | null>(null);
  const announceCount = useRef(0);
  /** Polite live region. A trailing NBSP on every other message re-announces a repeat. */
  const announce = useCallback((message: string) => {
    announceCount.current += 1;
    setAnnouncement(announceCount.current % 2 ? message : `${message} `);
  }, []);

  const historyEntries = useMemo(
    () => (history.status === 'success' ? history.data.entries : EMPTY_HISTORY),
    [history],
  );
  const historyAvailable = history.status === 'success';

  const riskInput = useMemo<RiskInput | null>(
    () =>
      step.kind === 'review'
        ? {
            intent: step.intent,
            userAddress: scenario.user.address,
            anchors,
            history: historyEntries,
            historyAvailable,
            testSends,
            names,
            config,
          }
        : null,
    [
      step,
      scenario.user.address,
      anchors,
      historyEntries,
      historyAvailable,
      testSends,
      names,
      config,
    ],
  );
  const result = useRiskDecision(riskInput);
  const reviewedRecipient = useMemo(() => {
    if (step.kind !== 'review') return null;
    const parsed = parseAddress(step.intent.recipientInput);
    return parsed.ok ? parsed.address : null;
  }, [step]);

  /** Change the send panel and move focus to it. */
  const goTo = useCallback((next: Step) => {
    focusPanelOnShow.current = true;
    setStep(next);
  }, []);

  const review = useCallback(
    (recipient: string, amountRaw: string) => {
      const amount = parseUsdcAmount(amountRaw);
      if (!amount.ok) {
        setAmountError(AMOUNT_ERROR_TEXT[amount.error]);
        amountRef.current?.focus();
        return;
      }
      setAmountError(null);
      goTo({
        kind: 'review',
        intent: {
          recipientInput: recipient,
          amount: amount.value,
          chainId: BASE_SEPOLIA_CHAIN_ID,
          tokenContract: CANONICAL_USDC.address,
        },
      });
    },
    [goTo],
  );

  /** Put an address in the recipient field and return to the form. */
  const pickRecipient = useCallback((address: Address, focus: 'recipient' | 'amount') => {
    setTestPending(false);
    setRecipientInput(address);
    setStep({ kind: 'compose' });
    requestAnimationFrame(() => (focus === 'amount' ? amountRef : recipientRef).current?.focus());
  }, []);

  const handleUseAddress = useCallback(
    (address: Address) => pickRecipient(address, 'recipient'),
    [pickRecipient],
  );
  const handleSendToContact = useCallback(
    (address: Address) => pickRecipient(address, 'amount'),
    [pickRecipient],
  );

  const handleRecover = useCallback(
    (anchor: ProtectedAddress) => {
      setRecipientInput(anchor.address);
      review(anchor.address, amountInput);
    },
    [amountInput, review],
  );

  /**
   * Re-verify immediately before "signing", on the final values: the current
   * form, chain and token, and current history (src/risk/reverify.ts). Only
   * called by the panel once any WARN confirmation has been satisfied.
   */
  const handleConfirm = useCallback(() => {
    if (step.kind !== 'review' || !riskInput || !result || !reviewedRecipient) return;
    const amountNow = parseUsdcAmount(amountInput);
    const final: RiskInput = {
      ...riskInput,
      intent: { ...riskInput.intent, recipientInput, amount: amountNow.ok ? amountNow.value : -1n },
    };
    const check = reverifySend({
      reviewed: { intent: step.intent, result },
      final,
      confirmationSatisfied: true,
    });
    if (!check.ok) {
      goTo({ kind: 'notice', tone: 'warning', title: 'Send stopped', message: check.message });
      return;
    }
    if (testPending) recordTestSend(reviewedRecipient, step.intent.amount);
    setLastSendWasTest(testPending);
    setTestPending(false);
    send(reviewedRecipient, step.intent.amount);
  }, [
    step,
    riskInput,
    result,
    reviewedRecipient,
    recipientInput,
    amountInput,
    send,
    testPending,
    recordTestSend,
    goTo,
  ]);

  const handleUseTestAmount = useCallback(() => {
    setTestPending(true);
    setAmountInput('1');
    review(recipientInput, '1');
  }, [recipientInput, review]);

  const startOver = useCallback(() => {
    reset();
    setTestPending(false);
    setLastSendWasTest(false);
    setRecipientInput('');
    setAmountInput('');
    goTo({ kind: 'compose' });
  }, [reset, goTo]);

  /** After a test send: compose the real send without touching history. */
  const startFollowUp = useCallback(
    (address: Address) => {
      reset();
      setLastSendWasTest(false);
      pickRecipient(address, 'amount');
      setAmountInput('');
    },
    [reset, pickRecipient],
  );

  const changeSimulation = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    historyActionPending.current = true;
    setSimulation(e.target.value as HistorySimulation);
  }, []);

  const handleRetryHistory = useCallback(() => {
    historyActionPending.current = true;
    retryHistory();
  }, [retryHistory]);

  const recipientLabel = useCallback(
    (address: Address) => {
      const anchor = anchors.find((a) => sameAddress(a.address, address));
      return anchor ? anchorLabel(anchor, names) : 'a new address';
    },
    [anchors, names],
  );

  // --- Focus and announcements ---------------------------------------------

  // After a user action replaces the send panel, focus its heading (or the
  // recipient field when going back), so focus never falls to <body>.
  useEffect(() => {
    if (!focusPanelOnShow.current) return;
    focusPanelOnShow.current = false;
    if (step.kind === 'compose') {
      recipientRef.current?.focus();
      return;
    }
    return focusWhenShown(sendSectionRef.current);
  }, [step]);

  // Prefetch the code-split panels once the page is idle.
  useEffect(() => {
    const prefetch = () => {
      void loadDecisionPanel();
      void loadAddContactForm();
      void loadAddGroupForm();
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);

  // Each new decision is announced once, with its reasons (the heading has the verdict).
  useEffect(() => {
    if (result) announce(decisionAnnouncement(result));
  }, [result, announce]);

  // Send complete. ("Sending" is announced by the Spinner, itself a polite status region.)
  // Only status changes; labels changing underneath are not news.
  const sentLabelRef = useRef(recipientLabel);
  sentLabelRef.current = recipientLabel;
  const lastSendWasTestRef = useRef(lastSendWasTest);
  lastSendWasTestRef.current = lastSendWasTest;
  useEffect(() => {
    if (sendState.status === 'sent') {
      const test = lastSendWasTestRef.current;
      announce(
        sentAnnouncement(
          sendState.amount,
          test ? 'the address you tested' : sentLabelRef.current(sendState.recipient),
          test,
        ),
      );
      focusWhenShown(sentRef.current);
    }
  }, [sendState, announce]);

  useEffect(() => {
    if (!historyActionPending.current) return;
    if (history.status === 'success') {
      historyActionPending.current = false;
      const n = history.data.entries.length;
      announce(
        n === 0
          ? 'Activity loaded: no transfers yet.'
          : `Activity loaded: ${n} transfer${n === 1 ? '' : 's'}.`,
      );
    } else if (history.status === 'error') {
      historyActionPending.current = false;
      announce('Could not load activity. Lookalikes of your contacts are blocked until it loads.');
    }
  }, [history, announce]);

  // --- Render --------------------------------------------------------------

  const header = (
    <VStack gap={1}>
      <Box>
        <Tag colorScheme={scenario.kind === 'attack' ? 'red' : 'green'}>
          {scenario.kind === 'attack' ? 'Attack scenario' : 'Everyday scenario'}
        </Tag>
      </Box>
      <Text as="h1" font="title2">
        {scenario.title}
      </Text>
      <Text as="p" font="body" color="fgMuted">
        {scenario.summary}
      </Text>
      <Box background="bgPrimaryWash" borderRadius={300} padding={1.5}>
        <Text as="p" font="label1">
          Try this:{' '}
          <Text as="span" font="body">
            {scenario.tryThis}
          </Text>
        </Text>
      </Box>
    </VStack>
  );

  // The announcer stays first in both branches so the live region is never remounted.
  if (sendState.status === 'sent') {
    return (
      <VStack gap={4}>
        <AccessibilityAnnouncer message={announcement} />
        {header}
        <Box ref={sentRef}>
          {lastSendWasTest ? (
            <TestSentScreen
              recipient={sendState.recipient}
              amount={sendState.amount}
              contacts={contacts}
              onFollowUp={startFollowUp}
            />
          ) : (
            <SentScreen
              recipient={sendState.recipient}
              amount={sendState.amount}
              label={recipientLabel(sendState.recipient)}
              onStartOver={startOver}
            />
          )}
        </Box>
      </VStack>
    );
  }

  const sendPanel = (() => {
    if (step.kind === 'add-group') {
      return (
        <AddGroupForm
          names={names}
          user={scenario.user.address}
          contacts={contacts}
          protectedSet={protectedSet}
          config={config}
          onCancel={() => goTo({ kind: 'compose' })}
          onSave={(drafts) => {
            const saved = addContacts(drafts);
            goTo({
              kind: 'notice',
              tone: 'informational',
              title: `${drafts[0]?.group ?? 'Group'} saved: ${saved.length} contacts`,
              message: 'Pay any member from your contacts. Each one is now a trusted contact.',
            });
          }}
        />
      );
    }
    if (step.kind === 'add-contact') {
      return (
        <AddContactForm
          names={names}
          user={scenario.user.address}
          contacts={contacts}
          protectedSet={protectedSet}
          config={config}
          mode={step.mode}
          onCancel={() => goTo({ kind: 'compose' })}
          onSave={(draft) => {
            const saved = addContact(draft);
            // Saving never resumes the blocked send: the form is cleared.
            setRecipientInput('');
            setAmountInput('');
            goTo({
              kind: 'notice',
              tone: 'informational',
              title: `${saved.name} saved as a contact`,
              message:
                step.mode === 'after-block'
                  ? 'The blocked send stays cancelled. To pay them, start a new send from your contacts.'
                  : 'You can now pick them from your contacts.',
            });
          }}
        />
      );
    }
    if (step.kind === 'review' && result) {
      return sendState.status === 'sending' ? (
        <HStack gap={1.5} alignItems="center">
          <Spinner
            size={2}
            accessibilityLabel={`Sending ${formatUsdc(step.intent.amount)} USDC (simulated)`}
          />
          <Text as="p" font="body" aria-hidden="true">
            Sending {formatUsdc(step.intent.amount)} USDC (simulated)…
          </Text>
        </HStack>
      ) : (
        <DecisionPanel
          names={names}
          result={result}
          recipient={reviewedRecipient}
          amount={step.intent.amount}
          onConfirm={handleConfirm}
          onRecover={handleRecover}
          onCancel={() => goTo({ kind: 'compose' })}
          onUseTestAmount={handleUseTestAmount}
          onAddDifferentPerson={() => goTo({ kind: 'add-contact', mode: 'after-block' })}
        />
      );
    }
    return (
      <VStack
        as="form"
        gap={2}
        aria-label="Send USDC"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          review(recipientInput, amountInput);
        }}
      >
        {step.kind === 'notice' && (
          <Banner
            variant={step.tone}
            startIcon={step.tone === 'warning' ? 'warning' : 'checkmark'}
            startIconAccessibilityLabel={step.tone === 'warning' ? 'Warning' : 'Done'}
            styleVariant="contextual"
            title={
              <Text as="p" font="label1" {...FOCUS_ON_SHOW}>
                {step.title}
              </Text>
            }
          >
            <Text as="p" font="label2">
              {step.message}
            </Text>
          </Banner>
        )}
        <TextInput
          ref={recipientRef}
          label="Recipient address"
          placeholder="0x…"
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <TextInput
          ref={amountRef}
          label="Amount"
          suffix="USDC"
          inputMode="decimal"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          variant={amountError ? 'negative' : undefined}
          helperText={amountError ?? undefined}
        />
        <Button type="submit" block>
          Review send
        </Button>
      </VStack>
    );
  })();

  return (
    <VStack gap={4}>
      <AccessibilityAnnouncer message={announcement} />
      {header}

      <Grid
        templateColumns="repeat(auto-fit, minmax(min(100%, 420px), 1fr))"
        gap={4}
        alignItems="start"
      >
        <VStack gap={4}>
          <VStack as="section" gap={2} aria-labelledby="send-heading" ref={sendSectionRef}>
            <Text as="h2" font="title3" id="send-heading">
              Send USDC
            </Text>
            {sendPanel}
          </VStack>

          <VStack as="section" gap={2} aria-labelledby="contacts-heading">
            <Text as="h2" font="title3" id="contacts-heading">
              Contacts
            </Text>
            <ContactsPanel
              contacts={contacts}
              onSendTo={handleSendToContact}
              onAdd={() => goTo({ kind: 'add-contact', mode: 'normal' })}
              onAddGroup={() => goTo({ kind: 'add-group' })}
            />
          </VStack>
        </VStack>

        <VStack as="section" gap={2} aria-labelledby="history-heading">
          <Text as="h2" font="title3" id="history-heading">
            {scenario.user.name}&apos;s activity
          </Text>
          {testSends.length > 0 && (
            <Banner
              variant="warning"
              startIcon="warning"
              startIconAccessibilityLabel="Warning"
              styleVariant="contextual"
              title={
                <Text as="p" font="label1">
                  You just made a test send
                </Text>
              }
            >
              <Text as="p" font="label2">
                Do not copy an address from this list for the rest. Use your contacts or the address
                you tested.
              </Text>
            </Banner>
          )}
          <Text as="p" font="label2" color="fgMuted">
            Demo data (fixture scenario, complete coverage). Every address and transaction here is
            synthetic. Open a row for its details.
          </Text>
          <HistoryList
            names={names}
            history={history}
            classifications={classifications}
            onUseAddress={handleUseAddress}
            onRetry={handleRetryHistory}
          />
          <Box bordered borderRadius={300} padding={2} background="bgAlternate">
            <ControlGroup
              ControlComponent={Radio}
              role="radiogroup"
              name={`history-simulation-${scenario.id}`}
              label={
                <Text as="span" font="label1">
                  Demo: simulate the activity source
                </Text>
              }
              options={SIMULATIONS}
              value={simulation}
              onChange={changeSimulation}
              gap={1}
            />
          </Box>
        </VStack>
      </Grid>
    </VStack>
  );
}

function SentScreen({
  recipient,
  amount,
  label,
  onStartOver,
}: {
  recipient: Address;
  amount: bigint;
  label: string;
  onStartOver: () => void;
}) {
  return (
    <VStack gap={2} as="section" aria-labelledby="sent-heading" maxWidth={560}>
      <Text as="h2" font="title2" id="sent-heading" {...FOCUS_ON_SHOW}>
        Simulated send complete
      </Text>
      <Banner
        variant="informational"
        startIcon="info"
        startIconAccessibilityLabel="Note"
        styleVariant="contextual"
        title={
          <Text as="p" font="label1">
            Demo mode: nothing was sent
          </Text>
        }
      >
        <Text as="p" font="label2">
          No transaction was signed or broadcast. In live mode this step sends real testnet USDC on
          Base Sepolia.
        </Text>
      </Banner>
      <Text as="p" font="body">
        {formatUsdc(amount)} USDC to {label}
      </Text>
      <Text as="p" font="label2" mono color="fgMuted" overflow="break">
        {recipient}
      </Text>
      <Box>
        <Button variant="secondary" onClick={onStartOver}>
          Start over
        </Button>
      </Box>
    </VStack>
  );
}

function TestSentScreen({
  recipient,
  amount,
  contacts,
  onFollowUp,
}: {
  recipient: Address;
  amount: bigint;
  contacts: readonly { id: string; name: string; address: Address }[];
  onFollowUp: (address: Address) => void;
}) {
  return (
    <VStack gap={2} as="section" aria-labelledby="test-sent-heading" maxWidth={560}>
      <Text as="h2" font="title2" id="test-sent-heading" {...FOCUS_ON_SHOW}>
        Test send complete (simulated)
      </Text>
      <Text as="p" font="body">
        {formatUsdc(amount)} USDC to{' '}
        <Text as="span" mono font="body" overflow="break">
          {recipient}
        </Text>
      </Text>
      <Banner
        variant="warning"
        startIcon="warning"
        startIconAccessibilityLabel="Warning"
        styleVariant="contextual"
        title={
          <Text as="p" font="label1">
            Do not copy the address from your activity for the rest
          </Text>
        }
      >
        <Text as="p" font="label2">
          Scammers watch for test sends and plant a lookalike address within minutes. Ask the person
          to confirm the test arrived, then send the rest with the button below or from your
          contacts.
        </Text>
      </Banner>
      <Button block onClick={() => onFollowUp(recipient)}>
        Send the rest to the same address
      </Button>
      {contacts.map((c) => (
        <Button key={c.id} block variant="secondary" onClick={() => onFollowUp(c.address)}>
          Send to {c.name} (contact)
        </Button>
      ))}
      <Text as="p" font="label2" color="fgMuted">
        Demo mode: nothing was signed or broadcast.
      </Text>
    </VStack>
  );
}
