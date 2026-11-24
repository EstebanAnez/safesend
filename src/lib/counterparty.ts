import type { Address } from 'viem';
import { displayAddress, nameFor } from '@/risk/names';
import type { NameBook } from '@/risk/names';

/**
 * How a history row names its counterparty (D24): the user's name for that
 * exact address, otherwise first, middle and last characters. Never the short
 * `0x7A3f…e4d2` form, which a lookalike shares with its target.
 */
export type CounterpartyLabel = { kind: 'name'; text: string } | { kind: 'address'; text: string };

export function counterpartyLabel(
  address: Address,
  names: NameBook | undefined,
): CounterpartyLabel {
  const name = nameFor(address, names);
  return name ? { kind: 'name', text: name } : { kind: 'address', text: displayAddress(address) };
}
