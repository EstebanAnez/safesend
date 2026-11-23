# Evaluation

> **All numbers here are synthetic.** They measure how SafeSend's rules behave on hand-written
> scenarios. They are not fraud prevented, money saved, or real-world detection rates.

## Datasets

| Set            | Size                                                  | Status                                                                                   | Used for tuning?                             |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Holdout v1** | 40 (20 attack, 20 legit)                              | Frozen at `5d2547ba8a8f3bc2f1abec689239b1ed864b46cf`, sha256 `f8714c18…d980e`            | **No**, but it has now been seen (see below) |
| **Holdout v2** | 30 (15 attack, 15 legit): 10 by Esteban, 20 by Claude | Frozen at `f21ff97` (tag `holdout-v2-frozen`), sha256 `6ed9db56…7016433`, before any run | No                                           |
| Dev            | 80 generated                                          | Mutable (`eval/dev/build-dev.ts`)                                                        | Yes                                          |

`npm run eval` refuses to run a holdout whose sha256 no longer matches its frozen hash.

### Holdout v1 freeze

| Item          | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Freeze commit | `5d2547ba8a8f3bc2f1abec689239b1ed864b46cf` (tag `holdout-v1-frozen`) |
| File          | `eval/holdout/cases.json`                                            |
| sha256        | `f8714c1802da0024e8f2b1d2241e379713dba5ce09e963396f9b4a92ad5d980e`   |
| Written       | 2026-11-23, before any evaluation code existed                       |

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
| 3/4 (shipped until v2)  | before           | 14 (70%, 48–85%) | 17 (85%, 64–95%)   | 20 (100%, 84–100%) | 17 (85%, 64–95%)                      | 0                            |
| 3/4 (shipped until v2)  | after (post-hoc) | 15 (75%, 53–89%) | 18 (90%, 70–97%)   | 20 (100%, 84–100%) | 18 (90%, 70–97%)                      | 0                            |
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
| 3/4 (shipped until v2)  | before           | 9     | 4 (20%, 8–42%) | 6 (30%, 15–52%)  | 1 (5%, 1–24%) |
| 3/4 (shipped until v2)  | after (post-hoc) | 8     | 4 (20%, 8–42%) | 7 (35%, 18–57%)  | 1 (5%, 1–24%) |
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

`npm run eval:check` runs the **shipped** rule on holdout v1. It fails if, at any of the three levels, fewer
attacks are caught or more legitimate sends are flagged than in `eval/baseline.json`. It is a
regression guard, not a target. Changing the shipped rule requires re-recording the baseline
deliberately in a reviewed commit, and the check refuses to run when the baseline was recorded for a
different rule.

- **Current baseline:** total ≥ 6, ≥ 2 each end, with every lookalike a BLOCK (D23), on holdout
  v1: 20 attacks blocked, 20 with strong friction, 20 flagged; legitimate sends: 6 blocked, 9 with
  strong friction, 12 flagged.
- **Previous baselines:** the same rule before D23 (17 attacks and 1 legitimate send blocked), and
  before that 3/4.

## Results on holdout v2 (first and only clean run)

Frozen at `f21ff9717fde16f4e574f75553d41720d092bf16` (tag `holdout-v2-frozen`), sha256
`6ed9db565b8e84aeaf526f446cb12b2f66f28d2433b6f08d19475c7547016433`, before anything ran on it.
Esteban's 10 cases are a literal translation of his plain-language descriptions. They are the
independent part, because Claude had not seen them and they weren't shaped by the engine.
Claude's 20 were written after seeing v1 and the rules, so treat them as coverage, not as a blind
test. Full report, per case and per author:
[holdout-v2-first-run.md](../eval/reports/holdout-v2-first-run.md).

| Subset          | Rule                    | Attacks blocked      | Strong friction       | Signal-attributed    | Legit: checkbox / middle-char / BLOCK | Misses |
| --------------- | ----------------------- | -------------------- | --------------------- | -------------------- | ------------------------------------- | ------ |
| All (15 + 15)   | 3/4                     | 11 (73%, CI 48–89%)  | 14 (93%, CI 70–99%)   | 12 (80%, CI 55–93%)  | 3 / 3 / 0                             | V2-C07 |
| All (15 + 15)   | total ≥ 6, ≥ 2 each end | 13 (87%, CI 62–96%)  | 15 (100%, CI 80–100%) | 14 (93%, CI 70–99%)  | 2 / 4 / 0                             | none   |
| Esteban (5 + 5) | 3/4                     | 4 (80%, CI 38–96%)   | 5 (100%, CI 57–100%)  | 4 (80%, CI 38–96%)   | 1 / 2 / 0                             | none   |
| Esteban (5 + 5) | total ≥ 6, ≥ 2 each end | 5 (100%, CI 57–100%) | 5 (100%, CI 57–100%)  | 5 (100%, CI 57–100%) | 1 / 2 / 0                             | none   |

**Reading it honestly:**

- **The two rules differ by two attack cases and one legitimate case.** At this sample size that
  is **not statistically meaningful**; the intervals overlap almost entirely. What is consistent
  across v1 (post-hoc) and v2 (clean) is _where_ they differ:
  - **Uneven matches.** V2-C07 (2/5) and V2-E05 (2/5, Esteban's) are caught by the total rule's
    lookalike signal. Under 3/4, V2-C07 gets only a checkbox, and V2-E05 gets strong friction only
    because of the amount rule.
  - **Cost.** One benign 2/4 overlap (V2-C13) moves from checkbox to middle-character WARN. Neither
    rule falsely BLOCKs any legitimate v2 send.
- **Warning fatigue (Esteban's L1, V2-E06).** A pasanaku payment of 50 USDC to a new group member
  gets the **middle-character** WARN under every rule, because 50 is above the 25 USDC first-send
  threshold. In a monthly rotating group, that is the strongest friction every single month. This
  is a product problem, not a lookalike-rule problem. See "Open questions".
- **Remaining gaps, under both rules:**
  - V2-C05: a pasted "my address changed" 5/5 lookalike gets a WARN, not a BLOCK, because there is
    no on-chain planting. **Closed by D23** (see "Policy change D23" below).
  - V2-C10: with history unavailable, past recipients (which come from history) can't be compared
    against, so a pasted landlord lookalike gets friction only from the amount rule.
- **Correct non-alarms:** V2-E10 (500 USDC to her own exchange, usually 100–150) is ALLOWed, since
  it is below 5× her per-recipient median of 125. V2-E09 (Mateo's new wallet added as a contact
  first) is ALLOWed.

## Decision: the shipped rule changed after holdout v2

**The shipped lookalike rule is now "total ≥ 6, ≥ 2 each end"** (D15), replacing 3/4. The product
owner made the decision after seeing the holdout v2 results above.

**Consequence, stated plainly:** holdout v2 informed this decision, so **v2 is no longer a clean
holdout for the shipped rule.** Its numbers for the total rule now carry the same caveat as v1's
post-hoc numbers. **Any future claim about the shipped rule's performance needs a new holdout (v3)**,
written and frozen before it is run, ideally with more independently written cases.

## Open questions

- **Warning fatigue for recurring new-recipient patterns** (pasanaku). **Addressed by design, not
  by threshold:** group contacts (D18) let the user add all members once, deliberately; monthly
  payments then go to contacts and are ALLOWed. The first-send threshold is unchanged. Not
  evaluated on a holdout yet (v3).

## Policy change D23: every lookalike is a BLOCK (post-hoc)

After this run, the product owner decided that every lookalike of a protected address is a BLOCK,
with or without planting evidence (D23, closing V2-C05). **Both holdouts had been seen, so every
number below is post-hoc. A clean claim needs holdout v3.** Full report:
[policy-d23-POSTHOC.md](../eval/reports/policy-d23-POSTHOC.md).

Shipped rule (total ≥ 6, ≥ 2 each end), before → after D23:

| Holdout               | Attacks blocked                | Strong friction | Legit: checkbox / middle-char / BLOCK | Attack misses |
| --------------------- | ------------------------------ | --------------- | ------------------------------------- | ------------- |
| v1 (20 + 20)          | 17 → **20** (100%, CI 84–100%) | 20 → 20         | 3 / 8 / 1 → 3 / 3 / **6**             | none          |
| v2, all (15 + 15)     | 13 → **14** (93%, CI 70–99%)   | 15 → 15         | 2 / 4 / 0 → 2 / 3 / **1**             | none          |
| v2, Esteban's (5 + 5) | 5 → 5                          | 5 → 5           | 1 / 2 / 0 → 1 / 2 / 0                 | none          |

- **The cost:** 5 more legitimate v1 sends are blocked (H-L06, H-L07, H-L08, H-L09, H-L19), and one
  v2 send (V2-C13). All are deliberate coincidental overlaps. The holdouts over-sample them (5 of
  20 v1 legitimate cases) to probe the boundary; in real use they occur about 1 in 290,000 first
  sends at 20 protected addresses (RISK_MODEL.md). H-L06 shows the user impact: paying back a
  cousin whose address happens to overlap Lucía's needs adding him as a contact first.
- **The benefit:** V2-C05 ("my address changed") and the v1 attacks that previously got only a
  WARN are now blocked.
- **Still open:** V2-C10 (history unavailable, so past recipients aren't protected) gets strong
  friction only from the amount rule.
- At this sample size, the one-case differences on v2 are not meaningful.
