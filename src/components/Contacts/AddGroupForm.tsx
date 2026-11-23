'use client';

import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { Checkbox, TextInput } from '@coinbase/cds-web/controls';
import { Box, HStack, VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { Contact, ProtectedAddress } from '@/domain/types';
import { anchorLabel } from '@/risk/anchors';
import { checkNewGroup, contactErrorText, groupErrorText } from '@/risk/contacts';
import type { ContactCheck, ContactError, GroupError, NewContactDraft } from '@/risk/contacts';
import type { RiskConfig } from '@/risk/types';
import { FOCUS_ON_SHOW } from '@/components/a11y/focus';
import { AddressComparison } from '@/components/AddressComparison/AddressComparison';

interface Props {
  user: Address;
  contacts: readonly Contact[];
  protectedSet: readonly ProtectedAddress[];
  config: Pick<RiskConfig, 'lookalike'>;
  onSave: (contacts: Omit<Contact, 'id' | 'addedAt'>[]) => void;
  onCancel: () => void;
}

interface MemberRow extends NewContactDraft {
  key: number;
}

const emptyRow = (key: number): MemberRow => ({
  key,
  name: '',
  addressInput: '',
  reentryInput: '',
  confirmed: false,
  addedVia: 'typed',
});

/**
 * Add a group (e.g. a pasanaku savings circle) in one go (docs/DECISIONS.md
 * D18). Every member follows the single-contact rules (D16) and is also
 * checked against the members above it. Grouping grants no extra trust.
 */
export function AddGroupForm({ user, contacts, protectedSet, config, onSave, onCancel }: Props) {
  const headingId = useId();
  const [groupName, setGroupName] = useState('');
  const [rows, setRows] = useState<MemberRow[]>([emptyRow(0), emptyRow(1)]);
  const [nextKey, setNextKey] = useState(2);
  const [submitted, setSubmitted] = useState(false);

  const check = useMemo(
    () => checkNewGroup(groupName, rows, { user, contacts, protectedSet, config }),
    [groupName, rows, user, contacts, protectedSet, config],
  );

  const update = (key: number, patch: Partial<MemberRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const groupNameError = check.groupErrors.find(
    (e) => e.code === 'group-name-required' || e.code === 'group-name-too-long',
  );

  return (
    <VStack
      as="form"
      gap={2}
      noValidate
      aria-labelledby={headingId}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitted(true);
        if (check.contacts) onSave(check.contacts);
      }}
    >
      <Text as="h3" font="title3" id={headingId} {...FOCUS_ON_SHOW}>
        Add a group
      </Text>
      <Text as="p" font="body" color="fgMuted">
        For people you pay in turns, like a pasanaku. Add everyone once, carefully; after that,
        paying a member is the same as paying any contact.
      </Text>
      <TextInput
        label="Group name"
        placeholder="Pasanaku Mayo"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        autoComplete="off"
        variant={submitted && groupNameError ? 'negative' : undefined}
        helperText={submitted && groupNameError ? groupErrorText(groupNameError) : undefined}
      />

      <VStack as="ol" gap={2} aria-label="Group members">
        {rows.map((row, index) => (
          <MemberFields
            key={row.key}
            index={index}
            row={row}
            check={check.members[index]}
            submitted={submitted}
            duplicateOf={
              check.groupErrors.find(
                (e): e is Extract<GroupError, { code: 'duplicate-in-group' }> =>
                  e.code === 'duplicate-in-group' && e.memberIndex === index,
              ) ?? null
            }
            canRemove={rows.length > 1}
            onChange={(patch) => update(row.key, patch)}
            onRemove={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
          />
        ))}
      </VStack>

      <Box>
        <Button
          variant="secondary"
          compact
          startIcon="add"
          onClick={() => {
            setRows((rs) => [...rs, emptyRow(nextKey)]);
            setNextKey((k) => k + 1);
          }}
        >
          Add another member
        </Button>
      </Box>

      {submitted && !check.contacts && (
        <Text as="p" font="label2" color="fgNegative" role="alert">
          Not saved yet. Fix the fields marked above.
        </Text>
      )}
      <VStack gap={1}>
        <Button type="submit" block>
          Save group
        </Button>
        <Button block variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </VStack>
    </VStack>
  );
}

function MemberFields({
  index,
  row,
  check,
  submitted,
  duplicateOf,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: MemberRow;
  check: ContactCheck | undefined;
  submitted: boolean;
  duplicateOf: { otherIndex: number } | null;
  canRemove: boolean;
  onChange: (patch: Partial<MemberRow>) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const name = row.name.trim();
  const errorFor = (...codes: ContactError['code'][]) => {
    const e = check?.errors.find((x) => codes.includes(x.code));
    return submitted && e ? contactErrorText(e, name) : undefined;
  };
  const addressError =
    (submitted && duplicateOf
      ? `Same address as member ${duplicateOf.otherIndex + 1}.`
      : undefined) ??
    errorFor(
      'invalid-address',
      'zero-address',
      'token-contract',
      'own-address',
      'already-a-contact',
    );
  const lookalike = check?.lookalikeOf ?? null;

  return (
    <Box as="li" bordered borderRadius={300} padding={2}>
      <VStack gap={1.5}>
        <HStack justifyContent="space-between" alignItems="center">
          <Text as="h4" font="headline">
            Member {n}
          </Text>
          {canRemove && (
            <Button
              compact
              variant="tertiary"
              onClick={onRemove}
              accessibilityLabel={`Remove member ${n}`}
            >
              Remove
            </Button>
          )}
        </HStack>
        <TextInput
          label={`Member ${n} name`}
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoComplete="off"
          variant={errorFor('name-required', 'name-too-long') ? 'negative' : undefined}
          helperText={errorFor('name-required', 'name-too-long')}
        />
        <TextInput
          label={`Member ${n} full address`}
          placeholder="0x…"
          value={row.addressInput}
          onChange={(e) => onChange({ addressInput: e.target.value })}
          onPaste={() => onChange({ addedVia: 'pasted' })}
          autoComplete="off"
          spellCheck={false}
          variant={addressError ? 'negative' : undefined}
          helperText={addressError}
        />
        {lookalike && (
          <VStack gap={1.5}>
            <Banner
              variant="warning"
              startIcon="warning"
              startIconAccessibilityLabel="Warning"
              styleVariant="contextual"
              title={
                <Text as="p" font="label1">
                  This looks like {anchorLabel(lookalike.anchor)}
                </Text>
              }
            >
              <Text as="p" font="label2">
                Type the full address a second time and confirm you checked it with {name || 'them'}{' '}
                by phone.
              </Text>
            </Banner>
            <AddressComparison
              comparison={lookalike.comparison}
              candidateLabel={`Member ${n}`}
              anchorLabel={anchorLabel(lookalike.anchor)}
            />
            <TextInput
              label={`Member ${n}: type or paste the full address again`}
              value={row.reentryInput}
              onChange={(e) => onChange({ reentryInput: e.target.value })}
              autoComplete="off"
              spellCheck={false}
              variant={errorFor('reentry-required', 'reentry-mismatch') ? 'negative' : undefined}
              helperText={errorFor('reentry-required', 'reentry-mismatch')}
            />
          </VStack>
        )}
        <Checkbox
          checked={row.confirmed}
          onChange={(e) => onChange({ confirmed: e.target.checked })}
        >
          {lookalike
            ? `I verified ${name || `member ${n}`}'s address through another channel, like a phone call.`
            : `I got ${name || `member ${n}`}'s address directly from them (for example, in our group chat).`}
        </Checkbox>
        {errorFor('not-confirmed') && (
          <Text as="p" font="label2" color="fgNegative" role="alert">
            {errorFor('not-confirmed')}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
