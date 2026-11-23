import type { Address, Hash } from 'viem';
import type { Contact, HistoryEntry, TrustAnchor } from '@/domain/types';
import { sameAddress } from './address';

/**
 * A history entry proves the user sent USDC to its counterparty only if:
 * - it is canonical USDC, outgoing, with a non-zero amount, and
 * - the transaction signer is known and is the user (directly or as the
 *   ERC-4337 user-operation sender; see docs/DECISIONS.md D5), and
 * - its provenance is verified.
 * A Transfer event naming the user as sender is not enough on its own:
 * zero-value poisoning emits exactly that.
 */
export function isConfirmedUserSend(entry: HistoryEntry, user: Address): boolean {
  return (
    entry.isCanonicalUsdc &&
    entry.direction === 'out' &&
    entry.amount > 0n &&
    entry.provenance === 'verified' &&
    entry.txSigner.status === 'known' &&
    sameAddress(entry.txSigner.address, user) &&
    sameAddress(entry.from, user)
  );
}

/**
 * The only things lookalikes are compared against: deliberately added
 * contacts and confirmed past recipients. Inbound transfers and anything
 * with unknown provenance never become anchors.
 */
export function buildTrustAnchors(
  contacts: readonly Contact[],
  history: readonly HistoryEntry[],
  user: Address,
): TrustAnchor[] {
  const anchors: TrustAnchor[] = contacts.map((contact) => ({
    kind: 'contact',
    address: contact.address,
    contact,
  }));

  const confirmed = new Map<string, { address: Address; hashes: Hash[]; last: number | null }>();
  for (const entry of history) {
    if (!isConfirmedUserSend(entry, user)) continue;
    const key = entry.counterparty.toLowerCase();
    const existing = confirmed.get(key);
    if (existing) {
      existing.hashes.push(entry.txHash);
      if (entry.blockTime !== null && (existing.last === null || entry.blockTime > existing.last)) {
        existing.last = entry.blockTime;
      }
    } else {
      confirmed.set(key, {
        address: entry.counterparty,
        hashes: [entry.txHash],
        last: entry.blockTime,
      });
    }
  }

  for (const { address, hashes, last } of confirmed.values()) {
    // A contact already covers this address; keep the contact (it has a name).
    if (anchors.some((a) => sameAddress(a.address, address))) continue;
    anchors.push({
      kind: 'confirmed-recipient',
      address,
      evidenceTxHashes: hashes,
      lastSentAt: last,
    });
  }
  return anchors;
}

export function anchorLabel(anchor: TrustAnchor): string {
  return anchor.kind === 'contact' ? anchor.contact.name : 'an address you sent USDC to before';
}
