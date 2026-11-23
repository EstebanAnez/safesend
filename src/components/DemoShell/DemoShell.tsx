'use client';

import type { ReactNode } from 'react';
import { VStack } from '@coinbase/cds-web/layout';
import { AppHeader } from '@/components/AppHeader/AppHeader';

/** Page chrome shared by the demo routes. */
export function DemoShell({
  children,
  maxWidth = 1120,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <VStack background="bg" minHeight="100vh">
      <AppHeader />
      <VStack as="main" padding={3} maxWidth={maxWidth} width="100%" alignSelf="center">
        {children}
      </VStack>
    </VStack>
  );
}
