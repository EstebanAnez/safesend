'use client';

import { memo } from 'react';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import { displayPosition } from '@/risk/confirmation';
import type { CharacterComparison } from '@/risk/types';

const GROUP = 4;

interface Props {
  comparison: CharacterComparison;
  candidateLabel: string;
  anchorLabel: string;
  /** Hex indexes the user is asked to confirm; outlined in the candidate row. */
  highlight?: readonly number[] | null;
}

/**
 * Side-by-side, character-level view of two addresses in groups of 4.
 * Differences are never shown by color alone: each group carries a text
 * marker ("same" / "differs"), and a plain-language summary leads.
 * S2 version; slice S4 makes this the hero.
 */
export const AddressComparison = memo(function AddressComparison({
  comparison,
  candidateLabel,
  anchorLabel,
  highlight,
}: Props) {
  const groups: (typeof comparison.positions)[] = [];
  for (let i = 0; i < comparison.positions.length; i += GROUP) {
    groups.push(comparison.positions.slice(i, i + GROUP));
  }
  const total = comparison.positions.length;
  const middle = total - comparison.prefixMatchLength - comparison.suffixMatchLength;
  const middleDiffering = total - comparison.totalMatching;
  const highlighted = new Set(highlight ?? []);

  return (
    <VStack gap={1.5}>
      <Text as="p" font="body">
        First {comparison.prefixMatchLength} and last {comparison.suffixMatchLength} characters
        match. {middleDiffering} of the {middle} characters in the middle are different.
      </Text>
      <Box aria-hidden="true" background="bgAlternate" borderRadius={300} padding={2}>
        <HStack gap={1} flexWrap="wrap">
          <VStack gap={0.5} justifyContent="flex-start">
            <Text font="label2" color="fgMuted">
              {candidateLabel}
            </Text>
            <Text font="label2" color="fgMuted">
              {anchorLabel}
            </Text>
          </VStack>
          {groups.map((group, g) => {
            const same = group.every((p) => p.match);
            return (
              <VStack key={g} gap={0.5} alignItems="center">
                <Text mono font="body">
                  {group.map((p) => (
                    <CharCell
                      key={p.index}
                      char={p.candidate}
                      match={p.match}
                      highlighted={highlighted.has(p.index)}
                    />
                  ))}
                </Text>
                <Text mono font="body" color="fgMuted">
                  {group.map((p) => p.anchor).join('')}
                </Text>
                <Text font="label2" color={same ? 'fg' : 'fgNegative'}>
                  {same ? '✓ same' : '✗ differs'}
                </Text>
              </VStack>
            );
          })}
        </HStack>
      </Box>
      <VStack gap={0.5}>
        <Text as="p" font="label2" color="fgMuted">
          {candidateLabel}:{' '}
          <Text as="span" mono font="label2" color="fg">
            {comparison.candidate}
          </Text>
        </Text>
        <Text as="p" font="label2" color="fgMuted">
          {anchorLabel}:{' '}
          <Text as="span" mono font="label2" color="fg">
            {comparison.anchor}
          </Text>
        </Text>
      </VStack>
    </VStack>
  );
});

function CharCell({
  char,
  match,
  highlighted,
}: {
  char: string;
  match: boolean;
  highlighted: boolean;
}) {
  const content = match ? (
    <>{char}</>
  ) : (
    <Box as="span" background="bgNegativeWash" display="inline">
      <Text as="span" mono font="body" color="fgNegative" fontWeight="headline">
        {char}
      </Text>
    </Box>
  );
  if (!highlighted) return content;
  return (
    <Box as="span" display="inline" bordered borderRadius={100}>
      {content}
    </Box>
  );
}

/**
 * The recipient address in groups of 4 with the challenge characters outlined,
 * for WARNs without a lookalike comparison. Positions are also listed in text.
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
  const groups: { index: number; char: string }[][] = [];
  for (let i = 0; i < hex.length; i += GROUP) {
    groups.push(Array.from(hex.slice(i, i + GROUP), (char, k) => ({ index: i + k, char })));
  }
  return (
    <Box aria-hidden="true" background="bgAlternate" borderRadius={300} padding={2}>
      <HStack gap={1} flexWrap="wrap" alignItems="center">
        <Text mono font="body" color="fgMuted">
          0x
        </Text>
        {groups.map((group, g) => (
          <Text key={g} mono font="body">
            {group.map(({ index, char }) =>
              set.has(index) ? (
                <Box key={index} as="span" display="inline" bordered borderRadius={100}>
                  <Text as="span" mono font="body" fontWeight="headline">
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
