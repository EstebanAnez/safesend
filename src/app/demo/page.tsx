'use client';

import { VStack } from '@coinbase/cds-web/layout';
import { AppHeader } from '@/components/AppHeader/AppHeader';
import { DemoJourney } from '@/components/DemoJourney/DemoJourney';
import { DUST_POISONING_BASIC } from '@/fixtures/scenarios';

export default function DemoPage() {
  return (
    <VStack background="bg" minHeight="100vh">
      <AppHeader />
      <VStack as="main" padding={3} maxWidth={720} width="100%" alignSelf="center">
        <DemoJourney scenarioId={DUST_POISONING_BASIC.id} />
      </VStack>
    </VStack>
  );
}
