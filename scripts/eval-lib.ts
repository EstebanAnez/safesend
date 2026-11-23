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
import type { ReasonCode, RiskConfig, RiskInput } from '../src/risk/types';

// --- Case file schema (mirrors the holdout authoring scripts) ----------------------
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
  /** Holdout v2: who wrote the case. */
  author?: string;
}

export interface CaseFile {
  schemaVersion: number;
  description: string;
  cases: EvalCase[];
}

/** A named lookalike-rule configuration to evaluate. */
export interface RuleSetting {
  name: string;
  apply: (base: RiskConfig) => RiskConfig;
}

const prefixSuffix = (p: number, q: number): RuleSetting => ({
  name: `${p}/${q}`,
  apply: (base) => ({ ...base, lookalike: { kind: 'prefix-suffix', minPrefix: p, minSuffix: q } }),
});

const totalRule = (minTotal: number, minEachEnd: number): RuleSetting => ({
  name: `total>=${minTotal} (>=${minEachEnd} each end)`,
  apply: (base) => ({ ...base, lookalike: { kind: 'total', minTotal, minEachEnd } }),
});

export const RULE_SETTINGS: readonly RuleSetting[] = [
  prefixSuffix(3, 3),
  prefixSuffix(3, 4),
  prefixSuffix(4, 4),
  prefixSuffix(4, 5),
  totalRule(6, 2),
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

/** Reasons that come from address/provenance evidence, as opposed to the amount rules. */
export const SIGNAL_CODES: ReadonlySet<ReasonCode> = new Set<ReasonCode>([
  'LOOKALIKE_HIGH_CONFIDENCE',
  'LOOKALIKE',
  'UNKNOWN_PROVENANCE',
]);

export interface CaseResult {
  outcome: Outcome;
  codes: ReasonCode[];
}

export function runCase(input: RiskInput): CaseResult {
  const r = evaluateRisk(input);
  const outcome: Outcome =
    r.decision === 'BLOCK'
      ? 'BLOCK'
      : r.decision === 'ALLOW'
        ? 'ALLOW'
        : r.confirmation.level === 'acknowledge'
          ? 'WARN_CHECKBOX'
          : 'WARN_STRONG';
  return { outcome, codes: r.reasons.map((x) => x.code) };
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

/** Caught because of an address/provenance signal (not merely the amount rules). */
export function caughtBySignal(r: CaseResult): boolean {
  return r.outcome !== 'ALLOW' && r.codes.some((c) => SIGNAL_CODES.has(c));
}

/** Strong friction that came only from the amount rules (no address/provenance signal). */
export function strongFromAmountOnly(r: CaseResult): boolean {
  return r.outcome === 'WARN_STRONG' && !r.codes.some((c) => SIGNAL_CODES.has(c));
}

/** Wilson score interval, 95% (z = 1.96). Returns [low, high] as proportions. */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
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
  cases: Record<string, CaseResult>;
  confusion: Record<Level, Confusion>;
  /** Attacks caught by a lookalike/provenance signal (any friction level). */
  attacksBySignal: number;
  /** Attacks that got strong friction only because of the amount rules. */
  attacksStrongFromAmountOnly: number;
  /** Attack cases that reached ALLOW or only a checkbox WARN. */
  misses: { id: string; outcome: Outcome; title: string }[];
  /** Legit sends by friction: raw counts. */
  legitByOutcome: Record<Outcome, number>;
}

export function evaluateCases(
  cases: readonly EvalCase[],
  base: RiskConfig,
  setting: RuleSetting,
): SettingResult {
  const config = setting.apply(base);
  const results: Record<string, CaseResult> = {};
  for (const c of cases) results[c.id] = runCase(toRiskInput(c, config));
  const get = (id: string): CaseResult => results[id] ?? { outcome: 'ALLOW', codes: [] };

  const confusion = {} as Record<Level, Confusion>;
  for (const level of LEVELS) {
    let tp = 0;
    let fn = 0;
    let fp = 0;
    let tn = 0;
    for (const c of cases) {
      const caught = caughtAt(get(c.id).outcome, level);
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

  const attackCases = cases.filter((c) => c.label === 'attack');
  const misses = attackCases
    .filter((c) => !caughtAt(get(c.id).outcome, 'strong'))
    .map((c) => ({ id: c.id, outcome: get(c.id).outcome, title: c.title }));

  const legitByOutcome: Record<Outcome, number> = {
    ALLOW: 0,
    WARN_CHECKBOX: 0,
    WARN_STRONG: 0,
    BLOCK: 0,
  };
  for (const c of cases) if (c.label === 'legit') legitByOutcome[get(c.id).outcome] += 1;

  return {
    setting: setting.name,
    attacks: attackCases.length,
    legit: cases.length - attackCases.length,
    cases: results,
    confusion,
    attacksBySignal: attackCases.filter((c) => caughtBySignal(get(c.id))).length,
    attacksStrongFromAmountOnly: attackCases.filter((c) => strongFromAmountOnly(get(c.id))).length,
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

/** Structural equality for configs (BigInt-safe). */
export function sameConfig(a: RiskConfig, b: RiskConfig): boolean {
  const ser = (x: RiskConfig) =>
    JSON.stringify(x, (_k, v: unknown) => (typeof v === 'bigint' ? `${v}n` : v));
  return ser(a) === ser(b);
}
