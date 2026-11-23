# Evaluation

> **All numbers here are synthetic.** They measure how SafeSend's rules behave on hand-written
> scenarios. They are not fraud prevented, money saved, or real-world detection rates.

## Holdout freeze

| Item          | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Freeze commit | `5d2547ba8a8f3bc2f1abec689239b1ed864b46cf`                         |
| File          | `eval/holdout/cases.json` (40 cases: 20 attack, 20 legitimate)     |
| sha256        | `f8714c1802da0024e8f2b1d2241e379713dba5ce09e963396f9b4a92ad5d980e` |
| Written       | 2026-11-23, before any evaluation code existed                     |

The freeze commit contains only the cases, their authoring script and the hash. `npm run eval`
refuses to run if the file's sha256 no longer matches `eval/holdout/cases.sha256`, so silent edits
fail CI. The holdout is never used to tune parameters. Tuning and debugging use `eval/dev/`.

## How the holdout was written

- **From threat descriptions, not from the engine's rules.** Sources: Tsuchiya et al., "Blockchain
  Address Poisoning" (arXiv 2501.16681), and Scam Sniffer's reporting via Cointelegraph
  (Feb 2026). The authoring script (`eval/holdout/build-holdout.ts`) imports nothing from
  `src/risk`. Each case has a written rationale and its sources.
- **Attack cases (20):**
  - dust, zero-value and counterfeit-token planting
  - counterfeit symbols that are exact, a variant (`USDC.e`), or a homoglyph (Cyrillic `С`)
  - lookalikes of a contact, of a past recipient who is not a contact, and of a person who only
    ever sent to the user
  - lookalikes pasted from outside the wallet
  - matches under the CMU criterion (3/3, 2/4)
  - long vanity matches (6/6)
  - timing after a test send
  - a repeat victim
  - a planting entry with an unknown signer
  - history unavailable
- **Legitimate cases (20):**
  - contacts and past recipients, including other valid encodings
  - new recipients below, at and above the first-send threshold
  - benign addresses that coincidentally share 3/3, 3/4, 4/4 and 4/5 characters with a trust
    anchor
  - a legitimate anomalous amount
  - a first send back to an inbound-only sender
  - benign tiny deposits
  - unrelated dust in history
  - sends after a test send
  - history outages

## Method

_Filled in with the results: three catch levels per threshold setting, misses by case ID,
false-warning rate split by friction level, raw counts and confusion matrices._

## Limitations

_Filled in with the results._
