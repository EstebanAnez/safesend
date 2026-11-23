# SafeSend

SafeSend helps people detect lookalike recipients before they send USDC, by tracking where every
address in their history came from and making a clear decision at send time.

> Prototype on **Base Sepolia testnet** only. No real money. Work in progress: this README is
> completed in slice S7. Sources, evaluation results and limitations go there.

## Run it

Requires Node 22+.

```sh
npm ci
npm run dev          # http://localhost:3000
```

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm test`          | Unit and component tests (Vitest, RTL)            |
| `npm run test:e2e`  | Playwright e2e plus axe checks, desktop and phone |
| `npm run lint`      | ESLint, including architecture rules              |
| `npm run typecheck` | `tsc --noEmit` (strict)                           |
| `npm run eval`      | Detector evaluation on synthetic cases (S3)       |

## Project layout

```
src/
  app/                 Next.js App Router routes, providers (CDS theme)
  components/          UI built from CDS. No network access (lint-enforced)
  hooks/               The only bridge from UI to providers and wallet
  risk/                Pure decision engine: address parsing, lookalike
                       comparison, policy. No React, no I/O (lint-enforced)
  domain/              Shared types: HistoryEntry, Contact, TrustAnchor
  providers/history/   HistoryProvider interface + fixture/explorer/rpc
  config/              Chain id, canonical USDC (single source of truth)
  fixtures/            Deterministic demo scenarios
eval/
  holdout/             Hand-labeled cases, written before tuning, never tuned on
  dev/                 Cases used while building
scripts/eval.ts        `npm run eval`
e2e/                   Playwright + axe
docs/                  DECISIONS, RISK_MODEL, EVAL, PRD
```

Decisions and their reasons: [docs/DECISIONS.md](docs/DECISIONS.md).
