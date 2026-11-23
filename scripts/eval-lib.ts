/**
 * Evaluation library: converts frozen case files into engine inputs and
 * computes metrics. Pure (no I/O) so it can be unit-tested.
 * All results are SYNTHETIC: they describe rule behavior on hand-written cases.
 */
import { getAddress, keccak256, parseUnits, toHex } from 'viem';
import type { Address } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, CANONICAL_USDC } from '../src/config/chain';
import type { Contact, HistoryEntry } from '../src/domain/types';
import { buildTrustAnchors } from '../src/risk/anchors';
import { evaluateRisk } from '../src/risk/evaluate';
import type { RiskConfig, RiskInput } from '../src/risk/types';

// --- Case file schema (mirrors eval/holdout/build-holdout.ts) ---------------------
export interface TransferSpec {
  block: number;
  logIndex?: number;
  token?: { contract: string; symbol: string };
  from: string;
  to: string;
  amount: string;
  signer: string | null;
  provenance?: 'verified' | 'inferred' | 'unknown';
}

export interface EvalCase {
  id: string;
  label: 'attack' | 'legit';
  category: string;
  title: string;
  rationale: string;
  sources: string[];
  user: string;
  contacts: { name: string; address: string }[];
  history: TransferSpec[];
  testSends: { recipient: string; block: number; amount: string }[];
  historyAvailable: boolean;
  send: { recipient: string; amount: string; pickedFrom: string };
}

export interface CaseFile {
  schemaVersion: number;
  description: string;
  cases: EvalCase[];
}

export interface ThresholdSetting {
  name: string;
  prefixMatchLength: number;
  suffixMatchLength: number;
}

export const THRESHOLD_SETTINGS: readonly ThresholdSetting[] = [
  { name: '3/3', prefixMatchLength: 3, suffixMatchLength: 3 },
  { name: '3/4', prefixMatchLength: 3, suffixMatchLength: 4 },
  { name: '4/4', prefixMatchLength: 4, suffixMatchLength: 4 },
  { name: '4/5', prefixMatchLength: 4, suffixMatchLength: 5 },
];

// --- Conversion ------------------------------------------------------------------
const usdc = (value: string) => parseUnits(value, 6);

export function toHistoryEntry(
  caseId: string,
  user: Address,
  spec: TransferSpec,
  i: number,
): HistoryEntry {
  const from = getAddress(spec.from);
  const to = getAddress(spec.to);
  const tokenContract = getAddress(spec.token?.contract ?? CANONICAL_USDC.address);
  const isCanonicalUsdc = tokenContract === CANONICAL_USDC.address;
  const direction = to === user ? 'in' : from === user ? 'out' : 'unknown';
  const provenance = spec.provenance ?? (spec.signer ? 'verified' : 'inferred');
  const txHash = keccak256(toHex(`eval:${caseId}:${i}`));
  const logIndex = spec.logIndex ?? 0;
  return {
    id: `${txHash}:${logIndex}`,
    source: 'fixture',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    tokenContract,
    tokenSymbolClaimed: spec.token?.symbol ?? 'USDC',
    isCanonicalUsdc,
    direction,
    from,
    to,
    counterparty: direction === 'in' ? from : to,
    amount: usdc(spec.amount),
    tokenDecimals: 6,
    txHash,
    logIndex,
    txSigner: spec.signer
      ? { status: 'known', address: getAddress(spec.signer), via: 'tx-from' }
      : { status: 'unknown' },
    blockNumber: BigInt(spec.block),
    blockTime: spec.block * 2,
    provenance,
    confidence: provenance === 'verified' ? 'high' : 'low',
  };
}

export function toRiskInput(c: EvalCase, config: RiskConfig): RiskInput {
  const user = getAddress(c.user);
  const history = c.historyAvailable
    ? c.history.map((h, i) => toHistoryEntry(c.id, user, h, i))
    : [];
  const contacts: Contact[] = c.contacts.map((ct, i) => ({
    id: `${c.id}-contact-${i}`,
    name: ct.name,
    address: getAddress(ct.address),
    addedAt: 0,
    addedVia: 'typed',
    verifiedOutOfBand: false,
  }));
  return {
    intent: {
      recipientInput: c.send.recipient,
      amount: usdc(c.send.amount),
      chainId: BASE_SEPOLIA_CHAIN_ID,
      tokenContract: CANONICAL_USDC.address,
    },
    userAddress: user,
    anchors: buildTrustAnchors(contacts, history, user, config),
    history,
    historyAvailable: c.historyAvailable,
    testSends: c.testSends.map((t) => ({
      recipient: getAddress(t.recipient),
      amount: usdc(t.amount),
      blockNumber: BigInt(t.block),
    })),
    config,
  };
}

// --- Outcomes and metrics ----------------------------------------------------------
/** What the user experiences, from least to most friction. */
export type Outcome = 'ALLOW' | 'WARN_CHECKBOX' | 'WARN_STRONG' | 'BLOCK';
export type Level = 'blocked' | 'strong' | 'flagged';
export const LEVELS: readonly Level[] = ['blocked', 'strong', 'flagged'];

export function outcomeOf(input: RiskInput): Outcome {
  const r = evaluateRisk(input);
  if (r.decision === 'BLOCK') return 'BLOCK';
  if (r.decision === 'ALLOW') return 'ALLOW';
  return r.confirmation.level === 'acknowledge' ? 'WARN_CHECKBOX' : 'WARN_STRONG';
}

/** Does this outcome count as "caught" at a given level? */
export function caughtAt(outcome: Outcome, level: Level): boolean {
  switch (level) {
    case 'blocked':
      return outcome === 'BLOCK';
    case 'strong':
      return outcome === 'BLOCK' || outcome === 'WARN_STRONG';
    case 'flagged':
      return outcome !== 'ALLOW';
  }
}

export interface Confusion {
  tp: number;
  fn: number;
  fp: number;
  tn: number;
  precision: number | null;
  recall: number | null;
}

export interface SettingResult {
  setting: string;
  attacks: number;
  legit: number;
  outcomes: Record<string, Outcome>;
  confusion: Record<Level, Confusion>;
  /** Attack cases that reached ALLOW or only a checkbox WARN. */
  misses: { id: string; outcome: Outcome; title: string }[];
  /** Legit sends by friction: raw counts. */
  legitByOutcome: Record<Outcome, number>;
}

export function evaluateCases(
  cases: readonly EvalCase[],
  base: RiskConfig,
  setting: ThresholdSetting,
): SettingResult {
  const config: RiskConfig = {
    ...base,
    prefixMatchLength: setting.prefixMatchLength,
    suffixMatchLength: setting.suffixMatchLength,
  };
  const outcomes: Record<string, Outcome> = {};
  for (const c of cases) outcomes[c.id] = outcomeOf(toRiskInput(c, config));

  const confusion = {} as Record<Level, Confusion>;
  for (const level of LEVELS) {
    let tp = 0;
    let fn = 0;
    let fp = 0;
    let tn = 0;
    for (const c of cases) {
      const caught = caughtAt(outcomes[c.id] ?? 'ALLOW', level);
      if (c.label === 'attack') {
        if (caught) tp += 1;
        else fn += 1;
      } else if (caught) {
        fp += 1;
      } else {
        tn += 1;
      }
    }
    confusion[level] = {
      tp,
      fn,
      fp,
      tn,
      precision: tp + fp === 0 ? null : tp / (tp + fp),
      recall: tp + fn === 0 ? null : tp / (tp + fn),
    };
  }

  const misses = cases
    .filter((c) => c.label === 'attack')
    .filter((c) => !caughtAt(outcomes[c.id] ?? 'ALLOW', 'strong'))
    .map((c) => ({ id: c.id, outcome: outcomes[c.id] ?? 'ALLOW', title: c.title }));

  const legitByOutcome: Record<Outcome, number> = {
    ALLOW: 0,
    WARN_CHECKBOX: 0,
    WARN_STRONG: 0,
    BLOCK: 0,
  };
  for (const c of cases) if (c.label === 'legit') legitByOutcome[outcomes[c.id] ?? 'ALLOW'] += 1;

  return {
    setting: setting.name,
    attacks: cases.filter((c) => c.label === 'attack').length,
    legit: cases.filter((c) => c.label === 'legit').length,
    outcomes,
    confusion,
    misses,
    legitByOutcome,
  };
}

// --- Regression check ----------------------------------------------------------------
export interface BaselineEntry {
  setting: string;
  tp: Record<Level, number>;
  fp: Record<Level, number>;
}

export function toBaseline(r: SettingResult): BaselineEntry {
  return {
    setting: r.setting,
    tp: {
      blocked: r.confusion.blocked.tp,
      strong: r.confusion.strong.tp,
      flagged: r.confusion.flagged.tp,
    },
    fp: {
      blocked: r.confusion.blocked.fp,
      strong: r.confusion.strong.fp,
      flagged: r.confusion.flagged.fp,
    },
  };
}

/** Worse = fewer attacks caught at any level, or more legit sends flagged at any level. */
export function regressions(current: BaselineEntry, baseline: BaselineEntry): string[] {
  const problems: string[] = [];
  for (const level of LEVELS) {
    if (current.tp[level] < baseline.tp[level]) {
      problems.push(`${level}: attacks caught ${baseline.tp[level]} -> ${current.tp[level]}`);
    }
    if (current.fp[level] > baseline.fp[level]) {
      problems.push(`${level}: legit sends flagged ${baseline.fp[level]} -> ${current.fp[level]}`);
    }
  }
  return problems;
}
