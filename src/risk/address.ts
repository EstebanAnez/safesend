import { getAddress, isAddress } from 'viem';
import type { Address } from 'viem';

export type AddressParseError =
  'empty' | 'missing-prefix' | 'wrong-length' | 'not-hex' | 'bad-checksum';

export type AddressParseResult =
  { ok: true; address: Address } | { ok: false; error: AddressParseError };

const HEX_BODY = /^[0-9a-fA-F]+$/;

/**
 * Accepts any valid EVM address form and returns the checksummed address.
 * - All-lowercase or all-uppercase hex: accepted (no checksum encoded).
 * - Mixed case: must be a valid EIP-55 checksum, otherwise rejected. A wrong
 *   checksum is a strong sign of a typo or tampering, so we never "fix" it.
 * Surrounding whitespace is trimmed; nothing else is altered.
 */
export function parseAddress(raw: string): AddressParseResult {
  const input = raw.trim();
  if (input.length === 0) return { ok: false, error: 'empty' };
  if (!input.startsWith('0x')) return { ok: false, error: 'missing-prefix' };

  const body = input.slice(2);
  if (!HEX_BODY.test(body)) return { ok: false, error: 'not-hex' };
  if (body.length !== 40) return { ok: false, error: 'wrong-length' };

  const isMixedCase = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (isMixedCase && !isAddress(input, { strict: true })) {
    return { ok: false, error: 'bad-checksum' };
  }
  return { ok: true, address: getAddress(input.toLowerCase()) };
}

/** Case-insensitive equality on normalized addresses. */
export function sameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
