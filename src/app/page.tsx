'use client';

import Link from 'next/link';
import { VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import { AppHeader } from '@/components/AppHeader/AppHeader';

export default function HomePage() {
  return (
    <VStack background="bg" minHeight="100vh">
      <AppHeader />
      <VStack as="main" gap={2} padding={3} maxWidth={640} width="100%" alignSelf="center">
        <Text as="h1" font="title1">
          Check the recipient before you send
        </Text>
        <Text as="p" font="body" color="fgMuted">
          SafeSend helps people detect lookalike recipients before they send USDC, by tracking where
          every address in their history came from and making a clear decision at send time.
        </Text>
        <Link href="/demo">
          <Text as="span" font="headline" color="fgPrimary" underline>
            Try the demo scenarios
          </Text>
        </Link>
        <Text as="p" font="label2" color="fgMuted">
          Prototype on Base Sepolia testnet. No real money.
        </Text>
      </VStack>
    </VStack>
  );
}
