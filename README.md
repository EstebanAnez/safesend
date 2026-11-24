# SafeSend

SafeSend helps people detect lookalike recipients before they send USDC, by tracking where every
address in their history came from and making a clear decision at send time.

> **Testnet prototype.** Base Sepolia only. No real money. The demo runs on synthetic data, and
> every send in it is simulated: nothing is signed or broadcast.

**Live demo:** [safesend-one.vercel.app](https://safesend-one.vercel.app) (start at
[/demo](https://safesend-one.vercel.app/demo)). Or run it locally in two commands (below).

![Dust poisoning: the planted entry is hidden, sending to it is blocked with a character comparison, and one click recovers to the real contact](docs/screenshots/demo.gif)

## The problem

**Address poisoning** exploits a habit: people copy a recipient from their own wallet history and
check only the first and last few characters. An attacker generates an address whose ends match
someone you pay, then plants it in your history:

- a **dust** transfer (0.001 USDC from the lookalike),
- a **zero-value** transfer that makes it look as if _you_ paid the lookalike,
- or a **counterfeit token** that only claims to be USDC.

Next time you copy "your sister" from history, you copy the attacker. Attackers also skip
history entirely and send a "my address changed" message with a lookalike.

**Scale:**

- Researchers at Carnegie Mellon measured about **270 million** poisoning attempts targeting **17
  million** victims, with at least **$83.8 million** lost (Tsuchiya et al., "Blockchain Address
  Poisoning", [arXiv 2501.16681](https://arxiv.org/abs/2501.16681)).
- Scam Sniffer reported **$50 million** lost in December 2025 and **$12.25 million** in January
  2026 by people who copied an address from their history
  ([via Cointelegraph, February 2026](https://cointelegraph.com/news/over-62m-lost-address-poisoning-since-december-scam-sniffer)).

## Why I built this

I'm Esteban Anez, from Santa Cruz, Bolivia, and an MBA/MSBA student at the University of Kansas.
During Bolivia's dollar shortage, people are moving their savings into dollar stablecoins. Many are
new to crypto and send money to family every month, which makes them prime targets for a scam
that exploits copying an address from history. SafeSend is my attempt at the send screen I'd want
my own family to use. [linkedin.com/in/esteban-anez](https://www.linkedin.com/in/esteban-anez)

## How it relates to what exists

Coinbase already offers an address book and address allowlisting. Those help when people use
them. SafeSend's contribution is for the moment they don't:

- **Provenance for every history entry:** how each address got there (a payment you signed, a
  verified inbound payment, or dust, zero-value and counterfeit planting).
- **An explainable decision at send time:** ALLOW, WARN or BLOCK, with the reason and a
  character comparison readable in two seconds.
- **Recovery UX:** a blocked send is one click away from the real contact, with no override.

## What SafeSend does

1. **Tracks provenance.** Every address in history is labeled by how it got there: a transfer the
   user signed (including through a Coinbase Smart Wallet, D5), a verified inbound payment, or a
   planting technique.
2. **Separates trust from protection** (D14). Only contacts, signer-confirmed past recipients and
   SafeSend-recorded test sends can be sent to without friction. A wider set (including people who
   have paid you) is _protected_: lookalikes of it are caught.
3. **Decides at send time,** with one of three outcomes:

| Decision  | When                                                                                                                                      | What the user does                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **ALLOW** | An exact trusted address, no other signal                                                                                                 | Sends                                                                                   |
| **WARN**  | A new recipient or an unusual amount                                                                                                      | Confirms in proportion: a checkbox for small first sends, otherwise 4 middle characters |
| **BLOCK** | Any lookalike of someone you know or have been paid by, planted or not (D23), or a structural error (wrong network, token contract, self) | Can't send. One click to the real contact instead. **No override anywhere**             |

The middle-character confirmation never uses the first or last characters, because those are
exactly what a lookalike is built to match (D8). If a lookalike really is a different person, the
only path is to add them as a contact: the full address entered twice and confirmed by phone
(D16). The blocked send never resumes.

## Try the scenarios

`/demo` lists eight scenarios from the point of view of Daniela, who lives in Santa Cruz,
Bolivia, receives USDC from her son in Kansas and sends some to her sister.

| Scenario                    | What happens                                                             |
| --------------------------- | ------------------------------------------------------------------------ |
| Clean wallet                | Paying her sister as usual: no friction                                  |
| Dust poisoning              | A tiny transfer plants a fake "Lucía" next to her real payment: BLOCK    |
| Zero-value poisoning        | A fake "you sent 0 USDC to your landlord" entry appears: BLOCK           |
| Counterfeit USDC            | A fake token called "USDC" arrives from a lookalike of Lucía: BLOCK      |
| "My address changed"        | A message with Lucía's "new wallet", nothing planted in history: BLOCK   |
| New recipient, large amount | A first payment of 200 USDC: middle-character WARN and a test-send nudge |
| Unusual amount              | 400 USDC to her sister, who usually gets 40 to 50: WARN                  |
| Pasanaku (savings group)    | A new group member every month, without warning fatigue (group contacts) |

Each scenario page also has a demo control to simulate a slow, failing or empty history source.

## How well does it work?

**All numbers are synthetic.** They describe how the rules behave on hand-written cases, not fraud
prevented or money saved. Details, every case and every caveat: [docs/EVAL.md](docs/EVAL.md).

Current policy (every lookalike is a BLOCK, D23), **post-hoc** on both holdouts:

| Holdout                                   | Attacks blocked             | Legitimate sends blocked | Legit middle-character WARN |
| ----------------------------------------- | --------------------------- | ------------------------ | --------------------------- |
| v1 (20 attacks, 20 legitimate)            | 20 of 20 (100%, CI 84–100%) | 6 of 20                  | 3 of 20                     |
| v2 (15 + 15; 10 cases written by Esteban) | 14 of 15 (93%, CI 70–99%)   | 1 of 15                  | 3 of 15                     |

- **Post-hoc means optimistic.** Both holdouts had been seen before this policy and the shipped
  lookalike rule were chosen. **A clean claim needs a new holdout (v3)**, written and frozen
  before it runs.
- **The cost is visible on purpose.** The legitimate BLOCKs are deliberate coincidental overlaps
  (for example, a cousin whose address happens to share 3 + 4 characters with Lucía's). The
  holdouts over-sample them to probe the boundary; the base-rate math puts them at about 1 in
  290,000 first sends for someone with 20 protected addresses
  ([RISK_MODEL.md](docs/RISK_MODEL.md)).
- **At this sample size, differences of one or two cases are not meaningful.**
- **Known gap:** with history unavailable, past recipients can't be compared against (V2-C10). The
  "my address changed" gap (V2-C05) was closed by D23.

## Quality

- **Accessibility:** the full journey is tested with the keyboard alone (e2e). Focus moves to each
  new panel, decisions are announced to screen readers with their reasons, motion follows
  `prefers-reduced-motion`, and axe runs in light and dark mode on desktop and phone widths (D19).
  Color is never the only signal: the address comparison uses shape too (D17).
- **Architecture rules are lint-enforced** (D6): the risk engine in `src/risk/` is pure (no React,
  no network), components never touch the network, and there is no `any`.
- **Tests:** 196 unit and component tests (Vitest, rendering real CDS), 62 e2e tests (Playwright
  with axe, desktop and Pixel 7), and an eval regression check in CI.
- **Performance:** see D20 for Lighthouse results and what is still open (Total Blocking Time).

## Run it

Requires Node 22+.

```sh
npm ci
npm run dev          # http://localhost:3000, then open /demo
```

| Script                              | What it does                                                    |
| ----------------------------------- | --------------------------------------------------------------- |
| `npm run ci`                        | Format check, lint, typecheck, unit tests, eval regression      |
| `npm run build && npm run test:e2e` | Playwright e2e plus axe, desktop and phone                      |
| `npm run eval`                      | Evaluate the rules on the holdouts (refuses a modified holdout) |

## Built with

Next.js 15 (App Router), React 19, TypeScript (strict), the
[Coinbase Design System](https://github.com/coinbase/cds) (`@coinbase/cds-web`), viem and wagmi
on Base Sepolia (chain 84532, canonical USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`).

## Project layout

```
src/
  app/                 Routes, providers (CDS theme, reduced motion)
  components/          UI built from CDS. No network access (lint-enforced)
  hooks/               The only bridge from UI to providers and wallet
  risk/                Pure decision engine: parsing, comparison, policy, re-verification
  domain/              Shared types: HistoryEntry, Contact, TrustAnchor
  providers/history/   HistoryProvider interface and the fixture provider
  config/              Chain id and canonical USDC (single source of truth)
  fixtures/            Deterministic demo scenarios
eval/                  Frozen holdouts, dev set, reports, CI baseline
e2e/                   Playwright and axe
docs/                  PRD, RISK_MODEL, EVAL, DECISIONS
```

## How this was built

AI coding tools wrote much of the code, under my direction. I set the product and policy
decisions (including the BLOCK policy, group contacts and what counts as trust), wrote
independent holdout cases for the evaluation, and reviewed every slice before it was merged. The
reasoning behind each decision is in [docs/DECISIONS.md](docs/DECISIONS.md).

## Read more

- [docs/PRD.md](docs/PRD.md): who it is for, requirements, non-goals, metrics.
- [docs/RISK_MODEL.md](docs/RISK_MODEL.md): the policy and the base-rate math behind the
  lookalike rule.
- [docs/EVAL.md](docs/EVAL.md): datasets, method, results and limitations.
- [docs/DECISIONS.md](docs/DECISIONS.md): every decision and why.

## Status

Done: the risk engine, evaluation, eight demo scenarios, accessibility and quality. Next: live
mode on Base Sepolia (Coinbase Smart Wallet, Blockscout history with honest coverage labels).
