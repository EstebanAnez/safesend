/**
 * Holdout v2 builder. Reads the human-friendly authoring files in this folder
 * (*.cases.json), resolves names to addresses, validates every case, and
 * writes the FROZEN cases.json + cases.sha256. See README.md for the format.
 *
 * Imports nothing from src/risk: cases describe the world, not the engine.
 *
 *   npx tsx eval/holdout-v2/build.ts            validate only (prints a summary)
 *   npx tsx eval/holdout-v2/build.ts --freeze   write cases.json + cases.sha256
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAddress, keccak256, toHex } from 'viem';

type Hex40 = `0x${string}`;
const HEX = '0123456789abcdef';
const dir = import.meta.dirname;

const addr = (label: string): Hex40 => `0x${keccak256(toHex(`holdout-v2:${label}`)).slice(2, 42)}`;

/** The shared cast. Authors refer to people by these names. */
export const CAST = [
  'me',
  'lucia',
  'mateo',
  'landlord',
  'cousin',
  'friend',
  'merchant',
  'employer',
  'exchange',
  'attacker',
  'vendor',
  'rosa',
  'mateo2',
] as const;

function withMatch(base: Hex40, p: number, s: number, tag: string): Hex40 {
  const b = base.slice(2);
  const fill = addr(`fill:${tag}`).slice(2);
  const out = Array.from(b, (ch, i) => (i < p || i >= 40 - s ? ch : (fill[i] ?? '0')));
  for (const i of [p, 39 - s]) {
    if (i >= 0 && i < 40 && out[i] === b[i])
      out[i] = HEX[(HEX.indexOf(b[i] ?? '0') + 1) % 16] ?? '0';
  }
  return `0x${out.join('')}`;
}

/**
 * Address reference grammar:
 *   "<cast name>"                          e.g. "lucia"
 *   "lookalike:<name>:<prefix>:<suffix>:<tag>"  same first/last chars as <name>; <tag> makes it unique
 *   "random:<tag>"                         an unrelated address
 *   "0x..."                                a literal address
 */
export function resolve(ref: string, where: string): Hex40 {
  if (/^0x[0-9a-fA-F]{40}$/.test(ref)) return ref.toLowerCase() as Hex40;
  if ((CAST as readonly string[]).includes(ref)) return addr(`cast:${ref}`);
  const random = /^random:(\S+)$/.exec(ref);
  if (random) return addr(`random:${random[1]}`);
  const look = /^lookalike:([a-z]+):(\d+):(\d+):(\S+)$/.exec(ref);
  if (look) {
    const [, name = '', p = '0', s = '0', tag = ''] = look;
    return withMatch(resolve(name, where), Number(p), Number(s), `${name}:${tag}`);
  }
  throw new Error(`${where}: cannot resolve address "${ref}"`);
}

interface AuthorTransfer {
  block: number;
  from: string;
  to: string;
  amount: string;
  signer: string | null;
  token?: 'USDC' | { fake: string };
  provenance?: 'verified' | 'inferred' | 'unknown';
}

interface AuthorCase {
  id: string;
  label: 'attack' | 'legit';
  title: string;
  rationale: string;
  sources?: string[];
  contacts?: string[];
  baseHistory?: boolean;
  history?: AuthorTransfer[];
  testSends?: { to: string; block: number; amount: string }[];
  historyAvailable?: boolean;
  send: { to: string; amount: string; pickedFrom: 'history' | 'pasted' | 'contacts' };
}

/** Optional shared background: Daniela's ordinary month-to-month life. */
const BASE_HISTORY: AuthorTransfer[] = [
  { block: 1000, from: 'mateo', to: 'me', amount: '400', signer: 'mateo' },
  { block: 1100, from: 'me', to: 'lucia', amount: '40', signer: 'me' },
  { block: 1200, from: 'me', to: 'landlord', amount: '250', signer: 'me' },
  { block: 2000, from: 'mateo', to: 'me', amount: '400', signer: 'mateo' },
  { block: 2100, from: 'me', to: 'lucia', amount: '45', signer: 'me' },
  { block: 2200, from: 'me', to: 'landlord', amount: '250', signer: 'me' },
  { block: 3000, from: 'mateo', to: 'me', amount: '400', signer: 'mateo' },
  { block: 3100, from: 'me', to: 'lucia', amount: '40', signer: 'me' },
  { block: 3200, from: 'me', to: 'landlord', amount: '250', signer: 'me' },
];

function build(c: AuthorCase, author: string) {
  const where = `${author}/${c.id}`;
  for (const k of ['id', 'label', 'title', 'rationale', 'send'] as const) {
    if (c[k] === undefined) throw new Error(`${where}: missing "${k}"`);
  }
  if (c.label !== 'attack' && c.label !== 'legit')
    throw new Error(`${where}: label must be attack or legit`);
  if (!/^\d+(\.\d+)?$/.test(c.send.amount))
    throw new Error(`${where}: send.amount must be a decimal string`);
  const history = [...(c.baseHistory ? BASE_HISTORY : []), ...(c.history ?? [])].map((h, i) => ({
    block: h.block,
    from: resolve(h.from, `${where}.history[${i}].from`),
    to: resolve(h.to, `${where}.history[${i}].to`),
    amount: h.amount,
    signer: h.signer === null ? null : resolve(h.signer, `${where}.history[${i}].signer`),
    ...(h.token && h.token !== 'USDC'
      ? { token: { contract: addr(`fake-token:${h.token.fake}`), symbol: h.token.fake } }
      : {}),
    ...(h.provenance ? { provenance: h.provenance } : {}),
  }));
  return {
    id: c.id,
    label: c.label,
    category: `v2-${author}`,
    title: c.title,
    rationale: c.rationale,
    sources: c.sources ?? [],
    author,
    user: resolve('me', where),
    contacts: (c.contacts ?? []).map((name) => ({
      name,
      address: resolve(name, `${where}.contacts`),
    })),
    history,
    testSends: (c.testSends ?? []).map((t) => ({
      recipient: resolve(t.to, `${where}.testSends`),
      block: t.block,
      amount: t.amount,
    })),
    historyAvailable: c.historyAvailable ?? true,
    send: {
      // Lowercase unless the author gave a literal mixed-case address.
      recipient: /^0x/.test(c.send.to)
        ? c.send.to
        : getAddress(resolve(c.send.to, `${where}.send`)).toLowerCase(),
      amount: c.send.amount,
      pickedFrom: c.send.pickedFrom,
    },
  };
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.cases.json'))
  .sort();
const cases = files.flatMap((f) => {
  const author = f.replace('.cases.json', '');
  const parsed = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { cases: AuthorCase[] };
  return parsed.cases.map((c) => build(c, author));
});
const ids = new Set<string>();
for (const c of cases) {
  if (ids.has(c.id)) throw new Error(`duplicate case id ${c.id}`);
  ids.add(c.id);
}

const counts = cases.reduce<Record<string, number>>((m, c) => {
  const k = `${c.author}:${c.label}`;
  m[k] = (m[k] ?? 0) + 1;
  return m;
}, {});
console.log(`${cases.length} cases from ${files.join(', ')}`, counts);

if (process.argv.includes('--freeze')) {
  if (existsSync(join(dir, 'cases.sha256')))
    throw new Error('holdout v2 is already frozen; do not re-freeze');
  const out = {
    schemaVersion: 1,
    description:
      'SafeSend HOLDOUT v2. Synthetic, hand-labeled. Frozen before any evaluation run; never used for tuning (docs/EVAL.md).',
    cases,
  };
  const json = `${JSON.stringify(out, null, 2)}\n`;
  writeFileSync(join(dir, 'cases.json'), json);
  const sha = createHash('sha256').update(json).digest('hex');
  writeFileSync(join(dir, 'cases.sha256'), `${sha}\n`);
  console.log(
    `FROZEN: sha256 ${sha}. Commit cases.json and cases.sha256 now, before running npm run eval.`,
  );
}
