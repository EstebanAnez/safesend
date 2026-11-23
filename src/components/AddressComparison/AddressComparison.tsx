'use client';

import { memo } from 'react';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { CharacterComparison } from '@/risk/types';

const GROUP = 4;

interface Props {
  comparison: CharacterComparison;
  candidateLabel: string;
  anchorLabel: string;
}

/**
 * Side-by-side, character-level view of two addresses in groups of 4.
 * Differences are never shown by color alone: each group carries a text
 * marker ("same" / "differs"), and a plain-language summary leads.
 * S1 version; slice S4 makes this the hero.
 */
export const AddressComparison = memo(function AddressComparison({
  comparison,
  candidateLabel,
  anchorLabel,
}: Props) {
  const groups: (typeof comparison.positions)[] = [];
  for (let i = 0; i < comparison.positions.length; i += GROUP) {
    groups.push(comparison.positions.slice(i, i + GROUP));
  }
  const total = comparison.positions.length;
  const middle = total - comparison.prefixMatchLength - comparison.suffixMatchLength;
  const middleDiffering = total - comparison.totalMatching;

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
                    <CharCell key={p.index} char={p.candidate} match={p.match} />
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

function CharCell({ char, match }: { char: string; match: boolean }) {
  if (match) return <>{char}</>;
  return (
    <Box as="span" background="bgNegativeWash" display="inline">
      <Text as="span" mono font="body" color="fgNegative" fontWeight="headline">
        {char}
      </Text>
    </Box>
  );
}
