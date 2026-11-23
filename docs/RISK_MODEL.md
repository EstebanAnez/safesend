# Risk model

How SafeSend decides ALLOW, WARN or BLOCK at send time. The engine is a pure function in
`src/risk/evaluate.ts`. It takes the recipient, amount, trust anchors, normalized history, recorded
test sends and config, and returns `{ decision, score, reasons, confirmation, testSendSuggested }`.
Every reason has a code, a severity, a plain-language title and explanation, and evidence.

## Two sets: trust and protection

| Set           | Members                                                                                                                                                                                                         | What it does                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Trust**     | Contacts added deliberately (typed or pasted, then confirmed). Signer-confirmed past recipients (D5), unless the address first appeared through planting (D10). SafeSend-recorded test-send recipients (D13).   | The **only** way to get ALLOW                                              |
| **Protected** | Everything in the trust set, plus **inbound senders** with at least `protectInboundMinTransfers` (default 1) canonical-USDC transfers above the dust threshold, signed by the sender, with verified provenance. | What lookalikes are compared against. Protection never implies trust (D14) |
| Neither       | Dust senders, unknown signers, unverified provenance, counterfeit tokens, arbitrary history entries                                                                                                             | Ignored for comparison                                                     |

This split is why a lookalike of Daniela's son (who only ever sends to her) is caught, while the
son himself still needs a confirmation the first time she pays him.

## Policy

### BLOCK: no override anywhere in the app

| Code                          | When                                                                                                                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_ADDRESS`             | Empty, missing `0x`, wrong length, non-hex, or a mixed-case address with a bad EIP-55 checksum                                                                                                                                                                       |
| `ZERO_ADDRESS`                | `0x000…000`                                                                                                                                                                                                                                                          |
| `TOKEN_CONTRACT_AS_RECIPIENT` | The USDC contract itself                                                                                                                                                                                                                                             |
| `SELF_SEND`                   | The user's own address                                                                                                                                                                                                                                               |
| `WRONG_NETWORK`               | Chain id is not 84532 (Base Sepolia)                                                                                                                                                                                                                                 |
| `WRONG_TOKEN`                 | Token is not canonical USDC                                                                                                                                                                                                                                          |
| `LOOKALIKE_HIGH_CONFIDENCE`   | A lookalike of a protected address (by the configured rule) whose **first appearance** in history was dust, zero-value or a counterfeit token, **or** that appeared after a test send to the address it imitates, **or** any lookalike when history couldn't be read |

The BLOCK screen explains the reason, shows the character comparison, and offers recovery.

### WARN: explicit, proportional confirmation (D8)

| Code                                           | When                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `LOOKALIKE`                                    | Lookalike of a protected address with no planting or timing evidence                           |
| `NEW_RECIPIENT` / `NEW_RECIPIENT_LARGE_AMOUNT` | Not in the trust set. "Large" means above the first-send threshold (25 USDC)                   |
| `UNKNOWN_PROVENANCE`                           | The recipient appears in history only through entries whose provenance couldn't be established |
| `AMOUNT_ANOMALY`                               | Above 5× the usual send, with a per-recipient baseline and a global fallback (see below)       |

- `acknowledge` (checkbox): the only signal is `NEW_RECIPIENT`.
- `middle-characters`: every other WARN. Four characters at random positions from the middle of
  the address. A new recipient also gets the test-send nudge.

### ALLOW

An exact trust-set address with no WARN signal.

### Amount anomaly baseline (D11)

1. **Per recipient:** the median of signer-confirmed sends **to this recipient**, once there are
   at least `amountRecipientMinSends` = **3** of them.
2. **Otherwise global:** the median of all signer-confirmed sends, once there are at least
   `amountBaselineMinSends` = **3**.
3. **Otherwise no signal.**

Why 3 sends: a median of one or two payments is mostly noise. With three, a single unusual
payment doesn't set the baseline. This is a product choice to revisit with real data. Per
recipient matters because a global median mixes rent with family transfers. In holdout v1, the
global median (175 USDC, pulled up by rent) let a 400 USDC "emergency" to the sister through.

### Re-verification before signing

`src/risk/reverify.ts` re-runs everything on the final values immediately before the signature
request. It aborts on any change, on a final BLOCK, on an ALLOW that became a WARN, on an escalated
confirmation level, or on an unconfirmed WARN.

## Lookalike rules and base rates

Attackers generate addresses until the leading and trailing hex characters match the target. Each
extra matched character multiplies their work by 16. The same arithmetic tells us how often an
**innocent** address collides with one we protect.

For a uniformly random legitimate address and one protected address, ignoring the negligible
overlap between the two ends:

- **Prefix/suffix rule** (≥ k leading **and** ≥ m trailing): P = 16^-(k+m).
- **Total rule** (≥ T matched in total, ≥ e on each end): P = Σ over a ≥ e, b ≥ e, a + b ≥ T of
  P(exactly a leading) · P(exactly b trailing), where P(exactly a) = 16^-a · 15/16.
- **With N protected addresses:** the chance that one new recipient falsely matches any of them is
  about **N · P**.

| Rule                                | P per protected address | 1 in…           | N = 5        | N = 20      | N = 100     |
| ----------------------------------- | ----------------------- | --------------- | ------------ | ----------- | ----------- |
| 3/3                                 | 5.96e-8                 | 16,777,216      | 3,355,443    | 838,861     | 167,772     |
| **3/4 (v1 baseline, shipped)**      | **3.73e-9**             | **268,435,456** | 53,687,091   | 13,421,773  | 2,684,355   |
| 4/4                                 | 2.33e-10                | 4,294,967,296   | 858,993,459  | 214,748,365 | 42,949,673  |
| 4/5                                 | 1.46e-11                | 68,719,476,736  | 13.7 billion | 3.4 billion | 687,194,767 |
| total ≥ 6, ≥ 2 each end (candidate) | 1.71e-7                 | 5,835,553       | 1,167,111    | 291,778     | 58,356      |

Values are computed exactly by summing the series. "N = …" columns are "1 in" per send.

**What this means:**

- **The holdout overstates benign overlaps by design.** It deliberately includes coincidental
  3/4, 3/3, 4/4 and 4/5 matches (5 of its 20 legitimate cases) to probe the boundary. In real use
  they are extraordinarily rare. Under 3/4, a person with 20 protected addresses would see about
  **1 in 13 million** first sends falsely match.
- **Why H-L16 is acceptable in practice.** H-L16 is the one false BLOCK in holdout v1: a benign
  3/4 overlap at a moment when history couldn't be loaded, where the policy treats any lookalike as
  dangerous. In practice it requires both an outage and a one-in-13-million coincidence (N = 20).
  Without history, "it looks like your sister but isn't" is far more likely to be an attack than a
  coincidence. Even under the looser total rule, the same coincidence is about 1 in 290,000 per
  send at N = 20.
- **The total rule trades a looser match for coverage of "users check only one end".** The rule
  is "at least 6 matched in total, at least 2 on each end". It catches 2/4 and 4/2 lookalikes
  (H-A09, V2-C07) that 3/4 misses. Its benign collision rate is about 46× higher than 3/4, but at
  1 in 5.8 million per protected address it is still small. Whether it replaces 3/4 is decided
  on **holdout v2**, not on v1, which we've already looked at.
- **Limits of the math:** it assumes legitimate addresses are uniformly random. That's true for
  keys from a CSPRNG, but not for vanity addresses or deliberately chosen ones. It also says
  nothing about how often attackers produce matches _below_ a threshold.

## Parameters

| Parameter                    | Default           | Why                                                                       |
| ---------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `lookalike`                  | prefix-suffix 3/4 | CMU criterion; v1 baseline. Candidate: total ≥ 6, ≥ 2 each end            |
| `protectInboundMinTransfers` | 1                 | One verified, above-dust inbound payment means a real person paid you     |
| `firstSendThreshold`         | 25 USDC           | Above this, suggest a test send and require middle-character confirmation |
| `dustThreshold`              | 0.01 USDC         | Inbound canonical-USDC transfers at or below this are dust                |
| `amountAnomalyMultiplier`    | 5×                | Product choice                                                            |
| `amountRecipientMinSends`    | 3                 | Per-recipient baseline minimum                                            |
| `amountBaselineMinSends`     | 3                 | Global fallback minimum                                                   |

Evaluation results: [EVAL.md](EVAL.md).
