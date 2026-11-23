# SafeSend: handoff for Claude Code

Portfolio project by Esteban Anez for Coinbase summer 2027 internships (SWE frontend, APM, Payment
Risk). It will be reviewed by a senior frontend engineer and a fraud risk analyst. **Quality and
honesty over feature count.**

**Claim (use this wording, never overstate):** "SafeSend helps people detect lookalike recipients
before they send USDC, by tracking where every address in their history came from and making a
clear decision at send time." Never say it "stops" or "prevents" address poisoning. It is a
testnet prototype.

## Stack

- Next.js 15 (App Router), React 19, TypeScript `strict` + `noUncheckedIndexedAccess`. Bootstrapped
  from the official CDS template.
- **Coinbase Design System:** `@coinbase/cds-web`. Use CDS components and tokens, not custom CSS.
  - Never use the `caption` or `legal` fonts near addresses: they uppercase text (D9).
  - Pass Banner content as `<Text>` nodes, not strings, or CDS clamps it mid-sentence.
- wagmi + viem. Base Sepolia only, chain id **84532**. Canonical USDC
  `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals). `src/config/chain.ts` is the only
  source.
- Vitest + RTL (renders real CDS), Playwright + @axe-core (desktop + Pixel 7), ESLint, Prettier,
  GitHub Actions.
- **npm** with two scoped peer overrides (D2). Node 22 in CI (`.nvmrc`). The dev machine runs
  Windows: use LF line endings (`.gitattributes`).

Commands:

- `npm run ci`: format check, lint, typecheck, unit tests, eval regression check.
- `npm run build && npm run test:e2e`
- `npm run eval`
- On Windows, run Vitest from an uppercase `C:\` working directory. From `c:\` it loads two copies
  of its runner and every suite fails at `describe` ("reading 'config'").

## Architecture rules (lint-enforced, D6)

- **`src/risk/` is pure.** No React, Next, wagmi or fetch. It contains the policy, comparison,
  anchors, the signer rule, contact and group rules, and re-verification.
- **Components never touch the network or `src/providers/`.** Hooks in `src/hooks/` wrap providers.
- **No `any`.** Discriminated unions for async state.
- **Accessibility is required.** Labels on every input, color is never the only signal, and the
  full journey must work with the keyboard alone.

## Policy (docs/RISK_MODEL.md, docs/DECISIONS.md)

- **BLOCK has no override anywhere in the app.** It covers: an invalid address (including a bad
  mixed-case checksum), the zero address, the token contract, the user's own address, the wrong
  network, the wrong token, and a high-confidence lookalike.
  - **High-confidence lookalike:** it first appeared in history via dust, zero-value or
    counterfeit, **or** it appeared after a test send to the address it imitates, **or** history
    couldn't be read.
  - **Recovery:** "Send to X instead".
  - **"This is a different person"** opens the strict add-contact form with nothing prefilled, and
    **never resumes the blocked send** (D16).
- **WARN confirmations (D8)** never use the first or last characters.
  - `acknowledge` (a checkbox) applies only to a new recipient at or below 25 USDC with no other
    signal.
  - Every other WARN uses `middle-characters`: 4 random positions from the middle. A test-send
    nudge is shown for new recipients.
- **Trust vs. protection (D14).**
  - **The trust set is the only path to ALLOW.** It holds contacts, signer-confirmed past
    recipients, and SafeSend-recorded test-send recipients.
  - **The protected set** is the trust set plus verified, above-dust inbound senders. Lookalikes
    are compared against it.
  - An address that first appeared via planting never becomes trusted (D10).
- **Signer rule (D5):** inside an ERC-4337 bundle, a transfer is the user's only if the
  `UserOperationEvent` came from a canonical EntryPoint (v0.6 to v0.9), `success` is true, the
  Transfer falls in that op's log range, and `Transfer.from` equals the sender. Anything else is
  `unknown`.
- **Shipped lookalike rule:** **total ≥ 6 matched characters, ≥ 2 on each end** (D15).
- **Amount anomaly:** more than 5× the per-recipient median (at least 3 sends to that recipient),
  otherwise 5× the global median (at least 3 sends overall), otherwise no signal (D11).
- **Groups (D18):** "Add group" (pasanaku) adds members as ordinary contacts under the D16 rules.
  Members are checked against each other. Groups grant no extra trust.
- **Re-verify on the final values before any signature** (`src/risk/reverify.ts`).

## Evaluation rules (docs/EVAL.md)

- **Every number is synthetic.** Never call results fraud prevented or money saved. Report raw
  counts with Wilson 95% intervals, and say that differences of one or two cases aren't meaningful.
- **Holdouts are frozen before anything runs on them.** Each one has a commit, a tag and a sha256.
  `npm run eval` refuses to run if a hash changes. Never use a holdout for tuning.
  - **v1:** tag `holdout-v1-frozen`. It has been seen, so post-fix numbers are labeled post-hoc.
  - **v2:** tag `holdout-v2-frozen`. 10 cases by Esteban (independent) and 20 by Claude. It
    informed the shipped rule, so it is **no longer clean for that rule.**
  - **Any new claim about the shipped rule needs a holdout v3,** written and frozen first.
- **Dev set:** `eval/dev/`. Mutable; use it for development.
- **Regression guard:** `eval/baseline.json` records the shipped rule on v1. Re-record it only
  deliberately, in a reviewed commit, when the shipped rule changes.
- **Report three catch levels:** blocked, strong friction, and flagged. Also report attribution
  (lookalike/provenance signal vs. amount rule only), misses by case ID, and false warnings by
  friction level.

## Git, attribution and process

- **No AI attribution anywhere.** No `Co-Authored-By` trailers, no "Generated with Claude Code"
  lines, no session links in commits or PR descriptions. `.claude/settings.local.json` (gitignored)
  sets the attribution fields to empty.
- Use the configured git identity. Never change git config, rewrite history or force push.
- **One branch and one PR per slice.** Write high-quality PR descriptions (what, why, screenshots,
  tests). Squash-merge once CI is green.
  - If GitHub doesn't start CI for a new PR, close and reopen the PR.
  - When the evidence for a freeze must survive a squash, tag the freeze commit.
- **Pause and ask before:** any onchain transaction, any deployment, anything that costs money,
  changing the GitHub remote, or contacting anyone.

## Security

- Never open, read, print or log `.env*` or any secrets file. If something needs a secret, give
  Esteban the variable name.
- Never ask for, print or commit a private key or seed phrase. No secrets in `NEXT_PUBLIC_*`.
- Testnet only. Nothing points at mainnet.

## Slice status (as of 2026-11-23)

| Slice                 | Status                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 setup              | Done                                                                                                                                                                                                             |
| S1 thin demo          | Done                                                                                                                                                                                                             |
| S2 risk engine        | Done                                                                                                                                                                                                             |
| S3 evaluation         | Done (v1, v2, rule switch)                                                                                                                                                                                       |
| S4 scenarios + polish | Done (7 scenarios incl. pasanaku, contacts, groups, comparison hero)                                                                                                                                             |
| S5 a11y + quality     | Done (keyboard-only e2e, focus + live region, reduced motion, dense history, loading/empty/error states). Lighthouse perf not reliably ≥ 90 on the laptop (D20): re-measure with PageSpeed Insights after deploy |
| **Ship the demo**     | **Next.** Deploy `/demo` to Vercel (**pause for approval first**), solid README + full PRD.md, demo GIF                                                                                                          |
| S6 live mode          | wagmi + Coinbase Smart Wallet; Explorer (Blockscout v2, no key needed) and RPC providers with honest coverage labels; use `resolveTransferSigner`; real send. **Pause before the first onchain write**           |
| S7 remaining docs     | README "how AI was used" note, DECISIONS and EVAL updates                                                                                                                                                        |
| S8 (optional)         | Attack staging script on testnet. **Pause before running it**                                                                                                                                                    |

## Open decisions and known gaps

- **Remaining known gaps:**
  - A pasted lookalike with no on-chain planting gets WARN, not BLOCK (V2-C05).
  - With history unavailable, past recipients can't be compared against (V2-C10).
- **Group lifecycle:** removing rotated members, shareable groups. See PRD open questions.
- **Persistence of contacts and groups** (session-only in the demo). Decide in S6.
- **Holdout v3** for any future performance claim about the shipped rule.
