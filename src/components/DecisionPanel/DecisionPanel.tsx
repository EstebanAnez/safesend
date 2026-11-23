'use client';

import { useId, useState } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { TextInput } from '@coinbase/cds-web/controls';
import { Box, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { TrustAnchor } from '@/domain/types';
import { formatUsdc } from '@/lib/amount';
import { anchorLabel } from '@/risk/anchors';
import type { Reason, RiskResult } from '@/risk/types';
import { AddressComparison } from '@/components/AddressComparison/AddressComparison';

interface Props {
  result: RiskResult;
  recipient: Address | null;
  amount: bigint;
  onConfirm: () => void;
  onRecover: (anchor: TrustAnchor) => void;
  onCancel: () => void;
}

export function DecisionPanel({
  result,
  recipient,
  amount,
  onConfirm,
  onRecover,
  onCancel,
}: Props) {
  const headingId = useId();
  const recovery = result.reasons.find(
    (r): r is Reason & { evidence: { kind: 'lookalike' } } => r.evidence.kind === 'lookalike',
  );

  return (
    <VStack as="section" gap={2} aria-labelledby={headingId}>
      <Text as="h2" font="title3" id={headingId}>
        {result.decision === 'BLOCK'
          ? 'SafeSend stopped this send'
          : result.decision === 'WARN'
            ? 'Check before you send'
            : 'Ready to send'}
      </Text>

      <VStack as="ul" gap={1.5} aria-label="Reasons for this decision">
        {result.reasons.map((reason) => (
          <Box as="li" key={reason.code + reason.title}>
            <Banner
              variant={
                reason.severity === 'block'
                  ? 'error'
                  : reason.severity === 'warn'
                    ? 'warning'
                    : 'informational'
              }
              startIcon={
                reason.severity === 'block'
                  ? 'error'
                  : reason.severity === 'warn'
                    ? 'warning'
                    : 'checkmark'
              }
              startIconAccessibilityLabel={
                reason.severity === 'block'
                  ? 'Blocked'
                  : reason.severity === 'warn'
                    ? 'Warning'
                    : 'OK'
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
          </Box>
        ))}
      </VStack>

      {recovery && (
        <AddressComparison
          comparison={recovery.evidence.comparison}
          candidateLabel="You entered"
          anchorLabel={anchorLabel(recovery.evidence.anchor)}
        />
      )}

      {result.decision === 'BLOCK' && (
        <VStack gap={1}>
          {recovery && (
            <Button block onClick={() => onRecover(recovery.evidence.anchor)}>
              Send to {anchorLabel(recovery.evidence.anchor)} instead
            </Button>
          )}
          <Button block variant="secondary" onClick={onCancel}>
            Go back
          </Button>
          <Text as="p" font="label2" color="fgMuted">
            Blocked sends cannot be overridden in SafeSend.
          </Text>
        </VStack>
      )}

      {result.decision === 'WARN' && recipient && (
        <WarnConfirmation
          recipient={recipient}
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

/** WARN needs an explicit, deliberate confirmation: type the last 4 characters. */
function WarnConfirmation({
  recipient,
  amount,
  onConfirm,
  onCancel,
}: {
  recipient: Address;
  amount: bigint;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const last4 = recipient.slice(-4).toLowerCase();
  const matches = typed.trim().toLowerCase() === last4;

  return (
    <VStack gap={1}>
      <TextInput
        label="To confirm, type the last 4 characters of the address"
        helperText="Read them from the person, not from your history."
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        maxLength={4}
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
