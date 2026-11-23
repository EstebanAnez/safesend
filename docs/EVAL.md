# Evaluation

> **All numbers here are synthetic.** They measure how SafeSend's rules behave on hand-written
> scenarios. They are not fraud prevented, money saved, or real-world detection rates.

## Datasets

| Set            | Size                           | Status                                                                        | Used for tuning?                             |
| -------------- | ------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------- |
| **Holdout v1** | 40 (20 attack, 20 legit)       | Frozen at `5d2547ba8a8f3bc2f1abec689239b1ed864b46cf`, sha256 `f8714c18…d980e` | **No**, but it has now been seen (see below) |
| **Holdout v2** | 20 by Claude + 5–10 by Esteban | **Not frozen yet.** Nothing has run on it (`eval/holdout-v2/README.md`)       | No                                           |
| Dev            | 80 generated                   | Mutable (`eval/dev/build-dev.ts`)                                             | Yes                                          |

`npm run eval` refuses to run a holdout whose sha256 no longer matches its frozen hash.

### Holdout v1 freeze

| Item          | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Freeze commit | `5d2547ba8a8f3bc2f1abec689239b1ed864b46cf`                         |
| File          | `eval/holdout/cases.json`                                          |
| sha256        | `f8714c1802da0024e8f2b1d2241e379713dba5ce09e963396f9b4a92ad5d980e` |
| Written       | 2026-11-23, before any evaluation code existed                     |

The cases were written from threat descriptions:

- Tsuchiya et al., "Blockchain Address Poisoning", arXiv 2501.16681
- Scam Sniffer, via Cointelegraph, Feb 2026

The authoring script imports nothing from `src/risk`. Each case has a rationale.

- **Attacks:** dust, zero-value and counterfeit planting; counterfeit symbol variants (`USDC.e`,
  Cyrillic `С`); lookalikes of a contact, of a past recipient, and of an inbound-only sender;
  pasted lookalikes; under-threshold matches; long vanity matches; timing after a test send; a
  repeat victim; an unknown signer; history unavailable.
- **Legitimate sends:** contacts and past recipients in other valid encodings, new recipients
  around the first-send threshold, benign 3/3, 3/4, 4/4 and 4/5 overlaps, an anomalous but real
  amount, paying back an inbound-only sender, benign tiny deposits, sends after test sends, and
  outages.

## Method

Each case becomes one engine input. The run is repeated under each lookalike rule. The user's
experience is one of: **ALLOW**, **checkbox WARN**, **middle-character WARN** or **BLOCK**.

Three catch levels for attacks:

1. **Blocked:** BLOCK, with no way to send.
2. **Strong friction:** BLOCK or middle-character WARN.
3. **Flagged at all:** any WARN, including the checkbox.

We also report:

- **Attribution:** attacks caught by a lookalike or provenance signal (`LOOKALIKE*`,
  `UNKNOWN_PROVENANCE`), separately from attacks that got strong friction **only** because of the
  amount rules (first-send threshold or anomaly).
- **Misses by case ID:** attacks that reached ALLOW or only a checkbox.
- **False warnings on legitimate sends, split by friction:** checkbox, middle-character, BLOCK.
- **A confusion matrix per level, with raw counts.**
- **Wilson 95% intervals on every rate.**

**At 20 cases per side, differences of one or two cases are not meaningful.** The intervals are
wide (for example 15/20 = 75%, 95% CI 53–89%). Read the tables as "where does each rule fail and
why", not as a ranking.

## Results on holdout v1

The full reports, including every case's outcome under every rule:

- [before the fixes](../eval/reports/holdout-v1-before-fixes.md)
- [after the fixes, post-hoc](../eval/reports/holdout-v1-after-fixes-POSTHOC.md)

> **Post-hoc warning.** After the first run we looked at v1's failures and changed three things:
> the protected set (D14), per-recipient amount baselines (D11), and an evaluated total-match rule.
> The fixes were developed against unit tests and the dev set, not against v1. But we chose _what_
> to fix by looking at v1, so the "after" numbers on v1 are optimistic. The untouched measurement
> will be **holdout v2**.

### Attacks (20)

| Rule                    | Run              | Blocked          | Strong friction    | Flagged            | Caught by lookalike/provenance signal | Strong from amount rule only |
| ----------------------- | ---------------- | ---------------- | ------------------ | ------------------ | ------------------------------------- | ---------------------------- |
| 3/4 (shipped)           | before           | 14 (70%, 48–85%) | 17 (85%, 64–95%)   | 20 (100%, 84–100%) | 17 (85%, 64–95%)                      | 0                            |
| 3/4 (shipped)           | after (post-hoc) | 15 (75%, 53–89%) | 18 (90%, 70–97%)   | 20 (100%, 84–100%) | 18 (90%, 70–97%)                      | 0                            |
| total ≥ 6, ≥ 2 each end | after (post-hoc) | 17 (85%, 64–95%) | 20 (100%, 84–100%) | 20 (100%, 84–100%) | 20 (100%, 84–100%)                    | 0                            |
| 4/5 (for contrast)      | after (post-hoc) | 4 (20%, 8–42%)   | 16 (80%, 58–92%)   | 20 (100%, 84–100%) | 4 (20%, 8–42%)                        | 12                           |

**Misses** (ALLOW or checkbox only):

| Rule                    | Before                     | After (post-hoc)           |
| ----------------------- | -------------------------- | -------------------------- |
| 3/4                     | H-A08, H-A09, H-A16        | H-A08, H-A09               |
| total ≥ 6, ≥ 2 each end | (rule added after)         | none                       |
| 4/5                     | H-A08, H-A09, H-A16, H-A20 | H-A08, H-A09, H-A16, H-A20 |

- H-A08 is a 3/3 lookalike and H-A09 a 2/4 lookalike. Both are small sends, so only a checkbox.
- H-A16 (a lookalike of an inbound-only sender) is now caught under 3/3, 3/4, 4/4 and the total
  rule, because of the protected set. Under 4/5 it is still missed: a 4/4 lookalike doesn't meet
  that rule.

### Legitimate sends (20)

| Rule                    | Run              | ALLOW | Checkbox WARN  | Middle-char WARN | BLOCK         |
| ----------------------- | ---------------- | ----- | -------------- | ---------------- | ------------- |
| 3/4 (shipped)           | before           | 9     | 4 (20%, 8–42%) | 6 (30%, 15–52%)  | 1 (5%, 1–24%) |
| 3/4 (shipped)           | after (post-hoc) | 8     | 4 (20%, 8–42%) | 7 (35%, 18–57%)  | 1 (5%, 1–24%) |
| total ≥ 6, ≥ 2 each end | after (post-hoc) | 8     | 3 (15%, 5–36%) | 8 (40%, 22–61%)  | 1 (5%, 1–24%) |

- **What changed:** H-L10 (a 400 USDC emergency to the sister) went from ALLOW to a
  middle-character WARN. That's the per-recipient baseline working as designed, at the cost of one
  more strong false warning.
- **The only false BLOCK** in every run is H-L16: a benign 3/4 overlap while history was
  unavailable. [RISK_MODEL.md](RISK_MODEL.md#lookalike-rules-and-base-rates) explains why it's
  vanishingly rare in practice.

### What the attribution column shows

At 4/5, 12 of the 16 "strong friction" catches come only from the amount rules, with no lookalike
signal at all. Strong-friction recall is therefore **not** a measure of lookalike detection. The
signal column is. At 3/4 and under the total rule, every strong catch has a signal behind it.

## Limitations

- **Synthetic, small, and written by the builder.** The v1 cases were written by the same
  assistant that wrote the engine, from published threat descriptions. That reduces, but can't
  remove, the bias toward cases the engine handles. Holdout v2 includes cases written
  independently by Esteban.
- **The legitimate set over-represents coincidences.** 5 of 20 legitimate cases are deliberate
  boundary overlaps. Real overlap rates are in RISK_MODEL.md: about 1 in 13 million first sends at
  3/4 with 20 protected addresses.
- **Base rates aren't modeled.** Attack and legitimate cases are balanced 20/20. Real traffic is
  overwhelmingly legitimate, so the precision values in the reports don't transfer to real use.
- **"Flagged at all" is uninformative.** Every non-trust recipient gets at least a checkbox, so it
  is 20/20 for every rule.
- **No user behavior.** We measure what the engine asks of the user, not whether a hurried user
  complies.
- **No real chain data yet.** History comes from fixtures. Live coverage gaps (S6) aren't
  reflected.

## Regression check (CI)

`npm run eval:check` runs the shipped rule (3/4) on holdout v1 and fails if, at any of the three
levels, fewer attacks are caught or more legitimate sends are flagged than in
`eval/baseline.json`. The baseline records the post-fix 3/4 result. It is a regression guard, not a
target. Changing the shipped rule requires re-recording the baseline deliberately in a reviewed
commit.

## Next: holdout v2

1. Esteban writes 5–10 cases (`eval/holdout-v2/README.md`).
2. Freeze with `npx tsx eval/holdout-v2/build.ts --freeze` and commit the hash before any run.
3. Report 3/4 vs. the total rule on v2 with intervals, and decide the shipped rule from v2.
