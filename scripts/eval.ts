/**
 * Evaluation entry point. S0 placeholder: the holdout/dev sets and the
 * threshold comparison arrive in S3. Until then this reports that there is
 * nothing to evaluate, and --check passes because there is no baseline yet.
 * It never invents numbers.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'eval');
const countCases = (dir: string): number =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0;

const holdout = countCases(join(root, 'holdout'));
const dev = countCases(join(root, 'dev'));
const isCheck = process.argv.includes('--check');

console.log(`SafeSend eval (synthetic data). holdout files: ${holdout}, dev files: ${dev}`);
if (holdout === 0) {
  console.log('No holdout cases yet. The evaluation is implemented in slice S3.');
  if (isCheck) console.log('Regression check: no baseline committed, nothing to compare. PASS.');
}
