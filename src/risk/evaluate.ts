import { zeroAddress } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { TrustAnchor } from '@/domain/types';
import { parseAddress, sameAddress } from './address';
import type { AddressParseError } from './address';
import { anchorLabel } from './anchors';
import { compareAddresses, isLookalike } from './compare';
import { plantedVia } from './planting';
import type { Decision, Reason, RiskInput, RiskResult, Severity } from './types';

/**
 * S1 version of the decision policy (docs/RISK_MODEL.md). Pure: same input,
 * same output, no I/O. S2 adds amount anomaly and the remaining WARN signals.
 */
export function evaluateRisk(input: RiskInput): RiskResult {
  const { intent, userAddress, anchors, history, historyAvailable, config } = input;

  // --- Structural BLOCKs: nothing else is meaningful if these fail. ---------
  const structural: Reason[] = [];
  if (intent.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    structural.push({
      code: 'WRONG_NETWORK',
      severity: 'block',
      title: 'Wrong network',
      explanation:
        'SafeSend only sends on Base Sepolia (testnet). Switch your wallet to Base Sepolia and try again.',
      evidence: {
        kind: 'network',
        expectedChainId: BASE_SEPOLIA_CHAIN_ID,
        actualChainId: intent.chainId,
      },
    });
  }
  if (!sameAddress(intent.tokenContract, CANONICAL_USDC.address)) {
    structural.push({
      code: 'WRONG_TOKEN',
      severity: 'block',
      title: 'Not real USDC',
      explanation:
        'This token is not the official USDC contract. Tokens can copy the name "USDC", so SafeSend only sends the official one.',
      evidence: { kind: 'token', expected: CANONICAL_USDC.address, actual: intent.tokenContract },
    });
  }

  const parsed = parseAddress(intent.recipientInput);
  if (!parsed.ok) {
    structural.push({
      code: 'INVALID_ADDRESS',
      severity: 'block',
      title: 'This is not a valid address',
      explanation: invalidAddressExplanation(parsed.error),
      evidence: { kind: 'input', raw: intent.recipientInput, detail: parsed.error },
    });
    return finalize(structural);
  }
  const recipient = parsed.address;

  if (sameAddress(recipient, zeroAddress)) {
    structural.push({
      code: 'ZERO_ADDRESS',
      severity: 'block',
      title: 'This address burns funds',
      explanation: 'Anything sent to the zero address is lost forever. No one controls it.',
      evidence: { kind: 'input', raw: intent.recipientInput, detail: 'zero address' },
    });
  }
  if (sameAddress(recipient, CANONICAL_USDC.address)) {
    structural.push({
      code: 'TOKEN_CONTRACT_AS_RECIPIENT',
      severity: 'block',
      title: 'This is the USDC contract, not a person',
      explanation: 'Sending USDC to the USDC contract itself usually loses the funds.',
      evidence: { kind: 'input', raw: intent.recipientInput, detail: 'token contract' },
    });
  }
  if (sameAddress(recipient, userAddress)) {
    structural.push({
      code: 'SELF_SEND',
      severity: 'block',
      title: 'This is your own address',
      explanation: 'You would be sending money to yourself. Check who you meant to pay.',
      evidence: { kind: 'input', raw: intent.recipientInput, detail: 'own address' },
    });
  }
  if (structural.length > 0) return finalize(structural);

  // --- Exact trust anchor: no lookalike check against anything else. -------
  const exact = anchors.find((a) => sameAddress(a.address, recipient));
  if (exact) return finalize([positiveReason(exact)]);

  // --- Lookalike check against every anchor. --------------------------------
  const reasons: Reason[] = [];
  const planted = plantedVia(recipient, history, userAddress, config);
  for (const anchor of anchors) {
    const comparison = compareAddresses(recipient, anchor.address);
    if (!isLookalike(comparison, config.prefixMatchLength, config.suffixMatchLength)) continue;

    const highConfidence = !historyAvailable || planted.length > 0;
    const who = anchorLabel(anchor);
    reasons.push({
      code: highConfidence ? 'LOOKALIKE_HIGH_CONFIDENCE' : 'LOOKALIKE',
      severity: highConfidence ? 'block' : 'warn',
      title: highConfidence
        ? `This address imitates ${who}`
        : `This address looks a lot like ${who}`,
      explanation: highConfidence
        ? `The start and end match ${who}, but the middle is different. ${plantedSentence(planted.length > 0)} This is how address poisoning scams work.`
        : `The start and end match ${who}, but the middle is different. Check every character before you send.`,
      evidence: { kind: 'lookalike', anchor, comparison, plantedVia: planted },
    });
  }
  if (reasons.length > 0) return finalize(reasons);

  // --- New recipient. -------------------------------------------------------
  const large = intent.amount > config.firstSendThreshold;
  reasons.push({
    code: large ? 'NEW_RECIPIENT_LARGE_AMOUNT' : 'NEW_RECIPIENT',
    severity: 'warn',
    title: large ? 'First send to this address, and a large amount' : 'First send to this address',
    explanation: large
      ? 'You have never sent to this address. Consider a small test send first, then confirm with the person by phone before sending the rest. Scammers often strike right after a test send, so double-check the address again for the second send.'
      : 'You have never sent to this address. Make sure you got it directly from the person, not from your history.',
    evidence: { kind: 'none' },
  });
  return finalize(reasons);
}

function plantedSentence(hasPlanting: boolean): string {
  return hasPlanting
    ? 'It appeared in your history through a suspicious transfer, not from someone you know.'
    : 'SafeSend could not check your history, so it is treating this match as dangerous.';
}

function positiveReason(anchor: TrustAnchor): Reason {
  return anchor.kind === 'contact'
    ? {
        code: 'TRUSTED_CONTACT',
        severity: 'info',
        title: `Sending to ${anchor.contact.name}`,
        explanation: 'This exact address is one of your trusted contacts.',
        evidence: { kind: 'anchor', anchor },
      }
    : {
        code: 'CONFIRMED_PAST_RECIPIENT',
        severity: 'info',
        title: 'You have sent to this address before',
        explanation: 'You signed a USDC send to this exact address in the past.',
        evidence: { kind: 'anchor', anchor },
      };
}

function invalidAddressExplanation(error: AddressParseError): string {
  switch (error) {
    case 'empty':
      return 'Enter the full address of the person you want to pay.';
    case 'missing-prefix':
      return 'Addresses start with "0x". Copy the full address again.';
    case 'wrong-length':
      return 'Addresses have exactly 42 characters. Part of it may be missing or extra.';
    case 'not-hex':
      return 'Addresses only use the numbers 0 to 9 and the letters a to f.';
    case 'bad-checksum':
      return 'The mix of capital and small letters does not match a real address. It may have a typo or have been changed.';
  }
}

const SEVERITY_ORDER: Record<Severity, number> = { block: 0, warn: 1, info: 2 };

function finalize(reasons: Reason[]): RiskResult {
  const sorted = [...reasons].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const decision: Decision = sorted.some((r) => r.severity === 'block')
    ? 'BLOCK'
    : sorted.some((r) => r.severity === 'warn')
      ? 'WARN'
      : 'ALLOW';
  const warnCount = sorted.filter((r) => r.severity === 'warn').length;
  const score =
    decision === 'BLOCK' ? 100 : decision === 'WARN' ? Math.min(90, 30 + 20 * warnCount) : 0;
  return { decision, score, reasons: sorted };
}
