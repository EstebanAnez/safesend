import { zeroAddress } from 'viem';
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '@/config/chain';
import type { HistoryEntry, TrustAnchor } from '@/domain/types';
import { parseAddress, sameAddress } from './address';
import type { AddressParseError } from './address';
import { anchorLabel, isConfirmedUserSend } from './anchors';
import { compareAddresses, isLookalike } from './compare';
import { ACKNOWLEDGE_STATEMENT, CHALLENGE_LENGTH, middleRange } from './confirmation';
import { firstAppearedViaPlanting, plantedVia } from './planting';
import type {
  CharacterComparison,
  ConfirmationRequirement,
  Decision,
  Reason,
  RiskConfig,
  RiskInput,
  RiskResult,
  Severity,
} from './types';

/**
 * The send-time decision policy (docs/RISK_MODEL.md). Pure and deterministic.
 *
 * BLOCK (no override): invalid address, zero address, token contract, own
 *   address, wrong network, wrong token, high-confidence lookalike.
 * WARN (explicit confirmation): lookalike below high confidence, new recipient,
 *   amount anomaly, unknown provenance.
 * ALLOW: exact trust anchor with no risk signals.
 */
export function evaluateRisk(input: RiskInput): RiskResult {
  const { intent, userAddress, anchors, history, historyAvailable, config } = input;

  // --- Structural BLOCKs ------------------------------------------------------
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
        'This token is not the official USDC contract. Any token can call itself "USDC", so SafeSend only sends the official one.',
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
    return finalize(structural, { isAnchor: false, comparisons: [] });
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
  if (structural.length > 0) return finalize(structural, { isAnchor: false, comparisons: [] });

  const reasons: Reason[] = [];
  const comparisons: CharacterComparison[] = [];

  // --- Exact trust anchor -----------------------------------------------------
  // A deliberate anchor is not checked for lookalikes of other anchors.
  const exact = anchors.find((a) => sameAddress(a.address, recipient));
  if (exact) {
    reasons.push(positiveReason(exact));
  } else {
    // --- Lookalikes of anchors ------------------------------------------------
    const planted = plantedVia(recipient, history, userAddress, config);
    const firstPlanted = firstAppearedViaPlanting(recipient, history, userAddress, config);
    const highConfidence = !historyAvailable || firstPlanted;
    for (const anchor of anchors) {
      const comparison = compareAddresses(recipient, anchor.address);
      if (!isLookalike(comparison, config.prefixMatchLength, config.suffixMatchLength)) continue;
      comparisons.push(comparison);
      reasons.push(lookalikeReason(anchor, comparison, planted, highConfidence, historyAvailable));
    }

    // --- New recipient --------------------------------------------------------
    const large = intent.amount > config.firstSendThreshold;
    reasons.push({
      code: large ? 'NEW_RECIPIENT_LARGE_AMOUNT' : 'NEW_RECIPIENT',
      severity: 'warn',
      title: large
        ? 'First send to this address, and a large amount'
        : 'First send to this address',
      explanation: large
        ? 'You have never sent to this address, and this is more than a usual first send.'
        : 'You have never sent to this address. Make sure you got it directly from the person, not from your history.',
      evidence: { kind: 'none' },
    });

    // --- Unknown provenance ---------------------------------------------------
    const unknownEntries = history.filter(
      (e) => sameAddress(e.counterparty, recipient) && e.provenance === 'unknown',
    );
    if (unknownEntries.length > 0) {
      reasons.push({
        code: 'UNKNOWN_PROVENANCE',
        severity: 'warn',
        title: 'SafeSend cannot tell where this address came from',
        explanation:
          'This address is in your history, but SafeSend could not confirm how it got there. Do not trust it just because it appears in your history.',
        evidence: { kind: 'history', entryIds: unknownEntries.map((e) => e.id) },
      });
    }
  }

  // --- Amount anomaly (applies to anchors too) ---------------------------------
  const anomaly = amountAnomaly(intent.amount, history, userAddress, config);
  if (anomaly) reasons.push(anomaly);

  return finalize(reasons, { isAnchor: Boolean(exact), comparisons });
}

function lookalikeReason(
  anchor: TrustAnchor,
  comparison: CharacterComparison,
  planted: ReturnType<typeof plantedVia>,
  highConfidence: boolean,
  historyAvailable: boolean,
): Reason {
  const who = anchorLabel(anchor);
  const origin = !historyAvailable
    ? 'SafeSend could not check your history, so it treats this match as dangerous.'
    : 'It first appeared in your history through a suspicious transfer, not from someone you know.';
  return {
    code: highConfidence ? 'LOOKALIKE_HIGH_CONFIDENCE' : 'LOOKALIKE',
    severity: highConfidence ? 'block' : 'warn',
    title: highConfidence ? `This address imitates ${who}` : `This address looks a lot like ${who}`,
    explanation: highConfidence
      ? `The start and end match ${who}, but the middle is different. ${origin} This is how address poisoning scams work.`
      : `The start and end match ${who}, but the middle is different. Check the middle characters with the person before you send.`,
    evidence: { kind: 'lookalike', anchor, comparison, plantedVia: planted },
  };
}

/**
 * WARN when the amount is more than `amountAnomalyMultiplier` times the user's
 * median confirmed send. No baseline (fewer than `amountBaselineMinSends`
 * confirmed sends) means no signal: absence of data is not evidence.
 */
function amountAnomaly(
  amount: bigint,
  history: readonly HistoryEntry[],
  user: Address,
  config: RiskConfig,
): Reason | null {
  const sends = history
    .filter((e) => isConfirmedUserSend(e, user))
    .map((e) => e.amount)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (sends.length < config.amountBaselineMinSends) return null;
  const median = medianOf(sends);
  // Integer math: amount > median * multiplier, with the multiplier scaled by 100.
  const scaled = BigInt(Math.round(config.amountAnomalyMultiplier * 100));
  if (amount * 100n <= median * scaled) return null;
  return {
    code: 'AMOUNT_ANOMALY',
    severity: 'warn',
    title: 'Much larger than your usual send',
    explanation: `This is more than ${config.amountAnomalyMultiplier} times what you usually send. Scams often push for a large, urgent payment. Take a moment to confirm.`,
    evidence: { kind: 'amount', amount, reference: median, referenceLabel: 'your median send' },
  };
}

function medianOf(sorted: readonly bigint[]): bigint {
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0n;
  if (sorted.length % 2 === 1) return hi;
  const lo = sorted[mid - 1] ?? 0n;
  return (lo + hi) / 2n;
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

function finalize(
  reasons: Reason[],
  context: { isAnchor: boolean; comparisons: readonly CharacterComparison[] },
): RiskResult {
  const sorted = [...reasons].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const warnings = sorted.filter((r) => r.severity === 'warn');
  const decision: Decision = sorted.some((r) => r.severity === 'block')
    ? 'BLOCK'
    : warnings.length > 0
      ? 'WARN'
      : 'ALLOW';

  let confirmation: ConfirmationRequirement = { level: 'none' };
  if (decision === 'WARN') {
    const onlyLightNewRecipient = warnings.length === 1 && warnings[0]?.code === 'NEW_RECIPIENT';
    confirmation = onlyLightNewRecipient
      ? { level: 'acknowledge', statement: ACKNOWLEDGE_STATEMENT }
      : {
          level: 'middle-characters',
          count: CHALLENGE_LENGTH,
          ...middleRange(context.comparisons),
        };
  }
  // A test send makes sense for someone new, not for a trusted contact.
  const testSendSuggested =
    decision === 'WARN' && !context.isAnchor && confirmation.level === 'middle-characters';

  const score =
    decision === 'BLOCK' ? 100 : decision === 'WARN' ? Math.min(90, 20 + 20 * warnings.length) : 0;
  return { decision, score, reasons: sorted, confirmation, testSendSuggested };
}
