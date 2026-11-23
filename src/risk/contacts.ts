import { zeroAddress } from 'viem';
import type { Address } from 'viem';
import { CANONICAL_USDC } from '@/config/chain';
import type { Contact, ProtectedAddress } from '@/domain/types';
import { parseAddress, sameAddress } from './address';
import type { AddressParseError } from './address';
import { compareAddresses, isLookalike } from './compare';
import type { CharacterComparison, RiskConfig } from './types';

/**
 * Rules for adding a trusted contact (docs/DECISIONS.md D16). Contacts are the
 * strongest trust anchor, so adding one is always deliberate:
 * - the full address is typed or pasted (never prefilled from history),
 * - the user confirms they got it directly from the person,
 * - if it looks like someone already protected, the user must type the full
 *   address a second time and confirm they verified it through another channel.
 * Adding a contact never resumes or approves a send in progress.
 */

export interface NewContactDraft {
  name: string;
  addressInput: string;
  /** Second, independent entry of the full address. Required for lookalikes. */
  reentryInput: string;
  /** "I got this address directly from <name>" / "I verified it by phone". */
  confirmed: boolean;
  addedVia: 'typed' | 'pasted';
}

export type ContactError =
  | { code: 'name-required' }
  | { code: 'name-too-long'; max: number }
  | { code: 'invalid-address'; detail: AddressParseError }
  | { code: 'zero-address' }
  | { code: 'token-contract' }
  | { code: 'own-address' }
  | { code: 'already-a-contact'; existing: Contact }
  | { code: 'not-confirmed' }
  | { code: 'reentry-required' }
  | { code: 'reentry-mismatch' };

export interface ContactCheck {
  /** Set when the address resembles a protected address (stricter rules apply). */
  lookalikeOf: { anchor: ProtectedAddress; comparison: CharacterComparison } | null;
  errors: ContactError[];
  /** Present only when there are no errors. */
  contact: Omit<Contact, 'id' | 'addedAt'> | null;
}

export const MAX_CONTACT_NAME = 40;

export function checkNewContact(
  draft: NewContactDraft,
  ctx: {
    user: Address;
    contacts: readonly Contact[];
    protectedSet: readonly ProtectedAddress[];
    config: Pick<RiskConfig, 'lookalike'>;
  },
): ContactCheck {
  const errors: ContactError[] = [];
  const name = draft.name.trim();
  if (name.length === 0) errors.push({ code: 'name-required' });
  else if (name.length > MAX_CONTACT_NAME)
    errors.push({ code: 'name-too-long', max: MAX_CONTACT_NAME });

  const parsed = parseAddress(draft.addressInput);
  if (!parsed.ok) {
    errors.push({ code: 'invalid-address', detail: parsed.error });
    return { lookalikeOf: null, errors, contact: null };
  }
  const address = parsed.address;
  if (sameAddress(address, zeroAddress)) errors.push({ code: 'zero-address' });
  if (sameAddress(address, CANONICAL_USDC.address)) errors.push({ code: 'token-contract' });
  if (sameAddress(address, ctx.user)) errors.push({ code: 'own-address' });
  const existing = ctx.contacts.find((c) => sameAddress(c.address, address));
  if (existing) errors.push({ code: 'already-a-contact', existing });

  let lookalikeOf: ContactCheck['lookalikeOf'] = null;
  for (const anchor of ctx.protectedSet) {
    const comparison = compareAddresses(address, anchor.address);
    if (isLookalike(comparison, ctx.config.lookalike)) {
      lookalikeOf = { anchor, comparison };
      break;
    }
  }

  if (!draft.confirmed) errors.push({ code: 'not-confirmed' });
  if (lookalikeOf) {
    const reentry = parseAddress(draft.reentryInput);
    if (draft.reentryInput.trim().length === 0) errors.push({ code: 'reentry-required' });
    else if (!reentry.ok || !sameAddress(reentry.address, address)) {
      errors.push({ code: 'reentry-mismatch' });
    }
  }

  return {
    lookalikeOf,
    errors,
    contact:
      errors.length === 0
        ? { name, address, addedVia: draft.addedVia, verifiedOutOfBand: lookalikeOf !== null }
        : null,
  };
}

export function contactErrorText(e: ContactError, name: string): string {
  switch (e.code) {
    case 'name-required':
      return 'Enter a name for this contact.';
    case 'name-too-long':
      return `Use a shorter name (at most ${e.max} characters).`;
    case 'invalid-address':
      return 'This is not a valid address. Copy the full address again.';
    case 'zero-address':
      return 'This address burns funds; it cannot be a contact.';
    case 'token-contract':
      return 'This is the USDC contract, not a person.';
    case 'own-address':
      return 'This is your own address.';
    case 'already-a-contact':
      return `This address is already saved as ${e.existing.name}.`;
    case 'not-confirmed':
      return `Confirm you got this address directly from ${name || 'the person'}.`;
    case 'reentry-required':
      return 'Type or paste the full address a second time.';
    case 'reentry-mismatch':
      return 'The two addresses do not match. Check every character.';
  }
}
