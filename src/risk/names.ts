import type { Address } from 'viem';
import type { Contact } from '@/domain/types';

/**
 * Names the user gave addresses: contacts, plus labels for known
 * counterparties ("Mateo (son)", "Landlord"). Keyed by the lowercase FULL
 * address, so only an exact match gets a name: a lookalike never inherits one.
 * Display only. A name never grants trust (D24).
 */
export type NameBook = ReadonlyMap<string, string>;

export function buildNameBook(
  contacts: readonly Contact[],
  labels: Readonly<Record<string, string>> = {},
): NameBook {
  const book = new Map<string, string>();
  for (const [address, name] of Object.entries(labels)) book.set(address.toLowerCase(), name);
  // A contact's own name wins over a label for the same address.
  for (const c of contacts) book.set(c.address.toLowerCase(), c.name);
  return book;
}

export function nameFor(address: Address, names: NameBook | undefined): string | null {
  return names?.get(address.toLowerCase()) ?? null;
}

/**
 * How an address is shown when there is no name: first 4, middle 4 and last 4
 * hex characters (`0x7A3f…d05f…e4d2`). Lookalikes are built to match the ends,
 * so the short form most wallets use (`0x7A3f…e4d2`) is identical for a
 * lookalike and its target. The middle group makes that much more expensive.
 */
export function displayAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(20, 24)}…${address.slice(-4)}`;
}
