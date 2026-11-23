import type { Address, Hash } from 'viem';
import type { HistoryEntry, TrustAnchor } from '@/domain/types';
import { sameAddress } from './address';
import { compareAddresses, isLookalike } from './compare';
import { firstAppearedViaPlanting } from './planting';
import type { RiskConfig, TestSend } from './types';

/**
 * Test-send follow-up (docs/DECISIONS.md D13). Attackers watch for small test
 * sends and plant a lookalike of the recipient minutes later, betting the
 * victim copies it from history for the real send.
 */

/** A test send SafeSend performed counts as a confirmed recipient, unless that address was itself planted. */
export function testSendAnchors(
  testSends: readonly TestSend[],
  existing: readonly TrustAnchor[],
  history: readonly HistoryEntry[],
  user: Address,
  config: Pick<RiskConfig, 'dustThreshold'>,
): TrustAnchor[] {
  const added: TrustAnchor[] = [];
  for (const t of testSends) {
    if ([...existing, ...added].some((a) => sameAddress(a.address, t.recipient))) continue;
    if (firstAppearedViaPlanting(t.recipient, history, user, config)) continue;
    added.push({
      kind: 'confirmed-recipient',
      address: t.recipient,
      evidenceTxHashes: t.txHash ? [t.txHash] : [],
      lastSentAt: null,
    });
  }
  return added;
}

const isAfter = (entry: HistoryEntry, t: TestSend) => entry.blockNumber > t.blockNumber;

/**
 * History entries involving `address` that appeared AFTER a test send to an
 * address it imitates. Any amount and any token count: after a test send, a
 * lookalike showing up at all is the attack signature.
 */
export function entriesAfterTestSend(
  address: Address,
  history: readonly HistoryEntry[],
  testSends: readonly TestSend[],
  config: Pick<RiskConfig, 'prefixMatchLength' | 'suffixMatchLength'>,
): { entryId: string; txHash: Hash; testRecipient: Address }[] {
  const imitated = testSends.filter((t) => {
    const c = compareAddresses(address, t.recipient);
    return isLookalike(c, config.prefixMatchLength, config.suffixMatchLength);
  });
  if (imitated.length === 0) return [];
  const result: { entryId: string; txHash: Hash; testRecipient: Address }[] = [];
  for (const entry of history) {
    if (!sameAddress(entry.counterparty, address)) continue;
    const t = imitated.find((x) => isAfter(entry, x));
    if (t) result.push({ entryId: entry.id, txHash: entry.txHash, testRecipient: t.recipient });
  }
  return result;
}
