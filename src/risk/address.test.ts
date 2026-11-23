import { describe, expect, it } from 'vitest';
import { parseAddress, sameAddress } from './address';

// Circle's canonical Base Sepolia USDC, a known-good EIP-55 checksum.
const CHECKSUMMED = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

describe('parseAddress', () => {
  it('accepts a valid checksummed address unchanged', () => {
    expect(parseAddress(CHECKSUMMED)).toEqual({ ok: true, address: CHECKSUMMED });
  });

  it('accepts all-lowercase and normalizes to checksum', () => {
    expect(parseAddress(CHECKSUMMED.toLowerCase())).toEqual({ ok: true, address: CHECKSUMMED });
  });

  it('accepts all-uppercase hex and normalizes to checksum', () => {
    const upper = '0x' + CHECKSUMMED.slice(2).toUpperCase();
    expect(parseAddress(upper)).toEqual({ ok: true, address: CHECKSUMMED });
  });

  it('trims surrounding whitespace from pasted input', () => {
    expect(parseAddress(`  ${CHECKSUMMED}\n`)).toEqual({ ok: true, address: CHECKSUMMED });
  });

  it('rejects a mixed-case address with a wrong checksum', () => {
    // Flip the case of one letter: still mixed case, checksum now invalid.
    const tampered = CHECKSUMMED.replace('CbD', 'Cbd');
    expect(parseAddress(tampered)).toEqual({ ok: false, error: 'bad-checksum' });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['036CbD53842c5426634e7929541eC2318f3dCF7e', 'missing-prefix'],
    ['0x036cbd53842c5426634e7929541ec2318f3dcf7', 'wrong-length'],
    ['0x036cbd53842c5426634e7929541ec2318f3dcf7e00', 'wrong-length'],
    ['0x036cbd53842c5426634e7929541ec2318f3dcfzz', 'not-hex'],
  ] as const)('rejects %j as %s', (input, error) => {
    expect(parseAddress(input)).toEqual({ ok: false, error });
  });
});

describe('sameAddress', () => {
  it('compares case-insensitively', () => {
    expect(sameAddress(CHECKSUMMED, CHECKSUMMED.toLowerCase() as `0x${string}`)).toBe(true);
  });
});
