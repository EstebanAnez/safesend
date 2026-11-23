'use client';

import { memo, useId, useState } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { Box, Fallback, HStack, VStack } from '@coinbase/cds-web/layout';
import { Pressable } from '@coinbase/cds-web/system';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type {
  AsyncState,
  HistoryEntry,
  HistoryPage,
  PoisoningTechnique,
  Provenance,
} from '@/domain/types';
import { formatUsdc } from '@/lib/amount';
import { formatTime, shortAddress } from '@/lib/format';
import { anchorLabel } from '@/risk/anchors';
import type { HistoryClassification } from '@/risk/history';

interface Props {
  history: AsyncState<HistoryPage>;
  classifications: ReadonlyMap<string, HistoryClassification>;
  onUseAddress: (address: Address) => void;
  onRetry: () => void;
}

const SKELETON_ROWS = 5;

/**
 * The user's USDC activity, newest first, one dense row per transfer.
 *
 * Rows are disclosure buttons: details (full address, signer, source, tx) and
 * "Use as recipient" only appear for the row the user opens, so the list stays
 * scannable and the riskiest action (copying an address from history) is never
 * repeated down the page. Planted entries stay collapsed behind an explanation.
 */
export function HistoryList({ history, classifications, onUseAddress, onRetry }: Props) {
  if (history.status === 'idle' || history.status === 'loading') {
    return (
      <VStack gap={1} aria-busy="true">
        <Text as="p" font="label2" color="fgMuted" role="status">
          Loading activity…
        </Text>
        <VStack as="ul" bordered borderRadius={300} aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <Box as="li" key={i} padding={1.5} borderedBottom={i < SKELETON_ROWS - 1}>
              <HStack justifyContent="space-between" alignItems="center" gap={2}>
                <VStack gap={1} flexGrow={1}>
                  <Fallback width="70%" height={16} percentage disableRandomRectWidth />
                  <Fallback width="45%" height={12} percentage disableRandomRectWidth />
                </VStack>
                <Fallback width={64} height={16} />
              </HStack>
            </Box>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (history.status === 'error') {
    return (
      <Banner
        variant="error"
        startIcon="error"
        startIconAccessibilityLabel="Error"
        styleVariant="contextual"
        title={
          <Text as="p" font="label1">
            Could not load activity
          </Text>
        }
        primaryAction={
          <Button variant="secondary" compact onClick={onRetry}>
            Try again
          </Button>
        }
      >
        <Text as="p" font="label2">
          {history.error.message} Until it loads, SafeSend blocks any address that looks like one of
          your contacts, and it cannot check against people you have paid before.
        </Text>
      </Banner>
    );
  }

  const { entries } = history.data;
  if (entries.length === 0) {
    return (
      <VStack gap={0.5} bordered borderRadius={300} padding={2}>
        <Text as="p" font="headline">
          No USDC activity yet
        </Text>
        <Text as="p" font="body" color="fgMuted">
          When you send or receive USDC, each transfer shows up here with where the address came
          from.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack
      as="ul"
      bordered
      borderRadius={300}
      overflow="hidden"
      aria-label={`USDC activity, newest first, ${entries.length} transfers`}
    >
      {entries.map((entry, i) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          last={i === entries.length - 1}
          classification={classifications.get(entry.id) ?? { kind: 'normal' }}
          onUseAddress={onUseAddress}
        />
      ))}
    </VStack>
  );
}

const HistoryRow = memo(function HistoryRow({
  entry,
  last,
  classification,
  onUseAddress,
}: {
  entry: HistoryEntry;
  last: boolean;
  classification: HistoryClassification;
  onUseAddress: (address: Address) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const toggle = () => setExpanded((v) => !v);

  if (classification.kind === 'suspected-poisoning') {
    const imitated = anchorLabel(classification.anchor);
    return (
      <Box as="li" padding={1.5} borderedBottom={!last} background="bgWarningWash">
        <VStack gap={1}>
          <HStack gap={1} alignItems="center" flexWrap="wrap">
            <Tag colorScheme="red" emphasis="high">
              Suspected lookalike
            </Tag>
            <Text as="p" font="label1">
              Hidden: imitates {imitated}
            </Text>
          </HStack>
          <Text as="p" font="label2" color="fgMuted">
            {techniqueExplanation(classification.technique)}
          </Text>
          <Box>
            <Button
              variant="secondary"
              compact
              onClick={toggle}
              aria-expanded={expanded}
              aria-controls={detailsId}
              accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details of the suspected lookalike of ${imitated}`}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </Button>
          </Box>
          <div id={detailsId} hidden={!expanded}>
            <VStack gap={1}>
              <Summary entry={entry} />
              <Details entry={entry} onUseAddress={onUseAddress} />
            </VStack>
          </div>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack as="li" borderedBottom={!last}>
      <Pressable
        background="bg"
        width="100%"
        paddingX={1.5}
        paddingY={1.5}
        noScaleOnPress
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <Summary entry={entry} unusualOrigin={classification.kind === 'suspicious-origin'} />
      </Pressable>
      {/* `hidden` on a plain div: a CDS Box's display class would override it. */}
      <div id={detailsId} hidden={!expanded}>
        <Box paddingX={1.5} paddingBottom={1.5}>
          <Details entry={entry} onUseAddress={onUseAddress} />
        </Box>
      </div>
    </VStack>
  );
});

/** One line of who and how much, one line of when and how we know. Spans: it sits in a button. */
function Summary({
  entry,
  unusualOrigin = false,
}: {
  entry: HistoryEntry;
  unusualOrigin?: boolean;
}) {
  const label =
    entry.direction === 'in'
      ? 'Received from'
      : entry.direction === 'out'
        ? 'Sent to'
        : 'Transfer with';
  const sign = entry.direction === 'in' ? '+' : entry.direction === 'out' ? '−' : '';
  return (
    <HStack as="span" justifyContent="space-between" alignItems="center" gap={2} width="100%">
      <VStack as="span" gap={0.5} alignItems="flex-start" minWidth={0}>
        <Text as="span" font="headline" textAlign="start">
          {label}{' '}
          <Text as="span" mono font="headline">
            {shortAddress(entry.counterparty)}
          </Text>
        </Text>
        <HStack as="span" gap={1} alignItems="center" flexWrap="wrap">
          <Text as="span" font="label2" color="fgMuted">
            {formatTime(entry.blockTime)}
          </Text>
          <ProvenanceTag provenance={entry.provenance} />
          {unusualOrigin && <Tag colorScheme="yellow">Unusual origin</Tag>}
        </HStack>
      </VStack>
      <Text as="span" font="headline" textAlign="end" noWrap>
        {sign}
        {formatUsdc(entry.amount)}{' '}
        {entry.isCanonicalUsdc ? 'USDC' : (entry.tokenSymbolClaimed ?? '?')}
      </Text>
    </HStack>
  );
}

function Details({
  entry,
  onUseAddress,
}: {
  entry: HistoryEntry;
  onUseAddress: (address: Address) => void;
}) {
  return (
    <VStack gap={1}>
      <Text as="p" mono font="label2" color="fg" overflow="break">
        {entry.counterparty}
      </Text>
      <Text as="p" font="label2" color="fgMuted">
        Signed by{' '}
        {entry.txSigner.status === 'known' ? (
          <Text as="span" mono font="label2">
            {shortAddress(entry.txSigner.address)}
          </Text>
        ) : (
          'unknown'
        )}
        {' · '}Source: {entry.source}
        {' · '}Tx{' '}
        <Text as="span" mono font="label2">
          {entry.txHash.slice(0, 10)}…
        </Text>
      </Text>
      <Box>
        <Button
          variant="secondary"
          compact
          onClick={() => onUseAddress(entry.counterparty)}
          accessibilityLabel={`Use address ${entry.counterparty} as recipient`}
        >
          Use as recipient
        </Button>
      </Box>
    </VStack>
  );
}

function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  switch (provenance) {
    case 'verified':
      return <Tag colorScheme="green">Verified onchain</Tag>;
    case 'inferred':
      return <Tag colorScheme="yellow">Inferred</Tag>;
    case 'unknown':
      return <Tag colorScheme="gray">Provenance unknown</Tag>;
  }
}

function techniqueExplanation(technique: PoisoningTechnique): string {
  switch (technique) {
    case 'dust':
      return 'Someone sent you a tiny amount from an address made to look like someone you pay. They hope you copy it from your history next time.';
    case 'zero-value':
      return 'A 0 USDC transfer you did not sign was recorded with your address as the sender, so a fake address shows up as if you had paid it.';
    case 'after-test-send':
      return 'This address looks like the person you just sent a test to, and it showed up right after your test send. Scammers watch for test sends. Send the rest from your contacts, not from here.';
    case 'counterfeit-token':
      return 'This transfer used a fake token that only claims to be USDC, sent from an address made to look like someone you pay.';
  }
}
