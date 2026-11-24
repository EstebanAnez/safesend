'use client';

import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Banner } from '@coinbase/cds-web/banner';
import { Button } from '@coinbase/cds-web/buttons';
import { Checkbox, TextInput } from '@coinbase/cds-web/controls';
import { VStack } from '@coinbase/cds-web/layout';
import { Text } from '@coinbase/cds-web/typography';
import type { Address } from 'viem';
import type { Contact, ProtectedAddress } from '@/domain/types';
import { anchorLabel } from '@/risk/anchors';
import { checkNewContact, contactErrorText } from '@/risk/contacts';
import type { ContactError } from '@/risk/contacts';
import type { NameBook } from '@/risk/names';
import type { RiskConfig } from '@/risk/types';
import { FOCUS_ON_SHOW } from '@/components/a11y/focus';
import { AddressComparison } from '@/components/AddressComparison/AddressComparison';

interface Props {
  user: Address;
  contacts: readonly Contact[];
  protectedSet: readonly ProtectedAddress[];
  config: Pick<RiskConfig, 'lookalike'>;
  /** Names for known addresses, for the "This looks like …" copy. */
  names?: NameBook;
  /** 'after-block': reached from a BLOCK screen; copy is stricter and nothing is prefilled. */
  mode: 'normal' | 'after-block';
  onSave: (contact: Omit<Contact, 'id' | 'addedAt'>) => void;
  onCancel: () => void;
}

/**
 * Deliberately add a trusted contact (docs/DECISIONS.md D16). The address is
 * never prefilled. Saving does not resume or approve any send in progress.
 */
export function AddContactForm({
  user,
  contacts,
  protectedSet,
  config,
  names,
  mode,
  onSave,
  onCancel,
}: Props) {
  const headingId = useId();
  const [name, setName] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [reentryInput, setReentryInput] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const check = useMemo(
    () =>
      checkNewContact(
        { name, addressInput, reentryInput, confirmed, addedVia: pasted ? 'pasted' : 'typed' },
        { user, contacts, protectedSet, config },
      ),
    [name, addressInput, reentryInput, confirmed, pasted, user, contacts, protectedSet, config],
  );
  const lookalike = check.lookalikeOf;
  const show = (code: ContactError['code']) =>
    submitted && check.errors.some((e) => e.code === code);
  const errorFor = (...codes: ContactError['code'][]) => {
    const e = check.errors.find((x) => codes.includes(x.code));
    return submitted && e ? contactErrorText(e, name.trim()) : undefined;
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (check.contact) onSave(check.contact);
  };

  const addressError = errorFor(
    'invalid-address',
    'zero-address',
    'token-contract',
    'own-address',
    'already-a-contact',
  );
  const reentryError = errorFor('reentry-required', 'reentry-mismatch');

  return (
    <VStack as="form" gap={2} onSubmit={handleSubmit} aria-labelledby={headingId} noValidate>
      <Text as="h3" font="title3" id={headingId} {...FOCUS_ON_SHOW}>
        {mode === 'after-block' ? 'Add a different person as a contact' : 'Add a contact'}
      </Text>
      {mode === 'after-block' && (
        <Text as="p" font="body" color="fgMuted">
          Only do this if you are sure this is a different person. Ask them for their full address
          through another channel, like a phone call, and type or paste it below. The send you just
          tried stays cancelled.
        </Text>
      )}
      <TextInput
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        variant={errorFor('name-required', 'name-too-long') ? 'negative' : undefined}
        helperText={errorFor('name-required', 'name-too-long')}
      />
      <TextInput
        label="Full address"
        placeholder="0x…"
        value={addressInput}
        onChange={(e) => setAddressInput(e.target.value)}
        onPaste={() => setPasted(true)}
        autoComplete="off"
        spellCheck={false}
        variant={addressError ? 'negative' : undefined}
        helperText={addressError ?? 'Get it directly from the person, never from your history.'}
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
                This looks like {anchorLabel(lookalike.anchor, names)}
              </Text>
            }
          >
            <Text as="p" font="label2">
              Scammers create addresses that start and end like someone you know. Saving it needs
              the full address a second time and your confirmation that you checked it with the
              person.
            </Text>
          </Banner>
          <AddressComparison
            comparison={lookalike.comparison}
            candidateLabel="New address"
            anchorLabel={anchorLabel(lookalike.anchor, names)}
          />
          <TextInput
            label="Type or paste the full address again"
            value={reentryInput}
            onChange={(e) => setReentryInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            variant={reentryError ? 'negative' : undefined}
            helperText={reentryError}
          />
        </VStack>
      )}

      <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
        {lookalike || mode === 'after-block'
          ? `I verified this address with ${name.trim() || 'the person'} through another channel, like a phone call.`
          : `I got this address directly from ${name.trim() || 'the person'}.`}
      </Checkbox>
      {show('not-confirmed') && (
        <Text as="p" font="label2" color="fgNegative" role="alert">
          {errorFor('not-confirmed')}
        </Text>
      )}

      <VStack gap={1}>
        <Button type="submit" block>
          Save contact
        </Button>
        <Button block variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </VStack>
    </VStack>
  );
}
