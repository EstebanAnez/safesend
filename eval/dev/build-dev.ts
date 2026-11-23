/**
 * DEV set generator: seeded, synthetic cases used while building and
 * debugging. Separate from the frozen holdout; tuning may look at these.
 * Labels come from construction intent: lookalikes delivered by an attacker
 * are attacks; real people (including coincidental overlaps) are legit.
 *
 * Usage: npx tsx eval/dev/build-dev.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keccak256, toHex } from 'viem';

type Hex40 = `0x${string}`;
const HEX = '0123456789abcdef';

function prng(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(20261123);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
const addr = (label: string): Hex40 => `0x${keccak256(toHex(`dev:${label}`)).slice(2, 42)}`;

function withMatch(base: Hex40, p: number, s: number, label: string): Hex40 {
  const b = base.slice(2);
  const fill = addr(`fill:${label}`).slice(2);
  const out = Array.from(b, (ch, i) => (i < p || i >= 40 - s ? ch : (fill[i] ?? '0')));
  for (const i of [p, 39 - s]) {
    if (i >= 0 && i < 40 && out[i] === b[i])
      out[i] = HEX[(HEX.indexOf(b[i] ?? '0') + 1) % 16] ?? '0';
  }
  return `0x${out.join('')}`;
}

const user = addr('user');
const sister = addr('sister');
const landlord = addr('landlord');
const attacker = addr('attacker');
const fake = addr('fake-token');
const son = addr('son'); // only ever sends TO the user

const base = [
  { block: 100, from: user, to: sister, amount: '40', signer: user },
  { block: 200, from: user, to: landlord, amount: '250', signer: user },
  { block: 300, from: user, to: sister, amount: '45', signer: user },
  { block: 400, from: user, to: landlord, amount: '250', signer: user },
  { block: 500, from: user, to: sister, amount: '50', signer: user },
  { block: 150, from: son, to: user, amount: '300', signer: son },
  { block: 450, from: son, to: user, amount: '300', signer: son },
];
const contacts = [{ name: 'Sister', address: sister }];

const cases: unknown[] = [];

for (let i = 0; i < 40; i += 1) {
  const target = pick([sister, landlord, son]);
  const p = 2 + Math.floor(rand() * 5);
  const s = 2 + Math.floor(rand() * 5);
  const look = withMatch(target, p, s, `atk-${i}`);
  const technique = pick(['dust', 'zero-value', 'counterfeit', 'pasted'] as const);
  const planting =
    technique === 'dust'
      ? [{ block: 501, from: look, to: user, amount: '0.001', signer: look }]
      : technique === 'zero-value'
        ? [{ block: 501, from: user, to: look, amount: '0', signer: attacker }]
        : technique === 'counterfeit'
          ? [
              {
                block: 501,
                token: { contract: fake, symbol: 'USDC' },
                from: look,
                to: user,
                amount: '50',
                signer: attacker,
              },
            ]
          : [];
  cases.push({
    id: `D-A${String(i + 1).padStart(2, '0')}`,
    label: 'attack',
    category: technique,
    title: `${technique} lookalike ${p}/${s} of ${target === sister ? 'contact' : target === son ? 'inbound-only sender' : 'past recipient'}`,
    rationale: 'Generated dev case.',
    sources: [],
    user,
    contacts,
    history: [...base, ...planting],
    testSends: [],
    historyAvailable: true,
    send: {
      recipient: look,
      amount: pick(['10', '50', '300']),
      pickedFrom: technique === 'pasted' ? 'pasted' : 'history',
    },
  });
}

for (let i = 0; i < 40; i += 1) {
  const kind = pick(['contact', 'past-recipient', 'new', 'benign-overlap', 'son'] as const);
  const p = Math.floor(rand() * 5);
  const s = Math.floor(rand() * 5);
  const recipient =
    kind === 'contact'
      ? sister
      : kind === 'past-recipient'
        ? landlord
        : kind === 'son'
          ? son
          : kind === 'new'
            ? addr(`new-${i}`)
            : withMatch(pick([sister, landlord, son]), p, s, `benign-${i}`);
  cases.push({
    id: `D-L${String(i + 1).padStart(2, '0')}`,
    label: 'legit',
    category: kind,
    title: kind === 'benign-overlap' ? `benign overlap ${p}/${s}` : kind,
    rationale: 'Generated dev case.',
    sources: [],
    user,
    contacts,
    history: base,
    testSends: [],
    historyAvailable: true,
    send: { recipient, amount: pick(['10', '50', '250']), pickedFrom: 'pasted' },
  });
}

const out = {
  schemaVersion: 1,
  description:
    'SafeSend DEV set (generated, synthetic). Used while building; may be used for tuning.',
  cases,
};
writeFileSync(join(import.meta.dirname, 'cases.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${cases.length} dev cases`);
