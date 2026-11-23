import { decodeEventLog, parseAbi, toEventSelector } from 'viem';
import type { Address, Hex } from 'viem';
import { CANONICAL_ENTRYPOINTS } from '@/config/entrypoints';
import type { TxSigner } from '@/domain/types';
import { sameAddress } from './address';

/**
 * Who authorized a specific ERC-20 Transfer log, from the transaction's `from`
 * and its receipt logs. Pure: providers fetch the data, this decides.
 * Rules (docs/DECISIONS.md D5):
 *
 * 1. If the tx was sent directly by the transfer's `from` (EOA send), the signer is that address.
 * 2. Otherwise, if the tx contains logs from a canonical EntryPoint (a 4337 bundle), the transfer
 *    is attributed to the user operation whose log range contains it, ONLY if:
 *    - that op's UserOperationEvent was emitted by a canonical EntryPoint,
 *    - success == true,
 *    - the Transfer sits strictly after the previous boundary (the previous UserOperationEvent or
 *      BeforeExecution from the same EntryPoint, whichever is later) and before this op's event,
 *    - Transfer.from == the op's sender.
 *    A bundle can carry other accounts' operations, so the user's op being present in the tx
 *    is never enough on its own.
 * 3. If none of this can be verified, the signer is unknown.
 */

export interface RawLog {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
  logIndex: number;
}

export interface TxEvidence {
  from: Address;
  logs: readonly RawLog[];
}

const ENTRYPOINT_ABI = parseAbi([
  'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
  'event BeforeExecution()',
]);
const TRANSFER_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export const USER_OPERATION_EVENT_TOPIC = toEventSelector(
  'UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)',
);
export const BEFORE_EXECUTION_TOPIC = toEventSelector('BeforeExecution()');
export const TRANSFER_TOPIC = toEventSelector('Transfer(address,address,uint256)');

const isCanonicalEntryPoint = (address: Address) =>
  CANONICAL_ENTRYPOINTS.some((ep) => sameAddress(ep.address, address));

function decodeTransferFrom(log: RawLog): Address | null {
  if (log.topics[0] !== TRANSFER_TOPIC) return null;
  try {
    const decoded = decodeEventLog({
      abi: TRANSFER_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    return decoded.args.from;
  } catch {
    return null;
  }
}

export function resolveTransferSigner(tx: TxEvidence, transferLogIndex: number): TxSigner {
  const transfer = tx.logs.find((l) => l.logIndex === transferLogIndex);
  if (!transfer) return { status: 'unknown' };
  const transferFrom = decodeTransferFrom(transfer);
  if (!transferFrom) return { status: 'unknown' };

  const entryPointLogs = tx.logs.filter((l) => isCanonicalEntryPoint(l.address));

  // Rule 1: not a 4337 bundle, so the tx signer is tx.from. It may differ from
  // Transfer.from (a spender's transferFrom, or a zero-value poisoning call);
  // callers decide whether the signer is the user (see isConfirmedUserSend).
  if (entryPointLogs.length === 0) {
    return { status: 'known', address: tx.from, via: 'tx-from' };
  }

  // Rule 2: find the user operation whose log range contains the transfer.
  const ordered = [...tx.logs].sort((a, b) => a.logIndex - b.logIndex);
  let lowerBound: number | null = null;
  let lowerBoundEntryPoint: Address | null = null;
  for (const log of ordered) {
    if (!isCanonicalEntryPoint(log.address)) continue;

    if (log.topics[0] === BEFORE_EXECUTION_TOPIC) {
      lowerBound = log.logIndex;
      lowerBoundEntryPoint = log.address;
      continue;
    }
    if (log.topics[0] !== USER_OPERATION_EVENT_TOPIC) continue;

    const opEventIndex = log.logIndex;
    const sameEntryPoint =
      lowerBoundEntryPoint !== null && sameAddress(lowerBoundEntryPoint, log.address);
    const inRange =
      lowerBound !== null &&
      sameEntryPoint &&
      transfer.logIndex > lowerBound &&
      transfer.logIndex < opEventIndex;

    if (inRange) {
      let op: { sender: Address; success: boolean };
      try {
        const decoded = decodeEventLog({
          abi: ENTRYPOINT_ABI,
          eventName: 'UserOperationEvent',
          data: log.data,
          topics: log.topics as [Hex, ...Hex[]],
        });
        op = { sender: decoded.args.sender, success: decoded.args.success };
      } catch {
        return { status: 'unknown' };
      }
      if (!op.success) return { status: 'unknown' };
      if (!sameAddress(op.sender, transferFrom)) return { status: 'unknown' };
      return { status: 'known', address: op.sender, via: 'user-operation' };
    }

    // This op's event closes its range; the next op's range starts after it.
    lowerBound = opEventIndex;
    lowerBoundEntryPoint = log.address;
  }

  // In a bundle but outside any verifiable op range (e.g. during validation).
  return { status: 'unknown' };
}
