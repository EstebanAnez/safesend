# SafeSend

SafeSend helps people detect lookalike recipients before they send USDC, by tracking where every
address in their history came from and making a clear decision at send time.

> **Testnet prototype.** Base Sepolia only. No real money. The demo runs on synthetic data, and
> every send in it is simulated: nothing is signed or broadcast.

**Live demo:** _not deployed yet._ Run it locally in two commands (below).

![Dust poisoning: the planted entry is hidden, sending to it is blocked with a character comparison, and one click recovers to the real contact](docs/screenshots/demo.gif)

## The problem

**Address poisoning** exploits a habit: people copy a recipient from their own wallet history and
check only the first and last few characters. An attacker generates an address whose ends match
someone you pay, then plants it in your history:

- a **dust** transfer (0.001 USDC from the lookalike),
- a **zero-value** transfer that makes it look as if _you_ paid the lookalike,
- or a **counterfeit token** that only claims to be USDC.

Next time you copy "your sister" from history, you copy the attacker.

## What SafeSend does

1. **Tracks provenance.** Every address in history is labeled by how it got there: a transfer the
   user signed (including through a Coinbase Smart Wallet, D5), a verified inbound payment, or a
   planting technique.
2. **Separates trust from protection** (D14). Only contacts, signer-confirmed past recipients and
   SafeSend-recorded test sends can be sent to without friction. A wider set (including people who
   have paid you) is _protected_: lookalikes of it are caught.
3. **Decides at send time,** with one of three outcomes:

| Decision  | When                                                                                                                        | What the user does                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **ALLOW** | An exact trusted address, no other signal                                                                                   | Sends                                                                                   |
| **WARN**  | A new recipient, an unusual amount, or a lookalike with no planting evidence                                                | Confirms in proportion: a checkbox for small first sends, otherwise 4 middle characters |
| **BLOCK** | A planted lookalike, any lookalike while history can't be read, or a structural error (wrong network, token contract, self) | Can't send. One click to the real contact instead. **No override anywhere**             |

The middle-character confirmation never uses the first or last characters, because those are
exactly what a lookalike is built to match (D8).

## Try the scenarios

`/demo` lists seven scenarios from the point of view of Daniela, who lives in Santa Cruz,
Bolivia, receives USDC from her son in Kansas and sends some to her sister.

| Scenario                    | What happens                                                             |
| --------------------------- | ------------------------------------------------------------------------ |
| Clean wallet                | Paying her sister as usual: no friction                                  |
| Dust poisoning              | A tiny transfer plants a fake "Lucía" next to her real payment: BLOCK    |
| Zero-value poisoning        | A fake "you sent 0 USDC to your landlord" entry appears: BLOCK           |
| Counterfeit USDC            | A fake token called "USDC" arrives from a lookalike of Lucía: BLOCK      |
| New recipient, large amount | A first payment of 200 USDC: middle-character WARN and a test-send nudge |
| Unusual amount              | 400 USDC to her sister, who usually gets 40 to 50: WARN                  |
| Pasanaku (savings group)    | A new group member every month, without warning fatigue (group contacts) |

Each scenario page also has a demo control to simulate a slow, failing or empty history source.

## How well does it work?

**All numbers are synthetic.** They describe how the rules behave on hand-written cases, not fraud
prevented or money saved. Details, every case and every caveat: [docs/EVAL.md](docs/EVAL.md).

- **Holdout v2** (30 cases, frozen before it ran; 10 written independently by Esteban): under the
  shipped rule, 13 of 15 attacks were blocked (87%, 95% CI 62–96%) and 15 of 15 got strong
  friction. No legitimate send was blocked; 4 of 15 got a middle-character WARN.
- **That result is no longer clean.** v2 informed the choice of the shipped lookalike rule, so any
  future claim about it needs a new holdout (v3), written and frozen first.
- **At this sample size, differences of one or two cases are not meaningful.**
- **Known gaps:** a pasted lookalike with no planting in history gets a WARN, not a BLOCK
  (V2-C05). With history unavailable, past recipients can't be compared against (V2-C10).

## Quality

- **Accessibility:** the full journey is tested with the keyboard alone (e2e). Focus moves to each
  new panel, decisions are announced to screen readers with their reasons, motion follows
  `prefers-reduced-motion`, and axe runs in light and dark mode on desktop and phone widths (D19).
  Color is never the only signal: the address comparison uses shape too (D17).
- **Architecture rules are lint-enforced** (D6): the risk engine in `src/risk/` is pure (no React,
  no network), components never touch the network, and there is no `any`.
- **Tests:** 179 unit and component tests (Vitest, rendering real CDS), 56 e2e tests (Playwright
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

## Read more

- [docs/PRD.md](docs/PRD.md): who it is for, requirements, non-goals, metrics.
- [docs/RISK_MODEL.md](docs/RISK_MODEL.md): the policy and the base-rate math behind the
  lookalike rule.
- [docs/EVAL.md](docs/EVAL.md): datasets, method, results and limitations.
- [docs/DECISIONS.md](docs/DECISIONS.md): every decision and why.

## Status

Done: the risk engine, evaluation, seven demo scenarios, accessibility and quality. Next: live
mode on Base Sepolia (Coinbase Smart Wallet, Blockscout history with honest coverage labels).
