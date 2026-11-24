import type { Address, Hash } from 'viem';
import type { Contact, HistoryEntry, ProtectedAddress, TrustAnchor } from '@/domain/types';
import { sameAddress } from './address';
import { firstAppearedViaPlanting } from './planting';
import type { RiskConfig } from './types';
import { displayAddress, nameFor } from './names';
import type { NameBook } from './names';

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
 *
 * A confirmed send does NOT make an address an anchor if that address first
 * entered history through a planting technique: that is what a victim who
 * already fell for a lookalike once looks like, and trusting it would ALLOW
 * the next send to the attacker.
 */
export function buildTrustAnchors(
  contacts: readonly Contact[],
  history: readonly HistoryEntry[],
  user: Address,
  config: Pick<RiskConfig, 'dustThreshold'>,
): TrustAnchor[] {
  const anchors: TrustAnchor[] = contacts.map((contact) => ({
    kind: 'contact',
    address: contact.address,
    contact,
  }));

  const confirmed = new Map<string, { address: Address; hashes: Hash[]; last: number | null }>();
  for (const entry of history) {
    if (!isConfirmedUserSend(entry, user)) continue;
    if (firstAppearedViaPlanting(entry.counterparty, history, user, config)) continue;
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

/**
 * A verified inbound transfer: canonical USDC, above dust, signed by the
 * sender itself, verified provenance. Proves someone real paid the user; it
 * says nothing about whether the user should pay them.
 */
export function isVerifiedInbound(
  entry: HistoryEntry,
  config: Pick<RiskConfig, 'dustThreshold'>,
): boolean {
  return (
    entry.isCanonicalUsdc &&
    entry.direction === 'in' &&
    entry.amount > config.dustThreshold &&
    entry.provenance === 'verified' &&
    entry.txSigner.status === 'known' &&
    sameAddress(entry.txSigner.address, entry.from)
  );
}

/**
 * The PROTECTED set (docs/DECISIONS.md D14): every trust anchor, plus inbound
 * senders with at least `protectInboundMinTransfers` verified inbound
 * transfers. Lookalikes are compared against this set. Only trust anchors can
 * produce ALLOW; inbound senders never become trusted for sending.
 */
export function buildProtectedSet(
  trust: readonly TrustAnchor[],
  history: readonly HistoryEntry[],
  config: Pick<RiskConfig, 'dustThreshold' | 'protectInboundMinTransfers'>,
): ProtectedAddress[] {
  const inbound = new Map<string, { address: Address; hashes: Hash[] }>();
  for (const entry of history) {
    if (!isVerifiedInbound(entry, config)) continue;
    const key = entry.counterparty.toLowerCase();
    const existing = inbound.get(key);
    if (existing) existing.hashes.push(entry.txHash);
    else inbound.set(key, { address: entry.counterparty, hashes: [entry.txHash] });
  }
  const result: ProtectedAddress[] = [...trust];
  for (const { address, hashes } of inbound.values()) {
    if (hashes.length < config.protectInboundMinTransfers) continue;
    if (trust.some((a) => sameAddress(a.address, address))) continue;
    result.push({ kind: 'inbound-sender', address, evidenceTxHashes: hashes });
  }
  return result;
}

/**
 * How SafeSend names a protected address in copy. Never the short
 * `0x7A3f…e4d2` form: that is exactly what a lookalike shares (D24).
 */
export function anchorLabel(anchor: ProtectedAddress, names?: NameBook): string {
  if (anchor.kind === 'contact') return anchor.contact.name;
  const named = nameFor(anchor.address, names);
  if (named) return named;
  switch (anchor.kind) {
    case 'confirmed-recipient':
      return `an address you paid before (${displayAddress(anchor.address)})`;
    case 'inbound-sender':
      return `someone who has sent you USDC (${displayAddress(anchor.address)})`;
  }
}
