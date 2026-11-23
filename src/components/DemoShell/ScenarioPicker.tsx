'use client';

import Link from 'next/link';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import { SCENARIO_LIST } from '@/fixtures/scenarios';

/** Lists every demo scenario. Plain links: keyboard and screen-reader friendly by default. */
export function ScenarioPicker() {
  return (
    <VStack gap={3}>
      <VStack gap={1}>
        <Text as="h1" font="title1">
          Try SafeSend
        </Text>
        <Text as="p" font="body" color="fgMuted">
          Each scenario puts you in Daniela&apos;s place: she lives in Santa Cruz, receives USDC
          from her son in Kansas and sends some to her sister. Everything here is a simulation on
          synthetic data; nothing is signed or sent.
        </Text>
      </VStack>
      <VStack as="ul" gap={1.5} aria-label="Demo scenarios">
        {SCENARIO_LIST.map((s) => (
          <Box as="li" key={s.id} bordered borderRadius={400} padding={2}>
            <VStack gap={0.75}>
              <HStack gap={1} alignItems="center" flexWrap="wrap">
                <Link href={`/demo/${s.id}`}>
                  <Text as="span" font="headline" color="fgPrimary" underline>
                    {s.title}
                  </Text>
                </Link>
                <Tag colorScheme={s.kind === 'attack' ? 'red' : 'green'}>
                  {s.kind === 'attack' ? 'Attack' : 'Everyday'}
                </Tag>
              </HStack>
              <Text as="p" font="body" color="fgMuted">
                {s.tagline}
              </Text>
            </VStack>
          </Box>
        ))}
      </VStack>
    </VStack>
  );
}
