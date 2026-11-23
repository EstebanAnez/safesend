/**
 * Authoring script for the HOLDOUT set. Run once to produce cases.json, which
 * is then frozen (see docs/EVAL.md). It deliberately imports nothing from
 * src/risk: cases describe the world (who sent what, when), written from the
 * threat descriptions below, never from the engine's rules. Labels and
 * rationales are hand-written per case.
 *
 * Sources:
 * - [CMU] Tsuchiya et al., "Blockchain Address Poisoning", arXiv 2501.16681
 *   (USENIX Security). Tiny transfers, zero-value transfers, counterfeit
 *   tokens; lookalikes match leading/trailing characters; attacks land
 *   shortly after the victim's real transfer.
 * - [SS] Scam Sniffer reporting via Cointelegraph (Feb 2026): victims copied
 *   the wrong address from transaction history.
 *
 * Usage: npx tsx eval/holdout/build-holdout.ts
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAddress, keccak256, toHex } from 'viem';

type Hex40 = `0x${string}`;
const USDC = '0x036cbd53842c5426634e7929541ec2318f3dcf7e';
const HEX = '0123456789abcdef';

/** Deterministic pseudo-random 40-hex address from a label. */
const addr = (label: string): Hex40 => `0x${keccak256(toHex(`holdout:${label}`)).slice(2, 42)}`;

/**
 * An address sharing EXACTLY `p` leading and `s` trailing hex chars with `base`
 * (the next char inward on each side is forced to differ), with a
 * pseudo-random middle. This mirrors how vanity generators produce lookalikes.
 */
function withMatch(base: Hex40, p: number, s: number, label: string): Hex40 {
  const b = base.slice(2);
  const fill = addr(`fill:${label}`).slice(2);
  const out = Array.from(b, (ch, i) => (i < p || i >= 40 - s ? ch : (fill[i] ?? '0')));
  const bump = (i: number) => {
    if (i < 0 || i >= 40) return;
    if (out[i] === b[i]) out[i] = HEX[(HEX.indexOf(b[i] ?? '0') + 1) % 16] ?? '0';
  };
  bump(p); // first char after the matching prefix must differ
  bump(39 - s); // last char before the matching suffix must differ
  return `0x${out.join('')}`;
}

// --- Actors --------------------------------------------------------------------
const A = {
  daniela: addr('daniela'),
  lucia: addr('lucia-sister'), // contact
  mateo: addr('mateo-son'), // only ever sends TO Daniela
  landlord: addr('landlord'), // paid monthly, never added as a contact
  friend: addr('new-friend'), // first-time recipient
  merchant: addr('merchant'),
  exchangeDeposit: addr('exchange-deposit'),
  attacker: addr('attacker-eoa'),
  unrelatedDuster: addr('unrelated-airdrop'),
} as const;

const FAKE_USDC = addr('counterfeit-usdc-contract');
const FAKE_USDCE = addr('counterfeit-usdce-contract');
const FAKE_CYRILLIC = addr('counterfeit-cyrillic-contract');

// --- Case schema ----------------------------------------------------------------
interface TransferSpec {
  block: number;
  logIndex?: number;
  token?: { contract: Hex40; symbol: string }; // default canonical USDC
  from: Hex40;
  to: Hex40;
  amount: string; // decimal units of the token
  signer: Hex40 | null; // who signed the tx; null = could not be determined
  provenance?: 'verified' | 'inferred' | 'unknown';
}

interface HoldoutCase {
  id: string;
  label: 'attack' | 'legit';
  category: string;
  title: string;
  rationale: string;
  sources: string[];
  user: Hex40;
  contacts: { name: string; address: Hex40 }[];
  history: TransferSpec[];
  testSends: { recipient: Hex40; block: number; amount: string }[];
  historyAvailable: boolean;
  send: { recipient: string; amount: string; pickedFrom: 'history' | 'pasted' | 'contacts' };
}

const LUCIA_CONTACT = [{ name: 'Lucía (sister)', address: A.lucia }];

/** Daniela's ordinary life: money from her son, monthly sends to her sister and landlord. */
function baseHistory(): TransferSpec[] {
  return [
    { block: 1000, from: A.mateo, to: A.daniela, amount: '500', signer: A.mateo },
    { block: 1100, from: A.daniela, to: A.lucia, amount: '50', signer: A.daniela },
    { block: 1200, from: A.daniela, to: A.landlord, amount: '300', signer: A.daniela },
    { block: 2000, from: A.mateo, to: A.daniela, amount: '500', signer: A.mateo },
    { block: 2100, from: A.daniela, to: A.lucia, amount: '50', signer: A.daniela },
    { block: 2200, from: A.daniela, to: A.landlord, amount: '300', signer: A.daniela },
    { block: 3000, from: A.mateo, to: A.daniela, amount: '500', signer: A.mateo },
    { block: 3100, from: A.daniela, to: A.lucia, amount: '60', signer: A.daniela },
    { block: 3200, from: A.daniela, to: A.landlord, amount: '300', signer: A.daniela },
  ];
}

function c(
  partial: Omit<HoldoutCase, 'user' | 'contacts' | 'history' | 'testSends' | 'historyAvailable'> &
    Partial<HoldoutCase>,
): HoldoutCase {
  return {
    user: A.daniela,
    contacts: LUCIA_CONTACT,
    history: baseHistory(),
    testSends: [],
    historyAvailable: true,
    ...partial,
  };
}

const CMU = 'CMU arXiv 2501.16681';
const SS = 'Scam Sniffer via Cointelegraph, Feb 2026';

// --- Attack cases ----------------------------------------------------------------
const L44 = withMatch(A.lucia, 4, 4, 'A01');
const L55 = withMatch(A.lucia, 5, 5, 'A02');
const L44b = withMatch(A.lucia, 4, 4, 'A03');
const L45 = withMatch(A.lucia, 4, 5, 'A04');
const L44c = withMatch(A.lucia, 4, 4, 'A05');
const LL44 = withMatch(A.landlord, 4, 4, 'A06');
const L44d = withMatch(A.lucia, 4, 4, 'A07');
const L33 = withMatch(A.lucia, 3, 3, 'A08');
const L24 = withMatch(A.lucia, 2, 4, 'A09');
const L66 = withMatch(A.lucia, 6, 6, 'A10');
const L44e = withMatch(A.lucia, 4, 4, 'A11');
const F44 = withMatch(A.friend, 4, 4, 'A12');
const F44b = withMatch(A.friend, 4, 4, 'A13');
const L44f = withMatch(A.lucia, 4, 4, 'A14');
const L44g = withMatch(A.lucia, 4, 4, 'A15');
const M44 = withMatch(A.mateo, 4, 4, 'A16');
const L44h = withMatch(A.lucia, 4, 4, 'A17');
const L34 = withMatch(A.lucia, 3, 4, 'A18');
const LL46 = withMatch(A.landlord, 4, 6, 'A19');
const L34b = withMatch(A.lucia, 3, 4, 'A20');

const attacks: HoldoutCase[] = [
  c({
    id: 'H-A01',
    label: 'attack',
    category: 'dust',
    title: 'Dust from a 4/4 lookalike of a contact, minutes after a real send',
    rationale:
      'Classic tiny-transfer poisoning: right after Daniela pays Lucía, a lookalike sends 0.001 USDC so it sits at the top of her history. She copies it next time.',
    sources: [CMU, SS],
    history: [
      ...baseHistory(),
      { block: 3101, from: L44, to: A.daniela, amount: '0.001', signer: L44 },
    ],
    send: { recipient: L44, amount: '50', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A02',
    label: 'attack',
    category: 'zero-value',
    title: 'Zero-value transfer that shows Daniela "sending" to a 5/5 lookalike',
    rationale:
      'The attacker calls transferFrom(Daniela, lookalike, 0). History shows an outgoing entry from Daniela to the lookalike, which looks like a past send. The attacker signed it.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3102, from: A.daniela, to: L55, amount: '0', signer: A.attacker },
    ],
    send: { recipient: L55, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A03',
    label: 'attack',
    category: 'counterfeit',
    title: 'Counterfeit token named exactly "USDC" from a 4/4 lookalike',
    rationale:
      'A fake token contract with symbol "USDC" transfers 50 "USDC" from the lookalike, matching the real amount so the row looks legitimate.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      {
        block: 3103,
        token: { contract: FAKE_USDC, symbol: 'USDC' },
        from: L44b,
        to: A.daniela,
        amount: '60',
        signer: A.attacker,
      },
    ],
    send: { recipient: L44b, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A04',
    label: 'attack',
    category: 'counterfeit',
    title: 'Counterfeit token with a slightly different symbol ("USDC.e")',
    rationale:
      'Counterfeit tokens do not need the exact symbol; "USDC.e" reads as a USDC variant to most users.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      {
        block: 3104,
        token: { contract: FAKE_USDCE, symbol: 'USDC.e' },
        from: L45,
        to: A.daniela,
        amount: '60',
        signer: A.attacker,
      },
    ],
    send: { recipient: L45, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A05',
    label: 'attack',
    category: 'counterfeit',
    title: 'Counterfeit token whose symbol uses a Cyrillic "С" (USDС)',
    rationale:
      'Homoglyph symbol: visually identical to USDC. Symbols are attacker-controlled and cannot be trusted.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      {
        block: 3105,
        token: { contract: FAKE_CYRILLIC, symbol: 'USDС' },
        from: L44c,
        to: A.daniela,
        amount: '60',
        signer: A.attacker,
      },
    ],
    send: { recipient: L44c, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A06',
    label: 'attack',
    category: 'confirmed-recipient-target',
    title: 'Dust lookalike of the landlord (a past recipient, not a contact)',
    rationale:
      'Attackers target whoever the victim pays, not just saved contacts. The landlord is paid monthly but was never added as a contact.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3201, from: LL44, to: A.daniela, amount: '0.001', signer: LL44 },
    ],
    send: { recipient: LL44, amount: '300', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A07',
    label: 'attack',
    category: 'pasted',
    title: '4/4 lookalike pasted from outside the wallet (not in history)',
    rationale:
      'The lookalike arrives through a chat message or clipboard rather than history. Nothing was planted on-chain, so there is no planting evidence.',
    sources: [SS],
    send: { recipient: L44d, amount: '60', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-A08',
    label: 'attack',
    category: 'under-threshold',
    title: 'Dust lookalike matching only 3 leading and 3 trailing characters',
    rationale:
      'Cheaper lookalike, still convincing when a wallet shows 0x + 4 and 4 characters to a hurried user. Small amount.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3106, from: L33, to: A.daniela, amount: '0.001', signer: L33 },
    ],
    send: { recipient: L33, amount: '20', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A09',
    label: 'attack',
    category: 'under-threshold',
    title: 'Dust lookalike matching 2 leading and 4 trailing characters',
    rationale:
      'Users often check only the end of an address. Weak prefix match, full suffix match, small amount.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3107, from: L24, to: A.daniela, amount: '0.001', signer: L24 },
    ],
    send: { recipient: L24, amount: '20', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A10',
    label: 'attack',
    category: 'zero-value',
    title: 'High-effort 6/6 vanity lookalike via zero-value transfer, large send',
    rationale:
      'Well-funded attackers generate longer matches for high-value victims (the $12M and $50M cases).',
    sources: [CMU, SS],
    history: [
      ...baseHistory(),
      { block: 3108, from: A.daniela, to: L66, amount: '0', signer: A.attacker },
    ],
    send: { recipient: L66, amount: '1000', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A11',
    label: 'attack',
    category: 'dust',
    title: 'Planting transfer of 0.50 USDC (larger than typical dust)',
    rationale: 'Some attackers send more than a few cents so the row looks like a normal payment.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3109, from: L44e, to: A.daniela, amount: '0.5', signer: L44e },
    ],
    send: { recipient: L44e, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A12',
    label: 'attack',
    category: 'after-test-send',
    title: 'Dust lookalike of a new recipient lands right after a test send',
    rationale:
      'Daniela test-sends 1 USDC to a new friend. Two blocks later a lookalike of the friend dusts her. She sends the rest by copying from history.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 4000, from: A.daniela, to: A.friend, amount: '1', signer: A.daniela },
      { block: 4002, from: F44, to: A.daniela, amount: '0.001', signer: F44 },
    ],
    testSends: [{ recipient: A.friend, block: 4000, amount: '1' }],
    send: { recipient: F44, amount: '200', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A13',
    label: 'attack',
    category: 'after-test-send',
    title: 'Lookalike mirrors the 1 USDC test amount after a test send',
    rationale:
      'Instead of dust, the attacker sends back exactly 1 USDC so the row looks like the friend returning the test.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 4000, from: A.daniela, to: A.friend, amount: '1', signer: A.daniela },
      { block: 4003, from: F44b, to: A.daniela, amount: '1', signer: F44b },
    ],
    testSends: [{ recipient: A.friend, block: 4000, amount: '1' }],
    send: { recipient: F44b, amount: '200', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A14',
    label: 'attack',
    category: 'no-history',
    title: '4/4 lookalike while history could not be loaded',
    rationale: 'Explorer and RPC are down. The user still pastes a lookalike of a contact.',
    sources: [SS],
    history: [],
    historyAvailable: false,
    send: { recipient: L44f, amount: '60', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-A15',
    label: 'attack',
    category: 'repeat-victim',
    title: 'Repeat victim: already sent to the lookalike once',
    rationale:
      'Daniela fell for a dust lookalike last month and sent 50 to it. The attacker address is now in her outgoing history as a signed send.',
    sources: [SS],
    history: [
      ...baseHistory(),
      { block: 3110, from: L44g, to: A.daniela, amount: '0.001', signer: L44g },
      { block: 3500, from: A.daniela, to: L44g, amount: '50', signer: A.daniela },
    ],
    send: { recipient: L44g, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A16',
    label: 'attack',
    category: 'inbound-only-target',
    title: 'Lookalike of her son, who only ever sends TO her',
    rationale:
      'Daniela wants to send money back to Mateo for the first time and copies his address from history, where a dusted lookalike of Mateo sits on top.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3111, from: M44, to: A.daniela, amount: '0.001', signer: M44 },
    ],
    send: { recipient: M44, amount: '20', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A17',
    label: 'attack',
    category: 'zero-value',
    title: 'Zero-value planting whose signer could not be determined',
    rationale:
      'Partial data source (log-only RPC): the zero-value entry is visible but the tx signer is unknown.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      {
        block: 3112,
        from: A.daniela,
        to: L44h,
        amount: '0',
        signer: null,
        provenance: 'inferred',
      },
    ],
    send: { recipient: L44h, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A18',
    label: 'attack',
    category: 'dust',
    title: 'One base unit (0.000001 USDC) from a 3/4 lookalike',
    rationale:
      'Smallest possible real-token transfer; matches the CMU 3-leading/4-trailing criterion.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3113, from: L34, to: A.daniela, amount: '0.000001', signer: L34 },
    ],
    send: { recipient: L34, amount: '60', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A19',
    label: 'attack',
    category: 'confirmed-recipient-target',
    title: 'Zero-value 4/6 lookalike of the landlord',
    rationale: 'Longer suffix match; zero-value technique; past recipient target.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3202, from: A.daniela, to: LL46, amount: '0', signer: A.attacker },
    ],
    send: { recipient: LL46, amount: '300', pickedFrom: 'history' },
  }),
  c({
    id: 'H-A20',
    label: 'attack',
    category: 'pasted',
    title: 'Small send to a pasted 3/4 lookalike (nothing on-chain)',
    rationale:
      'Off-chain delivery of the lookalike (messaging app impersonation) with a small amount, below the first-send threshold.',
    sources: [SS],
    send: { recipient: L34b, amount: '10', pickedFrom: 'pasted' },
  }),
];

// --- Legitimate cases ---------------------------------------------------------------
const B34 = withMatch(A.lucia, 3, 4, 'L06');
const B33 = withMatch(A.lucia, 3, 3, 'L07');
const B44 = withMatch(A.lucia, 4, 4, 'L08');
const B45 = withMatch(A.lucia, 4, 5, 'L09');
const BL34 = withMatch(A.landlord, 3, 4, 'L19');
const B34u = withMatch(A.lucia, 3, 4, 'L16');

const legit: HoldoutCase[] = [
  c({
    id: 'H-L01',
    label: 'legit',
    category: 'contact',
    title: 'Monthly send to her sister (contact)',
    rationale: 'The everyday case: must be frictionless.',
    sources: [],
    send: { recipient: A.lucia, amount: '50', pickedFrom: 'contacts' },
  }),
  c({
    id: 'H-L02',
    label: 'legit',
    category: 'contact',
    title: 'Contact address pasted in all-lowercase',
    rationale: 'Same person, different valid encoding.',
    sources: [],
    send: { recipient: A.lucia.toLowerCase(), amount: '50', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L03',
    label: 'legit',
    category: 'confirmed-recipient',
    title: 'Rent to the landlord (past recipient, not a contact)',
    rationale: 'Same address, same amount as the last three months.',
    sources: [],
    send: { recipient: A.landlord, amount: '300', pickedFrom: 'history' },
  }),
  c({
    id: 'H-L04',
    label: 'legit',
    category: 'new-recipient',
    title: 'Small first payment to a new friend',
    rationale: 'Normal life: some friction is acceptable, a block is not.',
    sources: [],
    send: { recipient: A.friend, amount: '10', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L05',
    label: 'legit',
    category: 'new-recipient',
    title: 'Large first payment to a new person',
    rationale: 'Legitimate, but exactly the shape of a scam; friction is defensible.',
    sources: [],
    send: { recipient: A.friend, amount: '200', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L06',
    label: 'legit',
    category: 'benign-boundary',
    title: 'Real person whose address shares 3 leading / 4 trailing chars with Lucía',
    rationale:
      'A cousin who paid Daniela 40 USDC (signed by the cousin) and is being paid back. Coincidental 3/4 overlap, exactly at the CMU criterion.',
    sources: [CMU],
    history: [
      ...baseHistory(),
      { block: 3300, from: B34, to: A.daniela, amount: '40', signer: B34 },
    ],
    send: { recipient: B34, amount: '40', pickedFrom: 'history' },
  }),
  c({
    id: 'H-L07',
    label: 'legit',
    category: 'benign-boundary',
    title: 'New recipient sharing 3/3 characters with Lucía',
    rationale: 'Coincidental overlap one character below the CMU suffix criterion.',
    sources: [],
    send: { recipient: B33, amount: '15', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L08',
    label: 'legit',
    category: 'benign-boundary',
    title: 'New recipient sharing 4/4 characters with Lucía',
    rationale: 'Rare coincidence, included to measure the cost at stricter thresholds.',
    sources: [],
    send: { recipient: B44, amount: '10', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L09',
    label: 'legit',
    category: 'benign-boundary',
    title: 'New recipient sharing 4/5 characters with Lucía',
    rationale: 'Very rare coincidence at the strictest evaluated threshold.',
    sources: [],
    send: { recipient: B45, amount: '10', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L10',
    label: 'legit',
    category: 'amount',
    title: 'Emergency: 400 USDC to her sister (usually 50-60)',
    rationale: 'Legitimate but anomalous amount to a trusted contact.',
    sources: [],
    send: { recipient: A.lucia, amount: '400', pickedFrom: 'contacts' },
  }),
  c({
    id: 'H-L11',
    label: 'legit',
    category: 'inbound-only',
    title: 'First send back to her son (who only sent to her before)',
    rationale: 'The real son, copied correctly. Inbound history is not proof of identity.',
    sources: [],
    send: { recipient: A.mateo, amount: '100', pickedFrom: 'history' },
  }),
  c({
    id: 'H-L12',
    label: 'legit',
    category: 'dust-like-benign',
    title: 'Exchange deposit address that sent a 0.005 USDC verification deposit',
    rationale: 'Tiny inbound transfers are not always attacks.',
    sources: [],
    history: [
      ...baseHistory(),
      {
        block: 3400,
        from: A.exchangeDeposit,
        to: A.daniela,
        amount: '0.005',
        signer: A.exchangeDeposit,
      },
    ],
    send: { recipient: A.exchangeDeposit, amount: '20', pickedFrom: 'history' },
  }),
  c({
    id: 'H-L13',
    label: 'legit',
    category: 'contact',
    title: 'Send to her sister while unrelated airdrop dust sits in history',
    rationale: 'Noise in history must not affect a trusted contact.',
    sources: [],
    history: [
      ...baseHistory(),
      {
        block: 3401,
        from: A.unrelatedDuster,
        to: A.daniela,
        amount: '0.001',
        signer: A.unrelatedDuster,
      },
    ],
    send: { recipient: A.lucia, amount: '50', pickedFrom: 'contacts' },
  }),
  c({
    id: 'H-L14',
    label: 'legit',
    category: 'after-test-send',
    title: 'Sending the rest to the same friend after a successful test send',
    rationale: 'The behavior the nudge asks for.',
    sources: [],
    history: [
      ...baseHistory(),
      { block: 4000, from: A.daniela, to: A.friend, amount: '1', signer: A.daniela },
    ],
    testSends: [{ recipient: A.friend, block: 4000, amount: '1' }],
    send: { recipient: A.friend, amount: '200', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L15',
    label: 'legit',
    category: 'no-history',
    title: 'Send to her sister while history could not be loaded',
    rationale: 'Outages must not block trusted contacts.',
    sources: [],
    history: [],
    historyAvailable: false,
    send: { recipient: A.lucia, amount: '50', pickedFrom: 'contacts' },
  }),
  c({
    id: 'H-L16',
    label: 'legit',
    category: 'benign-boundary',
    title: 'Benign 3/4 overlap with Lucía while history could not be loaded',
    rationale: 'Measures the cost of the "no history means trust the match alone" rule.',
    sources: [],
    history: [],
    historyAvailable: false,
    send: { recipient: B34u, amount: '15', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L17',
    label: 'legit',
    category: 'new-recipient',
    title: 'First payment exactly at the first-send threshold (25 USDC)',
    rationale: 'Boundary of the light confirmation.',
    sources: [],
    send: { recipient: A.merchant, amount: '25', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L18',
    label: 'legit',
    category: 'confirmed-recipient',
    title: 'Rent to the landlord pasted with EIP-55 checksum casing',
    rationale: 'Mixed-case, valid checksum.',
    sources: [],
    send: { recipient: getAddress(A.landlord), amount: '300', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L19',
    label: 'legit',
    category: 'benign-boundary',
    title: 'Merchant invoice address sharing 3/4 characters with the landlord',
    rationale: 'Coincidental overlap with a past recipient, pasted from an invoice.',
    sources: [],
    send: { recipient: BL34, amount: '12', pickedFrom: 'pasted' },
  }),
  c({
    id: 'H-L20',
    label: 'legit',
    category: 'after-test-send',
    title: 'Rest sent to the friend; an unrelated inbound transfer arrived after the test',
    rationale: 'Activity after a test send is not automatically an attack.',
    sources: [],
    history: [
      ...baseHistory(),
      { block: 4000, from: A.daniela, to: A.friend, amount: '1', signer: A.daniela },
      { block: 4001, from: A.mateo, to: A.daniela, amount: '100', signer: A.mateo },
    ],
    testSends: [{ recipient: A.friend, block: 4000, amount: '1' }],
    send: { recipient: A.friend, amount: '200', pickedFrom: 'contacts' },
  }),
];

const holdout = {
  schemaVersion: 1,
  description:
    'SafeSend HOLDOUT set. Synthetic, hand-labeled, written from threat descriptions before evaluation. Frozen: do not edit (see docs/EVAL.md). Never used for tuning.',
  canonicalUsdc: USDC,
  cases: [...attacks, ...legit],
};

const out = join(import.meta.dirname, 'cases.json');
const json = `${JSON.stringify(holdout, null, 2)}\n`;
writeFileSync(out, json);
const sha = createHash('sha256').update(json).digest('hex');
writeFileSync(join(import.meta.dirname, 'cases.sha256'), `${sha}\n`);
console.log(`wrote ${holdout.cases.length} cases, sha256 ${sha}`);
