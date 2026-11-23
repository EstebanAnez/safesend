'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { TextInput } from '@coinbase/cds-web/controls';
import { Box, VStack } from '@coinbase/cds-web/layout';
import { Spinner } from '@coinbase/cds-web/loaders';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { HistoryEntry, TrustAnchor } from '@/domain/types';
import { useDemoScenario } from '@/hooks/useDemoScenario';
import { useRiskDecision } from '@/hooks/useRiskDecision';
import { useSimulatedSend } from '@/hooks/useSimulatedSend';
import { AMOUNT_ERROR_TEXT, formatUsdc, parseUsdcAmount } from '@/lib/amount';
import { parseAddress, sameAddress } from '@/risk/address';
import { anchorLabel } from '@/risk/anchors';
import { reverifySend } from '@/risk/reverify';
import type { RiskInput, SendIntent } from '@/risk/types';
import { DecisionPanel } from '@/components/DecisionPanel/DecisionPanel';
import { HistoryList } from '@/components/HistoryList/HistoryList';

const EMPTY_HISTORY: readonly HistoryEntry[] = [];

type Step =
  | { kind: 'compose' }
  | { kind: 'review'; intent: SendIntent }
  | { kind: 'aborted'; message: string };

export function DemoJourney({ scenarioId }: { scenarioId: string }) {
  const { scenario, config, history, anchors, classifications, testSends, recordTestSend } =
    useDemoScenario(scenarioId);
  /** The current review was started from the test-send nudge. */
  const [testPending, setTestPending] = useState(false);
  const [lastSendWasTest, setLastSendWasTest] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'compose' });
  const { state: sendState, send, reset } = useSimulatedSend();
  const recipientRef = useRef<HTMLInputElement>(null);

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
            config,
          }
        : null,
    [step, scenario.user.address, anchors, historyEntries, historyAvailable, testSends, config],
  );
  const result = useRiskDecision(riskInput);
  const reviewedRecipient = useMemo(() => {
    if (step.kind !== 'review') return null;
    const parsed = parseAddress(step.intent.recipientInput);
    return parsed.ok ? parsed.address : null;
  }, [step]);

  const review = useCallback((recipient: string, amountRaw: string) => {
    const amount = parseUsdcAmount(amountRaw);
    if (!amount.ok) {
      setAmountError(AMOUNT_ERROR_TEXT[amount.error]);
      return;
    }
    setAmountError(null);
    setStep({
      kind: 'review',
      intent: {
        recipientInput: recipient,
        amount: amount.value,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        tokenContract: CANONICAL_USDC.address,
      },
    });
  }, []);

  const handleUseAddress = useCallback((address: Address) => {
    setTestPending(false);
    setRecipientInput(address);
    setStep({ kind: 'compose' });
    recipientRef.current?.focus();
  }, []);

  const handleRecover = useCallback(
    (anchor: TrustAnchor) => {
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
      intent: {
        ...riskInput.intent,
        recipientInput,
        amount: amountNow.ok ? amountNow.value : -1n,
      },
    };
    const check = reverifySend({
      reviewed: { intent: step.intent, result },
      final,
      confirmationSatisfied: true,
    });
    if (!check.ok) {
      setStep({ kind: 'aborted', message: check.message });
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
  ]);

  const handleUseTestAmount = useCallback(() => {
    setTestPending(true);
    setAmountInput('1');
    review(recipientInput, '1');
  }, [recipientInput, review]);

  /** After a test send: compose the real send without touching history. */
  const startFollowUp = useCallback(
    (address: Address) => {
      reset();
      setTestPending(false);
      setLastSendWasTest(false);
      setRecipientInput(address);
      setAmountInput('');
      setStep({ kind: 'compose' });
      requestAnimationFrame(() => amountRef.current?.focus());
    },
    [reset],
  );

  if (sendState.status === 'sent' && lastSendWasTest) {
    const testRecipient = sendState.recipient;
    return (
      <VStack gap={2} as="section" aria-labelledby="test-sent-heading">
        <Text as="h2" font="title2" id="test-sent-heading">
          Test send complete (simulated)
        </Text>
        <Text as="p" font="body">
          {formatUsdc(sendState.amount)} USDC to{' '}
          <Text as="span" mono font="body">
            {testRecipient}
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
            Scammers watch for test sends and plant a lookalike address within minutes. Ask the
            person to confirm the test arrived, then send the rest with the button below or from
            your contacts.
          </Text>
        </Banner>
        <Button block onClick={() => startFollowUp(testRecipient)}>
          Send the rest to the same address
        </Button>
        {scenario.contacts.map((c) => (
          <Button key={c.id} block variant="secondary" onClick={() => startFollowUp(c.address)}>
            Send to {c.name} (contact)
          </Button>
        ))}
        <Text as="p" font="label2" color="fgMuted">
          Demo mode: nothing was signed or broadcast.
        </Text>
      </VStack>
    );
  }

  if (sendState.status === 'sent') {
    const anchor = anchors.find((a) => sameAddress(a.address, sendState.recipient));
    return (
      <VStack gap={2} as="section" aria-labelledby="sent-heading">
        <Text as="h2" font="title2" id="sent-heading">
          Simulated send complete
        </Text>
        <Banner
          variant="informational"
          startIcon="info"
          startIconAccessibilityLabel="Note"
          styleVariant="contextual"
          title="Demo mode: nothing was sent"
        >
          No transaction was signed or broadcast. In live mode this step sends real testnet USDC on
          Base Sepolia.
        </Banner>
        <Text as="p" font="body">
          {formatUsdc(sendState.amount)} USDC to {anchor ? anchorLabel(anchor) : 'a new address'}
        </Text>
        <Text as="p" font="label2" mono color="fgMuted">
          {sendState.recipient}
        </Text>
        <Box>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              setRecipientInput('');
              setAmountInput('');
              setStep({ kind: 'compose' });
            }}
          >
            Start over
          </Button>
        </Box>
      </VStack>
    );
  }

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text as="h1" font="title2">
          {scenario.title}
        </Text>
        <Text as="p" font="body" color="fgMuted">
          {scenario.summary}
        </Text>
      </VStack>

      <VStack as="section" gap={2} aria-labelledby="history-heading">
        <Text as="h2" font="title3" id="history-heading">
          {scenario.user.name}&apos;s activity
        </Text>
        {history.status === 'loading' && <Spinner size={3} accessibilityLabel="Loading activity" />}
        {history.status === 'error' && (
          <Banner
            variant="error"
            startIcon="error"
            styleVariant="contextual"
            title="Could not load activity"
          >
            {history.error.message}
          </Banner>
        )}
        {history.status === 'success' && (
          <>
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
                  Do not copy an address from this list for the rest. Use your contacts or the
                  address you tested.
                </Text>
              </Banner>
            )}
            <Text as="p" font="label2" color="fgMuted">
              Demo data (fixture scenario). Every address and transaction here is synthetic.
            </Text>
            <HistoryList
              entries={history.data.entries}
              classifications={classifications}
              onUseAddress={handleUseAddress}
            />
          </>
        )}
      </VStack>

      <VStack as="section" gap={2} aria-labelledby="send-heading">
        <Text as="h2" font="title3" id="send-heading">
          Send USDC
        </Text>
        {step.kind === 'review' && result ? (
          sendState.status === 'sending' ? (
            <Spinner size={3} accessibilityLabel="Sending (simulated)" />
          ) : (
            <DecisionPanel
              result={result}
              recipient={reviewedRecipient}
              amount={step.intent.amount}
              onConfirm={handleConfirm}
              onRecover={handleRecover}
              onCancel={() => setStep({ kind: 'compose' })}
              onUseTestAmount={handleUseTestAmount}
            />
          )
        ) : (
          <VStack
            as="form"
            gap={2}
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              review(recipientInput, amountInput);
            }}
          >
            {step.kind === 'aborted' && (
              <Banner
                variant="warning"
                startIcon="warning"
                styleVariant="contextual"
                title="Send stopped"
              >
                {step.message}
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
        )}
      </VStack>
    </VStack>
  );
}
