import { zeroAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { CANONICAL_USDC } from '@/config/chain';
import type { ProtectedAddress } from '@/domain/types';
import { a, contact, lookalikeOf, SISTER, USER } from '@/test/builders';
import { DEFAULT_RISK_CONFIG } from './config';
import { checkNewContact, checkNewGroup } from './contacts';
import type { NewContactDraft } from './contacts';

const sister = contact('Lucía', SISTER);
const protectedSet: ProtectedAddress[] = [{ kind: 'contact', address: SISTER, contact: sister }];
const ctx = { user: USER, contacts: [sister], protectedSet, config: DEFAULT_RISK_CONFIG };
const ROSA = a('9e4b27c1d5a83f60b2e7c94d1a58f3e06b7d2c45');

const draft = (over: Partial<NewContactDraft> = {}): NewContactDraft => ({
  name: 'Rosa',
  addressInput: ROSA,
  reentryInput: '',
  confirmed: true,
  addedVia: 'pasted',
  ...over,
});
const codes = (d: NewContactDraft) => checkNewContact(d, ctx).errors.map((e) => e.code);

describe('checkNewContact', () => {
  it('accepts a confirmed, valid, new address', () => {
    const r = checkNewContact(draft(), ctx);
    expect(r.errors).toEqual([]);
    expect(r.contact).toMatchObject({ name: 'Rosa', address: ROSA, verifiedOutOfBand: false });
    expect(r.lookalikeOf).toBeNull();
  });

  it('always requires an explicit confirmation', () => {
    expect(codes(draft({ confirmed: false }))).toEqual(['not-confirmed']);
  });

  it.each([
    ['empty name', { name: '  ' }, 'name-required'],
    ['long name', { name: 'x'.repeat(41) }, 'name-too-long'],
    ['invalid address', { addressInput: '0x1234' }, 'invalid-address'],
    ['zero address', { addressInput: zeroAddress }, 'zero-address'],
    ['token contract', { addressInput: CANONICAL_USDC.address }, 'token-contract'],
    ['own address', { addressInput: USER }, 'own-address'],
    ['existing contact', { addressInput: SISTER.toLowerCase() }, 'already-a-contact'],
  ] as const)('rejects %s', (_l, over, code) => {
    expect(codes(draft(over))).toContain(code);
  });

  describe('an address that looks like a protected one', () => {
    const look = lookalikeOf(SISTER, 4, 4);

    it('is flagged and requires the full address typed a second time', () => {
      const r = checkNewContact(draft({ addressInput: look }), ctx);
      expect(r.lookalikeOf?.anchor.address).toBe(SISTER);
      expect(r.errors.map((e) => e.code)).toEqual(['reentry-required']);
      expect(r.contact).toBeNull();
    });

    it('rejects a re-entry that differs anywhere', () => {
      const other = lookalikeOf(SISTER, 4, 4).replace(/.$/, (c) => (c === '0' ? '1' : '0'));
      expect(codes(draft({ addressInput: look, reentryInput: other }))).toEqual([
        'reentry-mismatch',
      ]);
    });

    it('accepts a matching re-entry plus confirmation, and records out-of-band verification', () => {
      const r = checkNewContact(
        draft({ addressInput: look, reentryInput: look.toLowerCase(), confirmed: true }),
        ctx,
      );
      expect(r.errors).toEqual([]);
      expect(r.contact?.verifiedOutOfBand).toBe(true);
    });
  });
});

describe('checkNewGroup (D18)', () => {
  const CARMEN = a('3f1c8e5a07b9d24e6c1a8f3b5d7e9c0a2b4d6f81');
  const member = (name: string, addressInput: string, over: Partial<NewContactDraft> = {}) =>
    draft({ name, addressInput, ...over });

  it('accepts a group of confirmed members and tags each with the group name', () => {
    const r = checkNewGroup('Pasanaku Mayo', [member('Rosa', ROSA), member('Carmen', CARMEN)], ctx);
    expect(r.groupErrors).toEqual([]);
    expect(r.contacts?.map((c) => [c.name, c.group])).toEqual([
      ['Rosa', 'Pasanaku Mayo'],
      ['Carmen', 'Pasanaku Mayo'],
    ]);
  });

  it('applies the single-contact rules to every member (confirmation required)', () => {
    const r = checkNewGroup(
      'Pasanaku',
      [member('Rosa', ROSA), member('Carmen', CARMEN, { confirmed: false })],
      ctx,
    );
    expect(r.contacts).toBeNull();
    expect(r.members[1]?.errors.map((e) => e.code)).toEqual(['not-confirmed']);
  });

  it('requires re-entry for a member who looks like an existing protected address', () => {
    const r = checkNewGroup('Pasanaku', [member('X', lookalikeOf(SISTER, 4, 4))], ctx);
    expect(r.members[0]?.errors.map((e) => e.code)).toEqual(['reentry-required']);
  });

  it('checks members against each other: a lookalike of an earlier member needs re-entry', () => {
    const fake = lookalikeOf(ROSA, 4, 4);
    const r = checkNewGroup('Pasanaku', [member('Rosa', ROSA), member('Rosa 2', fake)], ctx);
    expect(r.members[1]?.lookalikeOf?.anchor.address).toBe(ROSA);
    expect(r.members[1]?.errors.map((e) => e.code)).toEqual(['reentry-required']);
    expect(r.contacts).toBeNull();
  });

  it('rejects the same address twice in one group', () => {
    const r = checkNewGroup(
      'Pasanaku',
      [member('Rosa', ROSA), member('Also Rosa', ROSA.toLowerCase())],
      ctx,
    );
    expect(r.groupErrors).toContainEqual({
      code: 'duplicate-in-group',
      memberIndex: 1,
      otherIndex: 0,
    });
  });

  it.each([
    ['', 'group-name-required'],
    ['x'.repeat(41), 'group-name-too-long'],
  ] as const)('rejects group name %j', (groupName, code) => {
    expect(
      checkNewGroup(groupName, [member('Rosa', ROSA)], ctx).groupErrors.map((e) => e.code),
    ).toContain(code);
  });

  it('rejects an empty group', () => {
    expect(checkNewGroup('Pasanaku', [], ctx).groupErrors.map((e) => e.code)).toContain(
      'no-members',
    );
  });
});

describe('checkNewGroup: members protect each other even before confirmation', () => {
  it('flags a lookalike of an earlier member that is not confirmed yet', () => {
    const fake = lookalikeOf(ROSA, 4, 4);
    const r = checkNewGroup(
      'Pasanaku',
      [
        draft({ name: 'Rosa', addressInput: ROSA, confirmed: false }),
        draft({ name: 'Rosa 2', addressInput: fake }),
      ],
      ctx,
    );
    expect(r.members[1]?.lookalikeOf?.anchor.address).toBe(ROSA);
  });

  it('reports an exact duplicate once, as a group error', () => {
    const r = checkNewGroup(
      'Pasanaku',
      [draft({ name: 'Rosa', addressInput: ROSA }), draft({ name: 'Rosa', addressInput: ROSA })],
      ctx,
    );
    expect(r.members[1]?.errors).toEqual([]);
    expect(r.groupErrors.map((e) => e.code)).toEqual(['duplicate-in-group']);
  });
});
