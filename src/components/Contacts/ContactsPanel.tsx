'use client';

import { memo } from 'react';
import { Button } from '@coinbase/cds-web/buttons';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Tag } from '@coinbase/cds-web/tag';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { Contact } from '@/domain/types';
import { shortAddress } from '@/lib/format';

interface Props {
  contacts: readonly Contact[];
  onSendTo: (address: Address) => void;
  onAdd: () => void;
}

/** Trusted contacts: the safest place to pick a recipient from. */
export const ContactsPanel = memo(function ContactsPanel({ contacts, onSendTo, onAdd }: Props) {
  return (
    <VStack gap={1.5}>
      {contacts.length === 0 ? (
        <Text as="p" font="body" color="fgMuted">
          No contacts yet.
        </Text>
      ) : (
        <VStack as="ul" gap={1} aria-label="Trusted contacts">
          {contacts.map((c) => (
            <Box as="li" key={c.id} bordered borderRadius={300} padding={1.5}>
              <HStack justifyContent="space-between" alignItems="center" gap={1}>
                <VStack gap={0.25}>
                  <HStack gap={1} alignItems="center" flexWrap="wrap">
                    <Text as="p" font="headline">
                      {c.name}
                    </Text>
                    {c.verifiedOutOfBand && <Tag colorScheme="green">Verified by phone</Tag>}
                  </HStack>
                  <Text as="p" mono font="label2" color="fgMuted">
                    {shortAddress(c.address)}
                  </Text>
                </VStack>
                <Button
                  compact
                  variant="secondary"
                  onClick={() => onSendTo(c.address)}
                  accessibilityLabel={`Send to ${c.name}`}
                >
                  Send
                </Button>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
      <Box>
        <Button compact variant="secondary" startIcon="add" onClick={onAdd}>
          Add contact
        </Button>
      </Box>
    </VStack>
  );
});
