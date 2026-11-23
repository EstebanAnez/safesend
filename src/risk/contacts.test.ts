import { zeroAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { CANONICAL_USDC } from '@/config/chain';
import type { ProtectedAddress } from '@/domain/types';
import { a, contact, lookalikeOf, SISTER, USER } from '@/test/builders';
import { DEFAULT_RISK_CONFIG } from './config';
import { checkNewContact } from './contacts';
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
