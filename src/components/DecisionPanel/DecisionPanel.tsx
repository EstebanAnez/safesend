'use client';

import { useId, useState } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { Checkbox, TextInput } from '@coinbase/cds-web/controls';
import { Box, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { ProtectedAddress } from '@/domain/types';
import { useChallengePositions } from '@/hooks/useChallengePositions';
import { formatUsdc } from '@/lib/amount';
import { anchorLabel } from '@/risk/anchors';
import { nameFor } from '@/risk/names';
import type { NameBook } from '@/risk/names';
import { checkChallengeAnswer } from '@/risk/confirmation';
import type { Reason, RiskResult } from '@/risk/types';
import { FOCUS_ON_SHOW } from '@/components/a11y/focus';
import {
  AddressComparison,
  AddressWithHighlights,
  describePositions,
} from '@/components/AddressComparison/AddressComparison';

interface Props {
  result: RiskResult;
  recipient: Address | null;
  amount: bigint;
  onConfirm: () => void;
  onRecover: (anchor: ProtectedAddress) => void;
  onCancel: () => void;
  /** Switch to a small test amount (shown when the engine suggests a test send). */
  onUseTestAmount?: () => void;
  /** BLOCK only: start the deliberate "add a different person" flow. Never resumes this send. */
  onAddDifferentPerson?: () => void;
  /** Names for known addresses (exact match only), for the comparison and recovery copy. */
  names?: NameBook;
  /** Injectable for tests; defaults to the platform CSPRNG. */
  random?: () => number;
}

type LookalikeReason = Reason & { evidence: Extract<Reason['evidence'], { kind: 'lookalike' }> };

export function DecisionPanel({
  result,
  recipient,
  amount,
  onConfirm,
  onRecover,
  onCancel,
  onUseTestAmount,
  onAddDifferentPerson,
  names,
  random,
}: Props) {
  const headingId = useId();
  const otherId = useId();
  const [showOther, setShowOther] = useState(false);
  const lookalike = result.reasons.find(
    (r): r is LookalikeReason => r.evidence.kind === 'lookalike',
  );
  const positions = useChallengePositions(result.confirmation, recipient, random);
  // On a BLOCK, only the blocking reasons lead. Anything else ("first send, large amount") is
  // secondary: it cannot change the outcome, and next to a BLOCK it reads as a way forward.
  const blocked = result.decision === 'BLOCK';
  const primary = blocked ? result.reasons.filter((r) => r.severity === 'block') : result.reasons;
  const other = blocked ? result.reasons.filter((r) => r.severity !== 'block') : [];

  return (
    <VStack as="section" gap={2} aria-labelledby={headingId}>
      <Text as="h3" font="title3" id={headingId} {...FOCUS_ON_SHOW}>
        {result.decision === 'BLOCK'
          ? 'SafeSend stopped this send'
          : result.decision === 'WARN'
            ? 'Check before you send'
            : 'Ready to send'}
      </Text>

      {/* The hero: shown first so the "why" is obvious within two seconds. */}
      {lookalike && (
        <AddressComparison
          comparison={lookalike.evidence.comparison}
          candidateLabel="You entered"
          anchorLabel={anchorLabel(lookalike.evidence.anchor, names)}
          highlight={positions}
        />
      )}

      <VStack as="ul" gap={1.5} aria-label="Reasons for this decision">
        {primary.map((reason) => (
          <Box as="li" key={reason.code + reason.title}>
            <ReasonBanner reason={reason} />
          </Box>
        ))}
      </VStack>

      {other.length > 0 && (
        <VStack gap={1}>
          <Box>
            <Button
              variant="tertiary"
              compact
              onClick={() => setShowOther((v) => !v)}
              aria-expanded={showOther}
              aria-controls={otherId}
            >
              {showOther ? 'Hide other signals' : `Other signals (${other.length})`}
            </Button>
          </Box>
          {/* `hidden` on a plain div: a CDS stack's display class would override it. */}
          <div id={otherId} hidden={!showOther}>
            <VStack as="ul" gap={1.5} aria-label="Other signals">
              {other.map((reason) => (
                <Box as="li" key={reason.code + reason.title}>
                  <ReasonBanner reason={reason} />
                </Box>
              ))}
            </VStack>
          </div>
        </VStack>
      )}

      {result.testSendSuggested && (
        <Banner
          variant="informational"
          startIcon="info"
          startIconAccessibilityLabel="Tip"
          styleVariant="contextual"
          title={
            <Text as="p" font="label1">
              Try a small test send first
            </Text>
          }
          primaryAction={
            onUseTestAmount ? (
              <Button variant="secondary" compact onClick={onUseTestAmount}>
                Send 1 USDC as a test
              </Button>
            ) : undefined
          }
        >
          <Text as="p" font="label2">
            Send a small amount, then confirm with the person by phone that it arrived before you
            send the rest. Scammers watch for test sends and plant a lookalike address within
            minutes, so check the full address again for the second send.
          </Text>
        </Banner>
      )}

      {result.decision === 'BLOCK' && (
        <VStack gap={1}>
          {lookalike && (
            <Button block onClick={() => onRecover(lookalike.evidence.anchor)}>
              {recoveryLabel(lookalike.evidence.anchor, names)}
            </Button>
          )}
          <Button block variant="secondary" onClick={onCancel}>
            Go back
          </Button>
          {lookalike && onAddDifferentPerson && (
            <Button block variant="tertiary" onClick={onAddDifferentPerson}>
              This is a different person
            </Button>
          )}
          <Text as="p" font="label2" color="fgMuted">
            Blocked sends cannot be overridden in SafeSend. If this really is someone else, add them
            as a contact after checking their address by phone, then start a new send.
          </Text>
        </VStack>
      )}

      {result.decision === 'WARN' && recipient && result.confirmation.level === 'acknowledge' && (
        <AcknowledgeConfirmation
          statement={result.confirmation.statement}
          amount={amount}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}

      {result.decision === 'WARN' && recipient && positions && (
        <MiddleCharacterConfirmation
          recipient={recipient}
          positions={positions}
          showAddress={!lookalike}
          amount={amount}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}

      {result.decision === 'ALLOW' && (
        <VStack gap={1}>
          <Button block onClick={onConfirm}>
            Send {formatUsdc(amount)} USDC (simulated)
          </Button>
          <Button block variant="secondary" onClick={onCancel}>
            Go back
          </Button>
        </VStack>
      )}
    </VStack>
  );
}

function recoveryLabel(anchor: ProtectedAddress, names: NameBook | undefined): string {
  if (anchor.kind === 'contact') return `Send to ${anchor.contact.name} instead`;
  const name = nameFor(anchor.address, names);
  if (name) return `Send to ${name} instead`;
  return anchor.kind === 'inbound-sender'
    ? 'Use the address that sent you USDC instead'
    : 'Use the address you paid before instead';
}

function ReasonBanner({ reason }: { reason: Reason }) {
  return (
    <Banner
      variant={
        reason.severity === 'block'
          ? 'error'
          : reason.severity === 'warn'
            ? 'warning'
            : 'informational'
      }
      startIcon={
        reason.severity === 'block' ? 'error' : reason.severity === 'warn' ? 'warning' : 'checkmark'
      }
      startIconAccessibilityLabel={
        reason.severity === 'block' ? 'Blocked' : reason.severity === 'warn' ? 'Warning' : 'OK'
      }
      styleVariant="contextual"
      // Text nodes (not strings) so CDS does not clamp a reason mid-sentence.
      title={
        <Text as="p" font="label1">
          {reason.title}
        </Text>
      }
    >
      <Text as="p" font="label2">
        {reason.explanation}
      </Text>
    </Banner>
  );
}

/** Light confirmation: a new recipient below the first-send threshold, nothing else. */
function AcknowledgeConfirmation({
  statement,
  amount,
  onConfirm,
  onCancel,
}: {
  statement: string;
  amount: bigint;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <VStack gap={1}>
      <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)}>
        {statement}
      </Checkbox>
      <Button block disabled={!checked} onClick={onConfirm}>
        Send {formatUsdc(amount)} USDC (simulated)
      </Button>
      <Button block variant="secondary" onClick={onCancel}>
        Go back
      </Button>
    </VStack>
  );
}

/**
 * Type 4 characters from the MIDDLE of the address, at random positions.
 * Never the first or last characters: lookalikes are built to match those.
 */
function MiddleCharacterConfirmation({
  recipient,
  positions,
  showAddress,
  amount,
  onConfirm,
  onCancel,
}: {
  recipient: Address;
  positions: readonly number[];
  showAddress: boolean;
  amount: bigint;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = checkChallengeAnswer(recipient, positions, typed);
  const where = describePositions(positions);

  return (
    <VStack gap={1}>
      {showAddress && <AddressWithHighlights address={recipient} highlight={positions} />}
      <TextInput
        label={`Type characters ${where} of the address (outlined above)`}
        helperText="Check them against the address the person gave you, not against your history."
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        maxLength={positions.length * 2}
      />
      <Button block disabled={!matches} onClick={onConfirm}>
        Send {formatUsdc(amount)} USDC (simulated)
      </Button>
      <Button block variant="secondary" onClick={onCancel}>
        Go back
      </Button>
    </VStack>
  );
}
