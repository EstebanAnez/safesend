'use client';

import NextLink from 'next/link';
import { HStack, VStack } from '@coinbase/cds-web/layout';
import { Link, Text } from '@coinbase/cds-web/typography';
import { AppHeader } from '@/components/AppHeader/AppHeader';
import { DemoVideo } from '@/components/DemoVideo/DemoVideo';

const PAPER = 'https://arxiv.org/abs/2501.16681';
const REPO = 'https://github.com/EstebanAnez/safesend';
const LINKEDIN = 'https://www.linkedin.com/in/esteban-anez';

export default function HomePage() {
  return (
    <VStack background="bg" minHeight="100vh">
      <AppHeader />
      <VStack as="main" gap={3} padding={3} maxWidth={720} width="100%" alignSelf="center">
        <VStack gap={2}>
          <Text as="h1" font="title1">
            Check the recipient before you send
          </Text>
          <Text as="p" font="body" color="fgMuted">
            SafeSend helps people detect lookalike recipients before they send USDC, by tracking
            where every address in their history came from and making a clear decision at send time.
          </Text>
          <Text as="p" font="body">
            Address poisoning: about 270 million attempts against 17 million victims, with at least
            $83.8 million lost (
            <Link href={PAPER} openInNewWindow>
              Tsuchiya et al., Carnegie Mellon, arXiv 2501.16681
            </Link>
            ).
          </Text>
          <NextLink href="/demo">
            <Text as="span" font="headline" color="fgPrimary" underline>
              Try the demo scenarios
            </Text>
          </NextLink>
        </VStack>

        <DemoVideo />

        <VStack gap={1}>
          <Text as="p" font="label2" color="fgMuted">
            Prototype on Base Sepolia testnet. No real money; every send in the demo is simulated.
          </Text>
          <HStack gap={2} flexWrap="wrap">
            <Text as="p" font="label2">
              Built by{' '}
              <Link href={LINKEDIN} openInNewWindow>
                Esteban Anez
              </Link>
            </Text>
            <Text as="p" font="label2">
              <Link href={REPO} openInNewWindow>
                View the code on GitHub
              </Link>
            </Text>
          </HStack>
        </VStack>
      </VStack>
    </VStack>
  );
}
