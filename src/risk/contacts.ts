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

// ---------------------------------------------------------------------------
// Groups (docs/DECISIONS.md D18)
// ---------------------------------------------------------------------------

export type GroupError =
  | { code: 'group-name-required' }
  | { code: 'group-name-too-long'; max: number }
  | { code: 'no-members' }
  | { code: 'duplicate-in-group'; memberIndex: number; otherIndex: number };

export interface GroupCheck {
  groupErrors: GroupError[];
  /** One result per member draft, in order. */
  members: ContactCheck[];
  /** Present only when the whole group is valid. */
  contacts: Omit<Contact, 'id' | 'addedAt'>[] | null;
}

export const MAX_GROUP_NAME = 40;

/**
 * Add several contacts at once (e.g. a pasanaku savings group). Each member
 * follows exactly the single-contact rules (D16). Members are also checked
 * against each other: every earlier member counts as protected for the next,
 * so a lookalike of another member needs re-entry plus out-of-band
 * confirmation, and the same address twice is rejected.
 * Grouping is a convenience for adding contacts; it grants no extra trust.
 */
export function checkNewGroup(
  groupName: string,
  drafts: readonly NewContactDraft[],
  ctx: Parameters<typeof checkNewContact>[1],
): GroupCheck {
  const groupErrors: GroupError[] = [];
  const name = groupName.trim();
  if (name.length === 0) groupErrors.push({ code: 'group-name-required' });
  else if (name.length > MAX_GROUP_NAME)
    groupErrors.push({ code: 'group-name-too-long', max: MAX_GROUP_NAME });
  if (drafts.length === 0) groupErrors.push({ code: 'no-members' });

  const members: ContactCheck[] = [];
  const earlier: Contact[] = [];
  const seen: { index: number; address: Address }[] = [];

  drafts.forEach((draft, index) => {
    const check = checkNewContact(draft, {
      ...ctx,
      // Duplicates within the group are reported separately (duplicate-in-group).
      contacts: ctx.contacts,
      protectedSet: [
        ...ctx.protectedSet,
        ...earlier.map((c): ProtectedAddress => ({
          kind: 'contact',
          address: c.address,
          contact: c,
        })),
      ],
    });
    // Same address entered twice in this group.
    const parsed = parseAddress(draft.addressInput);
    if (parsed.ok) {
      const dup = seen.find((s) => sameAddress(s.address, parsed.address));
      if (dup)
        groupErrors.push({ code: 'duplicate-in-group', memberIndex: index, otherIndex: dup.index });
      else seen.push({ index, address: parsed.address });
    }
    members.push(check);
    // Every earlier member with a valid address protects the later ones, whether
    // or not that member is confirmed yet: a lookalike typed before the box is
    // ticked must still be caught.
    if (parsed.ok) {
      earlier.push({
        id: `pending-${index}`,
        name: draft.name.trim() || `member ${index + 1}`,
        address: parsed.address,
        addedAt: 0,
        addedVia: draft.addedVia,
        verifiedOutOfBand: false,
      });
    }
  });

  const valid = groupErrors.length === 0 && members.every((m) => m.contact !== null);
  return {
    groupErrors,
    members,
    contacts: valid
      ? members.flatMap((m) => (m.contact ? [{ ...m.contact, group: name }] : []))
      : null,
  };
}

export function groupErrorText(e: GroupError): string {
  switch (e.code) {
    case 'group-name-required':
      return 'Give the group a name, for example "Pasanaku Mayo".';
    case 'group-name-too-long':
      return `Use a shorter group name (at most ${e.max} characters).`;
    case 'no-members':
      return 'Add at least one member.';
    case 'duplicate-in-group':
      return `Member ${e.memberIndex + 1} has the same address as member ${e.otherIndex + 1}.`;
  }
}
