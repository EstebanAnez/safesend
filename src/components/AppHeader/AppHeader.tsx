'use client';

import { IconButton } from '@coinbase/cds-web/buttons';
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
      <IconButton
        name={colorScheme === 'dark' ? 'moon' : 'light'}
        onClick={toggleColorScheme}
        accessibilityLabel={`Switch to ${nextScheme} mode`}
        transparent
      />
    </HStack>
  );
}
