import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import { parseAddress, sameAddress } from './address';
import { evaluateRisk } from './evaluate';
import type { RiskInput, RiskResult, SendIntent } from './types';

export type ReverifyFailure =
  | 'RECIPIENT_CHANGED'
  | 'AMOUNT_CHANGED'
  | 'WRONG_NETWORK'
  | 'WRONG_TOKEN'
  | 'BLOCKED'
  | 'DECISION_CHANGED'
  | 'NOT_CONFIRMED';

export type ReverifyResult =
  { ok: true; result: RiskResult } | { ok: false; failure: ReverifyFailure; message: string };

const MESSAGES: Record<ReverifyFailure, string> = {
  RECIPIENT_CHANGED: 'The recipient changed after you reviewed it. Review the send again.',
  AMOUNT_CHANGED: 'The amount changed after you reviewed it. Review the send again.',
  WRONG_NETWORK: 'Your wallet is not on Base Sepolia. Switch networks and review again.',
  WRONG_TOKEN: 'This is not the official USDC contract. SafeSend stopped the send.',
  BLOCKED: 'A final check blocked this send. Review the reasons before trying again.',
  DECISION_CHANGED: 'The risk check changed since you reviewed it. Review the send again.',
  NOT_CONFIRMED: 'This send needs your confirmation first.',
};

const fail = (failure: ReverifyFailure): ReverifyResult => ({
  ok: false,
  failure,
  message: MESSAGES[failure],
});

/**
 * Run immediately before requesting a signature, on the FINAL values that will
 * be signed (live chain id, form values, current history). Proceeds only if
 * nothing changed and the decision is ALLOW, or the same WARN the user confirmed.
 */
export function reverifySend(params: {
  reviewed: { intent: SendIntent; result: RiskResult };
  final: RiskInput;
  confirmationSatisfied: boolean;
}): ReverifyResult {
  const { reviewed, final, confirmationSatisfied } = params;

  const before = parseAddress(reviewed.intent.recipientInput);
  const after = parseAddress(final.intent.recipientInput);
  if (!before.ok || !after.ok || !sameAddress(before.address, after.address)) {
    return fail('RECIPIENT_CHANGED');
  }
  if (final.intent.amount !== reviewed.intent.amount) return fail('AMOUNT_CHANGED');
  if (final.intent.chainId !== BASE_SEPOLIA_CHAIN_ID) return fail('WRONG_NETWORK');
  if (!sameAddress(final.intent.tokenContract, CANONICAL_USDC.address)) return fail('WRONG_TOKEN');

  const result = evaluateRisk(final);
  if (result.decision === 'BLOCK') return fail('BLOCKED');
  if (result.decision === 'ALLOW') return { ok: true, result };

  // WARN: must be a WARN the user saw and confirmed, at the same confirmation level.
  if (
    reviewed.result.decision !== 'WARN' ||
    reviewed.result.confirmation.level !== result.confirmation.level
  ) {
    return fail('DECISION_CHANGED');
  }
  if (!confirmationSatisfied) return fail('NOT_CONFIRMED');
  return { ok: true, result };
}
