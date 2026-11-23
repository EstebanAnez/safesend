import { encodeAbiParameters, getAddress, pad } from 'viem';
import type { Address, Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import { CANONICAL_USDC } from '@/config/chain';
import { CANONICAL_ENTRYPOINTS } from '@/config/entrypoints';
import {
  BEFORE_EXECUTION_TOPIC,
  resolveTransferSigner,
  TRANSFER_TOPIC,
  USER_OPERATION_EVENT_TOPIC,
} from './signer';
import type { RawLog } from './signer';

const EP = CANONICAL_ENTRYPOINTS[0]!.address; // v0.6, used by Coinbase Smart Wallet
const EP_V07 = CANONICAL_ENTRYPOINTS[1]!.address;
const FAKE_EP = getAddress('0x00000000000000000000000000000000deadbeef');

const USER_SMART_ACCOUNT = getAddress('0x1111111111111111111111111111111111111111');
const OTHER_ACCOUNT = getAddress('0x2222222222222222222222222222222222222222');
const BUNDLER = getAddress('0x3333333333333333333333333333333333333333');
const RECIPIENT = getAddress('0x4444444444444444444444444444444444444444');
const LOOKALIKE = getAddress('0x4444abababababababababababababababab4444');
const USER_EOA = getAddress('0x5555555555555555555555555555555555555555');

const topicAddr = (a: Address): Hex => pad(a, { size: 32 });

function transfer(logIndex: number, from: Address, to: Address, value: bigint): RawLog {
  return {
    address: CANONICAL_USDC.address,
    topics: [TRANSFER_TOPIC, topicAddr(from), topicAddr(to)],
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    logIndex,
  };
}

function beforeExecution(logIndex: number, entryPoint: Address = EP): RawLog {
  return { address: entryPoint, topics: [BEFORE_EXECUTION_TOPIC], data: '0x', logIndex };
}

function userOpEvent(
  logIndex: number,
  sender: Address,
  success: boolean,
  entryPoint: Address = EP,
): RawLog {
  return {
    address: entryPoint,
    topics: [
      USER_OPERATION_EVENT_TOPIC,
      pad(`0x${logIndex.toString(16)}`, { size: 32 }), // userOpHash (arbitrary)
      topicAddr(sender),
      topicAddr('0x0000000000000000000000000000000000000000'), // no paymaster
    ],
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bool' }, { type: 'uint256' }, { type: 'uint256' }],
      [0n, success, 1000n, 50_000n],
    ),
    logIndex,
  };
}

describe('resolveTransferSigner: EOA transactions', () => {
  it('attributes a direct send to tx.from', () => {
    const tx = { from: USER_EOA, logs: [transfer(0, USER_EOA, RECIPIENT, 5_000_000n)] };
    expect(resolveTransferSigner(tx, 0)).toEqual({
      status: 'known',
      address: USER_EOA,
      via: 'tx-from',
    });
  });

  it('reports the attacker as signer of a zero-value transferFrom "from" the user', () => {
    const tx = { from: BUNDLER, logs: [transfer(0, USER_EOA, LOOKALIKE, 0n)] };
    const signer = resolveTransferSigner(tx, 0);
    expect(signer).toEqual({ status: 'known', address: BUNDLER, via: 'tx-from' });
  });

  it('is unknown when the referenced log is missing or not a Transfer', () => {
    const tx = { from: USER_EOA, logs: [beforeExecution(0)] };
    expect(resolveTransferSigner(tx, 0)).toEqual({ status: 'unknown' });
    expect(resolveTransferSigner(tx, 7)).toEqual({ status: 'unknown' });
  });
});

describe('resolveTransferSigner: 4337 bundles', () => {
  it('attributes a transfer inside the user op range to the smart account', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0),
        transfer(1, USER_SMART_ACCOUNT, RECIPIENT, 5_000_000n),
        userOpEvent(2, USER_SMART_ACCOUNT, true),
      ],
    };
    expect(resolveTransferSigner(tx, 1)).toEqual({
      status: 'known',
      address: USER_SMART_ACCOUNT,
      via: 'user-operation',
    });
  });

  it('multi-op bundle: another account op moving the user tokens is NOT the user', () => {
    // Op 1 (user): a real send. Op 2 (attacker account): a zero-value
    // transferFrom(user -> lookalike) in the SAME transaction.
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0),
        transfer(1, USER_SMART_ACCOUNT, RECIPIENT, 5_000_000n),
        userOpEvent(2, USER_SMART_ACCOUNT, true),
        transfer(3, USER_SMART_ACCOUNT, LOOKALIKE, 0n),
        userOpEvent(4, OTHER_ACCOUNT, true),
      ],
    };
    // The user's real transfer is attributed to the user.
    expect(resolveTransferSigner(tx, 1)).toMatchObject({
      status: 'known',
      address: USER_SMART_ACCOUNT,
    });
    // The poisoning transfer sits in the other op's range, whose sender is not
    // Transfer.from, so it cannot be verified: unknown, never the user.
    expect(resolveTransferSigner(tx, 3)).toEqual({ status: 'unknown' });
  });

  it('multi-op bundle: the user op appearing first does not cover a later op transfer', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0),
        userOpEvent(1, USER_SMART_ACCOUNT, true),
        transfer(2, OTHER_ACCOUNT, RECIPIENT, 1n),
        userOpEvent(3, OTHER_ACCOUNT, true),
      ],
    };
    expect(resolveTransferSigner(tx, 2)).toEqual({
      status: 'known',
      address: OTHER_ACCOUNT,
      via: 'user-operation',
    });
  });

  it('is unknown when the user op failed (success = false)', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0),
        transfer(1, USER_SMART_ACCOUNT, RECIPIENT, 5_000_000n),
        userOpEvent(2, USER_SMART_ACCOUNT, false),
      ],
    };
    expect(resolveTransferSigner(tx, 1)).toEqual({ status: 'unknown' });
  });

  it('ignores UserOperationEvent-shaped logs from a non-canonical contract', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0, FAKE_EP),
        transfer(1, USER_SMART_ACCOUNT, LOOKALIKE, 0n),
        userOpEvent(2, USER_SMART_ACCOUNT, true, FAKE_EP),
      ],
    };
    // No canonical EntryPoint logs: plain tx, signer is the bundler/attacker, not the user.
    expect(resolveTransferSigner(tx, 1)).toEqual({
      status: 'known',
      address: BUNDLER,
      via: 'tx-from',
    });
  });

  it('is unknown for a transfer before BeforeExecution (validation phase)', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        transfer(0, USER_SMART_ACCOUNT, RECIPIENT, 1n),
        beforeExecution(1),
        userOpEvent(2, USER_SMART_ACCOUNT, true),
      ],
    };
    expect(resolveTransferSigner(tx, 0)).toEqual({ status: 'unknown' });
  });

  it('is unknown when Transfer.from is not the op sender', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0),
        transfer(1, OTHER_ACCOUNT, RECIPIENT, 1n),
        userOpEvent(2, USER_SMART_ACCOUNT, true),
      ],
    };
    expect(resolveTransferSigner(tx, 1)).toEqual({ status: 'unknown' });
  });

  it('does not let a range opened by one EntryPoint be closed by another', () => {
    const tx = {
      from: BUNDLER,
      logs: [
        beforeExecution(0, EP),
        transfer(1, USER_SMART_ACCOUNT, RECIPIENT, 1n),
        userOpEvent(2, USER_SMART_ACCOUNT, true, EP_V07),
      ],
    };
    expect(resolveTransferSigner(tx, 1)).toEqual({ status: 'unknown' });
  });

  it('is unknown when tx.from is the user but the transfer sits in another account op', () => {
    // The user's EOA acting as a bundler does not make another account's op theirs.
    const tx = {
      from: USER_EOA,
      logs: [
        beforeExecution(0),
        transfer(1, USER_EOA, LOOKALIKE, 0n),
        userOpEvent(2, OTHER_ACCOUNT, true),
      ],
    };
    expect(resolveTransferSigner(tx, 1)).toEqual({ status: 'unknown' });
  });
});
