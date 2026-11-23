'use client';

import { memo, useId } from 'react';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import { displayPosition } from '@/risk/confirmation';
import type { CharacterComparison } from '@/risk/types';

const GROUP = 4;
const GROUPS_PER_LINE = 5;

interface Props {
  comparison: CharacterComparison;
  candidateLabel: string;
  anchorLabel: string;
  /** Hex indexes the user is asked to confirm; outlined in the candidate row. */
  highlight?: readonly number[] | null;
}

type Position = CharacterComparison['positions'][number];

/**
 * The hero of SafeSend: why this address is not the person you think.
 *
 * Read in two seconds, top to bottom:
 * 1. A plain sentence ("Same start and end. Different middle.").
 * 2. A 40-cell strip: hollow cells match, solid cells differ. Shape, not only
 *    color, carries the meaning; the ends look the same, the middle doesn't.
 * 3. The two addresses aligned in groups of 4, two lines each, differing
 *    characters bold and underlined on a tinted background.
 *
 * Screen readers get the sentence plus a text description; the visual strip
 * and grid are aria-hidden duplicates of that information.
 */
export const AddressComparison = memo(function AddressComparison({
  comparison,
  candidateLabel,
  anchorLabel,
  highlight,
}: Props) {
  const descId = useId();
  const total = comparison.positions.length;
  const middle = total - comparison.prefixMatchLength - comparison.suffixMatchLength;
  const differing = total - comparison.totalMatching;
  const highlighted = new Set(highlight ?? []);
  const lines = chunk(chunk(comparison.positions, GROUP), GROUPS_PER_LINE);

  return (
    <VStack
      gap={2}
      padding={2}
      borderRadius={400}
      bordered
      background="bg"
      aria-describedby={descId}
      role="group"
      aria-label={`Address comparison: ${candidateLabel} versus ${anchorLabel}`}
    >
      <VStack gap={0.5}>
        <Text as="p" font="headline">
          Same start and end. Different middle.
        </Text>
        <Text as="p" font="body" color="fgMuted" id={descId}>
          The first {comparison.prefixMatchLength} and last {comparison.suffixMatchLength}{' '}
          characters match {anchorLabel}. {differing} of the {middle} characters in between are
          different, so this is a different address.
        </Text>
      </VStack>

      <MatchStrip positions={comparison.positions} />

      <VStack gap={1.5} aria-hidden="true">
        <HStack gap={2} flexWrap="wrap">
          <Legend swatch="solid" label="Different" />
          <Legend swatch="hollow" label="Same" />
        </HStack>
        {lines.map((groups, lineIndex) => (
          <VStack key={lineIndex} gap={0.25}>
            <AddressLine
              label={lineIndex === 0 ? candidateLabel : ''}
              groups={groups}
              pick={(p) => p.candidate}
              emphasize
              highlighted={highlighted}
              prefix={lineIndex === 0 ? '0x' : '  '}
            />
            <AddressLine
              label={lineIndex === 0 ? anchorLabel : ''}
              groups={groups}
              pick={(p) => p.anchor}
              emphasize={false}
              highlighted={new Set()}
              prefix={lineIndex === 0 ? '0x' : '  '}
            />
          </VStack>
        ))}
      </VStack>

      <VStack gap={0.5}>
        <Text as="p" font="label2" color="fgMuted">
          {candidateLabel}
        </Text>
        <Text as="p" mono font="label2" color="fg">
          {comparison.candidate}
        </Text>
        <Text as="p" font="label2" color="fgMuted">
          {anchorLabel}
        </Text>
        <Text as="p" mono font="label2" color="fg">
          {comparison.anchor}
        </Text>
      </VStack>
    </VStack>
  );
});

function MatchStrip({ positions }: { positions: readonly Position[] }) {
  return (
    <VStack gap={0.5} aria-hidden="true">
      <HStack gap={0.5} width="100%">
        {chunk(positions, GROUP).map((group, g) => (
          <HStack key={g} gap={0.25} flexGrow={1}>
            {group.map((p) => (
              <Box
                key={p.index}
                flexGrow={1}
                height={20}
                borderRadius={100}
                bordered={p.match}
                background={p.match ? 'bg' : 'bgNegative'}
                data-match={p.match}
              />
            ))}
          </HStack>
        ))}
      </HStack>
      <HStack justifyContent="space-between">
        <Text font="label2" color="fgMuted">
          start
        </Text>
        <Text font="label2" color="fgMuted">
          middle
        </Text>
        <Text font="label2" color="fgMuted">
          end
        </Text>
      </HStack>
    </VStack>
  );
}

function AddressLine({
  label,
  groups,
  pick,
  emphasize,
  highlighted,
  prefix,
}: {
  label: string;
  groups: readonly (readonly Position[])[];
  pick: (p: Position) => string;
  emphasize: boolean;
  highlighted: ReadonlySet<number>;
  prefix: string;
}) {
  return (
    <VStack gap={0}>
      {label && (
        <Text font="label2" color="fgMuted">
          {label}
        </Text>
      )}
      <HStack gap={1} flexWrap="wrap" alignItems="baseline">
        <Text mono font="title3" color="fgMuted">
          {prefix}
        </Text>
        {groups.map((group, g) => (
          <Text key={g} mono font="title3" color={emphasize ? 'fg' : 'fgMuted'}>
            {group.map((p) => (
              <Char
                key={p.index}
                char={pick(p)}
                differs={!p.match}
                emphasize={emphasize}
                highlighted={highlighted.has(p.index)}
              />
            ))}
          </Text>
        ))}
      </HStack>
    </VStack>
  );
}

function Char({
  char,
  differs,
  emphasize,
  highlighted,
}: {
  char: string;
  differs: boolean;
  emphasize: boolean;
  highlighted: boolean;
}) {
  let node = <>{char}</>;
  if (differs && emphasize) {
    node = (
      <Box as="span" display="inline" background="bgNegativeWash" borderRadius={100}>
        <Text as="span" mono font="title3" color="fgNegative" underline>
          {char}
        </Text>
      </Box>
    );
  }
  if (!highlighted) return node;
  return (
    <Box
      as="span"
      display="inline"
      bordered
      borderColor="fgPrimary"
      borderWidth={200}
      borderRadius={100}
    >
      {node}
    </Box>
  );
}

function Legend({ swatch, label }: { swatch: 'solid' | 'hollow'; label: string }) {
  return (
    <HStack gap={0.5} alignItems="center">
      <Box
        width={14}
        height={14}
        borderRadius={100}
        bordered={swatch === 'hollow'}
        background={swatch === 'solid' ? 'bgNegative' : 'bg'}
      />
      <Text font="label2" color="fgMuted">
        {label}
      </Text>
    </HStack>
  );
}

function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/**
 * The recipient address in groups of 4 with the challenge characters outlined
 * and numbered, for WARNs without a lookalike comparison.
 */
export const AddressWithHighlights = memo(function AddressWithHighlights({
  address,
  highlight,
}: {
  address: Address;
  highlight: readonly number[];
}) {
  const hex = address.slice(2);
  const set = new Set(highlight);
  const groups = chunk(
    Array.from(hex, (char, index) => ({ index, char })),
    GROUP,
  );
  return (
    <Box aria-hidden="true" background="bgAlternate" borderRadius={300} padding={2}>
      <HStack gap={1} flexWrap="wrap" alignItems="baseline">
        <Text mono font="title3" color="fgMuted">
          0x
        </Text>
        {groups.map((group, g) => (
          <Text key={g} mono font="title3">
            {group.map(({ index, char }) =>
              set.has(index) ? (
                <Box
                  key={index}
                  as="span"
                  display="inline"
                  bordered
                  borderColor="fgPrimary"
                  borderWidth={200}
                  borderRadius={100}
                  background="bgPrimaryWash"
                >
                  <Text as="span" mono font="title3" fontWeight="headline">
                    {char}
                  </Text>
                </Box>
              ) : (
                <span key={index}>{char}</span>
              ),
            )}
          </Text>
        ))}
      </HStack>
    </Box>
  );
});

export function describePositions(positions: readonly number[]): string {
  const labels = positions.map(displayPosition);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
