'use client';

import { Button } from '@coinbase/cds-web/buttons';
import { HStack } from '@coinbase/cds-web/layout';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import { useColorScheme } from '@/app/providers';

export function AppHeader() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const nextScheme = colorScheme === 'light' ? 'dark' : 'light';

  return (
    <HStack
      as="header"
      alignItems="center"
      justifyContent="space-between"
      paddingX={3}
      paddingY={2}
      borderedBottom
    >
      <HStack alignItems="center" gap={1.5}>
        <Text as="p" font="title3">
          SafeSend
        </Text>
        <Tag colorScheme="yellow">Testnet</Tag>
      </HStack>
      {/* Text, not an icon: no icon renders on first paint, so the 275 KB icon font stays off
          the critical path (docs/DECISIONS.md D20). The visible text is inside the name (WCAG 2.5.3). */}
      <Button
        compact
        variant="secondary"
        transparent
        onClick={toggleColorScheme}
        accessibilityLabel={`Switch to ${nextScheme} mode`}
      >
        {nextScheme === 'dark' ? 'Dark mode' : 'Light mode'}
      </Button>
    </HStack>
  );
}
