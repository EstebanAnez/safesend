/**
 * npm run eval            Evaluate holdout + dev at every threshold setting.
 * npm run eval:check      CI regression check: the shipped setting on the holdout
 *                         must not be worse than eval/baseline.json.
 * npm run eval -- --write-baseline   Record the current holdout result as the baseline.
 *
 * Every number is SYNTHETIC (hand-written scenarios), never fraud prevented.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RISK_CONFIG } from '../src/risk/config';
import { evaluateCases, LEVELS, regressions, THRESHOLD_SETTINGS, toBaseline } from './eval-lib';
import type { BaselineEntry, CaseFile, SettingResult } from './eval-lib';

const root = join(import.meta.dirname, '..', 'eval');
const args = new Set(process.argv.slice(2));

function loadHoldout(): CaseFile {
  const raw = readFileSync(join(root, 'holdout', 'cases.json'), 'utf8');
  const expected = readFileSync(join(root, 'holdout', 'cases.sha256'), 'utf8').trim();
  const actual = createHash('sha256').update(raw).digest('hex');
  if (actual !== expected) {
    console.error(
      `Holdout file changed after freeze (sha256 ${actual} != ${expected}). Refusing to run.`,
    );
    process.exit(2);
  }
  return JSON.parse(raw) as CaseFile;
}

function loadDev(): CaseFile | null {
  const file = join(root, 'dev', 'cases.json');
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as CaseFile) : null;
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`);
const ratio = (x: number | null) => (x === null ? 'n/a' : x.toFixed(2));

function report(title: string, results: SettingResult[]) {
  console.log(`\n## ${title} (SYNTHETIC)\n`);
  const first = results[0];
  if (!first) return;
  console.log(`${first.attacks} attack cases, ${first.legit} legitimate sends.\n`);

  console.log('### Attacks caught (raw counts)\n');
  console.log(
    '| Setting | Blocked | Strong friction (BLOCK or middle-char WARN) | Flagged at all (any WARN) |',
  );
  console.log('| --- | --- | --- | --- |');
  for (const r of results) {
    const c = r.confusion;
    console.log(
      `| ${r.setting} | ${c.blocked.tp}/${r.attacks} | ${c.strong.tp}/${r.attacks} | ${c.flagged.tp}/${r.attacks} |`,
    );
  }

  console.log('\n### Legitimate sends by friction (raw counts)\n');
  console.log(
    '| Setting | ALLOW | Checkbox WARN | Middle-char WARN | BLOCK | False-warning rate (checkbox / middle-char / block) |',
  );
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    const l = r.legitByOutcome;
    console.log(
      `| ${r.setting} | ${l.ALLOW} | ${l.WARN_CHECKBOX} | ${l.WARN_STRONG} | ${l.BLOCK} | ${pct(l.WARN_CHECKBOX, r.legit)} / ${pct(l.WARN_STRONG, r.legit)} / ${pct(l.BLOCK, r.legit)} |`,
    );
  }

  console.log('\n### Precision and recall per level\n');
  console.log('| Setting | Level | TP | FN | FP | TN | Precision | Recall |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    for (const level of LEVELS) {
      const c = r.confusion[level];
      console.log(
        `| ${r.setting} | ${level} | ${c.tp} | ${c.fn} | ${c.fp} | ${c.tn} | ${ratio(c.precision)} | ${ratio(c.recall)} |`,
      );
    }
  }

  console.log('\n### Misses (attack reached ALLOW or only a checkbox WARN)\n');
  for (const r of results) {
    const list = r.misses.map((m) => `${m.id} (${m.outcome})`).join(', ') || 'none';
    console.log(`- **${r.setting}**: ${list}`);
  }
}

const holdout = loadHoldout();
const shipped = `${DEFAULT_RISK_CONFIG.prefixMatchLength}/${DEFAULT_RISK_CONFIG.suffixMatchLength}`;
const holdoutResults = THRESHOLD_SETTINGS.map((s) =>
  evaluateCases(holdout.cases, DEFAULT_RISK_CONFIG, s),
);

if (args.has('--check')) {
  const baselineFile = join(root, 'baseline.json');
  if (!existsSync(baselineFile)) {
    console.log('Regression check: no baseline committed, nothing to compare. PASS.');
    process.exit(0);
  }
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8')) as BaselineEntry;
  const current = holdoutResults.find((r) => r.setting === shipped);
  if (!current) throw new Error(`Shipped setting ${shipped} is not among evaluated settings`);
  if (baseline.setting !== shipped) {
    console.error(
      `Baseline is for ${baseline.setting} but the shipped default is ${shipped}. Re-record the baseline deliberately.`,
    );
    process.exit(1);
  }
  const problems = regressions(toBaseline(current), baseline);
  if (problems.length > 0) {
    console.error(`Holdout regression vs eval/baseline.json (setting ${shipped}, synthetic):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(
    `Regression check (holdout, ${shipped}, synthetic): no regressions vs baseline. PASS.`,
  );
  process.exit(0);
}

console.log(
  '# SafeSend evaluation. SYNTHETIC data: rule behavior on hand-written cases, not fraud prevented.',
);
console.log(`Shipped default: ${shipped}`);
report('Holdout', holdoutResults);

const dev = loadDev();
if (dev)
  report(
    'Dev set',
    THRESHOLD_SETTINGS.map((s) => evaluateCases(dev.cases, DEFAULT_RISK_CONFIG, s)),
  );

mkdirSync(join(root, 'results'), { recursive: true });
writeFileSync(join(root, 'results', 'latest.json'), `${JSON.stringify(holdoutResults, null, 2)}\n`);

if (args.has('--write-baseline')) {
  const current = holdoutResults.find((r) => r.setting === shipped);
  if (!current) throw new Error('shipped setting missing');
  writeFileSync(join(root, 'baseline.json'), `${JSON.stringify(toBaseline(current), null, 2)}\n`);
  console.log(`\nWrote eval/baseline.json for ${shipped}.`);
}
