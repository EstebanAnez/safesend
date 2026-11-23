/**
 * npm run eval                       Evaluate holdout(s) + dev at every rule setting.
 * npm run eval:check                 CI regression check: the shipped setting on holdout v1
 *                                    must not be worse than eval/baseline.json.
 * npm run eval -- --write-baseline   Record the current holdout v1 result as the baseline.
 * npm run eval -- --report <file>    Also write the markdown report to <file>.
 *
 * Every number is SYNTHETIC (hand-written scenarios), never fraud prevented.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RISK_CONFIG } from '../src/risk/config';
import {
  evaluateCases,
  LEVELS,
  regressions,
  RULE_SETTINGS,
  sameConfig,
  toBaseline,
  wilson,
} from './eval-lib';
import type { BaselineEntry, CaseFile, SettingResult } from './eval-lib';

const root = join(import.meta.dirname, '..', 'eval');
const argv = process.argv.slice(2);
const args = new Set(argv);
const lines: string[] = [];
const out = (s = '') => {
  lines.push(s);
  console.log(s);
};

/** Loads a frozen case file, refusing to run if it changed after its freeze. */
function loadFrozen(dir: string): CaseFile | null {
  const file = join(root, dir, 'cases.json');
  const shaFile = join(root, dir, 'cases.sha256');
  if (!existsSync(file) || !existsSync(shaFile)) return null;
  const raw = readFileSync(file, 'utf8');
  const expected = readFileSync(shaFile, 'utf8').trim();
  const actual = createHash('sha256').update(raw).digest('hex');
  if (actual !== expected) {
    console.error(
      `${dir}/cases.json changed after freeze (${actual} != ${expected}). Refusing to run.`,
    );
    process.exit(2);
  }
  return JSON.parse(raw) as CaseFile;
}

function loadDev(): CaseFile | null {
  const file = join(root, 'dev', 'cases.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CaseFile) : null;
}

const fmtRate = (k: number, n: number) => {
  const [lo, hi] = wilson(k, n);
  const p = n === 0 ? 0 : k / n;
  return `${k}/${n} (${(100 * p).toFixed(0)}%, CI ${(100 * lo).toFixed(0)}–${(100 * hi).toFixed(0)}%)`;
};
const ratio = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));

function report(title: string, results: SettingResult[]) {
  out(`\n## ${title} (SYNTHETIC)\n`);
  const first = results[0];
  if (!first) return;
  out(
    `${first.attacks} attack cases, ${first.legit} legitimate sends. Rates show raw counts and Wilson 95% intervals.\n`,
  );

  out('### Attacks\n');
  out(
    '| Rule | Blocked | Strong friction (BLOCK or middle-char WARN) | Flagged at all | Caught by lookalike/provenance signal | Strong friction from amount rule only |',
  );
  out('| --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    const c = r.confusion;
    out(
      `| ${r.setting} | ${fmtRate(c.blocked.tp, r.attacks)} | ${fmtRate(c.strong.tp, r.attacks)} | ${fmtRate(c.flagged.tp, r.attacks)} | ${fmtRate(r.attacksBySignal, r.attacks)} | ${r.attacksStrongFromAmountOnly} |`,
    );
  }

  out('\n### Legitimate sends by friction\n');
  out('| Rule | ALLOW | Checkbox WARN | Middle-char WARN | BLOCK |');
  out('| --- | --- | --- | --- | --- |');
  for (const r of results) {
    const l = r.legitByOutcome;
    out(
      `| ${r.setting} | ${l.ALLOW} | ${fmtRate(l.WARN_CHECKBOX, r.legit)} | ${fmtRate(l.WARN_STRONG, r.legit)} | ${fmtRate(l.BLOCK, r.legit)} |`,
    );
  }

  out('\n### Confusion matrix per level\n');
  out('| Rule | Level | TP | FN | FP | TN | Precision | Recall |');
  out('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    for (const level of LEVELS) {
      const c = r.confusion[level];
      out(
        `| ${r.setting} | ${level} | ${c.tp} | ${c.fn} | ${c.fp} | ${c.tn} | ${ratio(c.precision)} | ${ratio(c.recall)} |`,
      );
    }
  }

  out('\n### Misses (attack reached ALLOW or only a checkbox WARN)\n');
  for (const r of results) {
    const list = r.misses.map((m) => `${m.id} (${m.outcome})`).join(', ') || 'none';
    out(`- **${r.setting}**: ${list}`);
  }

  out('\n### Outcome per case\n');
  out(`| Case | ${results.map((r) => r.setting).join(' | ')} |`);
  out(`| --- | ${results.map(() => '---').join(' | ')} |`);
  for (const id of Object.keys(first.cases)) {
    out(`| ${id} | ${results.map((r) => r.cases[id]?.outcome ?? '?').join(' | ')} |`);
  }
}

const shippedName = RULE_SETTINGS.find((s) =>
  sameConfig(s.apply(DEFAULT_RISK_CONFIG), DEFAULT_RISK_CONFIG),
)?.name;
if (!shippedName)
  throw new Error('The shipped default config is not one of the evaluated settings');

const holdoutV1 = loadFrozen('holdout');
if (!holdoutV1) throw new Error('eval/holdout is missing');
const v1Results = RULE_SETTINGS.map((s) => evaluateCases(holdoutV1.cases, DEFAULT_RISK_CONFIG, s));

if (args.has('--check')) {
  const baselineFile = join(root, 'baseline.json');
  if (!existsSync(baselineFile)) {
    console.log('Regression check: no baseline committed, nothing to compare. PASS.');
    process.exit(0);
  }
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')) as BaselineEntry;
  const current = v1Results.find((r) => r.setting === shippedName);
  if (!current) throw new Error('shipped setting missing');
  if (baseline.setting !== shippedName) {
    console.error(
      `Baseline is for ${baseline.setting} but the shipped default is ${shippedName}. Re-record the baseline deliberately.`,
    );
    process.exit(1);
  }
  const problems = regressions(toBaseline(current), baseline);
  if (problems.length > 0) {
    console.error(`Holdout v1 regression vs eval/baseline.json (${shippedName}, synthetic):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Regression check (holdout v1, ${shippedName}, synthetic): no regressions. PASS.`);
  process.exit(0);
}

out('# SafeSend evaluation. SYNTHETIC: rule behavior on hand-written cases, not fraud prevented.');
out(
  `\nShipped default: ${shippedName}. Differences of one or two cases are not meaningful at this sample size.`,
);
report('Holdout v1', v1Results);

const holdoutV2 = loadFrozen('holdout-v2');
if (holdoutV2) {
  report(
    'Holdout v2',
    RULE_SETTINGS.map((s) => evaluateCases(holdoutV2.cases, DEFAULT_RISK_CONFIG, s)),
  );
  for (const author of [...new Set(holdoutV2.cases.map((c) => c.author ?? 'unknown'))]) {
    const subset = holdoutV2.cases.filter((c) => (c.author ?? 'unknown') === author);
    report(
      `Holdout v2, cases by ${author}`,
      RULE_SETTINGS.map((s) => evaluateCases(subset, DEFAULT_RISK_CONFIG, s)),
    );
  }
}

const dev = loadDev();
if (dev)
  report(
    'Dev set',
    RULE_SETTINGS.map((s) => evaluateCases(dev.cases, DEFAULT_RISK_CONFIG, s)),
  );

mkdirSync(join(root, 'results'), { recursive: true });
writeFileSync(join(root, 'results', 'latest.json'), `${JSON.stringify(v1Results, null, 2)}\n`);

const reportIdx = argv.indexOf('--report');
const reportPath = reportIdx >= 0 ? argv[reportIdx + 1] : undefined;
if (reportPath) writeFileSync(reportPath, `${lines.join('\n')}\n`);

if (args.has('--write-baseline')) {
  const current = v1Results.find((r) => r.setting === shippedName);
  if (!current) throw new Error('shipped setting missing');
  writeFileSync(join(root, 'baseline.json'), `${JSON.stringify(toBaseline(current), null, 2)}\n`);
  console.log(`\nWrote eval/baseline.json for ${shippedName}.`);
}
