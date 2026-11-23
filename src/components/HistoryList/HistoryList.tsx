'use client';

import { memo, useId, useState } from 'react';
import { Button } from '@coinbase/cds-web/buttons';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { HistoryEntry, PoisoningTechnique, Provenance } from '@/domain/types';
import { formatUsdc } from '@/lib/amount';
import { formatTime, shortAddress } from '@/lib/format';
import { anchorLabel } from '@/risk/anchors';
import type { HistoryClassification } from '@/risk/history';

interface Props {
  entries: readonly HistoryEntry[];
  classifications: ReadonlyMap<string, HistoryClassification>;
  onUseAddress: (address: Address) => void;
}

export function HistoryList({ entries, classifications, onUseAddress }: Props) {
  if (entries.length === 0) {
    return (
      <Text as="p" font="body" color="fgMuted">
        No USDC activity yet.
      </Text>
    );
  }
  return (
    <VStack as="ul" gap={1} aria-label="USDC activity, newest first">
      {entries.map((entry) => (
        <HistoryRow
          key={entry.id}
          entry={entry}
          classification={classifications.get(entry.id) ?? { kind: 'normal' }}
          onUseAddress={onUseAddress}
        />
      ))}
    </VStack>
  );
}

const HistoryRow = memo(function HistoryRow({
  entry,
  classification,
  onUseAddress,
}: {
  entry: HistoryEntry;
  classification: HistoryClassification;
  onUseAddress: (address: Address) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const suspected = classification.kind === 'suspected-poisoning';

  return (
    <Box
      as="li"
      bordered
      borderRadius={300}
      padding={2}
      background={suspected ? 'bgWarningWash' : 'bg'}
    >
      {suspected ? (
        <VStack gap={1}>
          <HStack gap={1} alignItems="center" flexWrap="wrap">
            <Tag colorScheme="red" emphasis="high">
              Suspected lookalike
            </Tag>
            <Text as="p" font="label1">
              Hidden: imitates {anchorLabel(classification.anchor)}
            </Text>
          </HStack>
          <Text as="p" font="body" color="fgMuted">
            {techniqueExplanation(classification.technique)}
          </Text>
          <Box>
            <Button
              variant="secondary"
              compact
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={detailsId}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </Button>
          </Box>
          <div id={detailsId} hidden={!expanded}>
            <EntryBody entry={entry} onUseAddress={onUseAddress} />
          </div>
        </VStack>
      ) : (
        <EntryBody entry={entry} onUseAddress={onUseAddress} />
      )}
    </Box>
  );
});

function EntryBody({
  entry,
  onUseAddress,
}: {
  entry: HistoryEntry;
  onUseAddress: (address: Address) => void;
}) {
  const label =
    entry.direction === 'in'
      ? 'Received from'
      : entry.direction === 'out'
        ? 'Sent to'
        : 'Transfer with';
  const sign = entry.direction === 'in' ? '+' : entry.direction === 'out' ? '−' : '';
  return (
    <VStack gap={1}>
      <HStack justifyContent="space-between" alignItems="flex-start" gap={2}>
        <VStack gap={0.5}>
          <Text as="p" font="headline">
            {label}{' '}
            <Text as="span" mono font="headline">
              {shortAddress(entry.counterparty)}
            </Text>
          </Text>
          <Text as="p" font="label2" color="fgMuted">
            {formatTime(entry.blockTime)}
          </Text>
        </VStack>
        <Text as="p" font="headline">
          {sign}
          {formatUsdc(entry.amount)}{' '}
          {entry.isCanonicalUsdc ? 'USDC' : (entry.tokenSymbolClaimed ?? '?')}
        </Text>
      </HStack>
      <HStack gap={1} flexWrap="wrap" alignItems="center">
        <ProvenanceTag provenance={entry.provenance} />
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
      </HStack>
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
