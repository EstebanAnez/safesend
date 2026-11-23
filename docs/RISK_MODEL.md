# Risk model

How SafeSend decides ALLOW, WARN or BLOCK at send time. The engine is a pure function in
`src/risk/evaluate.ts`. It takes the recipient, amount, trust anchors, normalized history and
config, and returns `{ decision, score, reasons, confirmation, testSendSuggested }`. Every reason
has a code, a severity, a plain-language title and explanation, and evidence.

> Status: policy implemented in S2. The lookalike thresholds below are **provisional
> hypotheses**. S3 evaluates several settings on a held-out, synthetic set and picks the default
> from those results. That section gets filled in then.

## Trust anchors: the only things lookalikes are compared against

| Anchor                   | How it is created                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trusted contact          | Only through a deliberate action: the user types or pastes the full address and confirms it. Never created from history.                                                                   |
| Confirmed past recipient | A canonical-USDC, non-zero, verified-provenance send **signed by the user** (see DECISIONS D5), to an address that did **not** first appear in history through a planting technique (D10). |
| **Never** an anchor      | Inbound transfers, arbitrary history entries, entries with unknown signer or unknown provenance.                                                                                           |

## Policy

### BLOCK: no override anywhere in the app

| Code                          | When                                                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_ADDRESS`             | Empty, missing `0x`, wrong length, non-hex, or a mixed-case address with a bad EIP-55 checksum                                                                                                                                      |
| `ZERO_ADDRESS`                | `0x000…000`                                                                                                                                                                                                                         |
| `TOKEN_CONTRACT_AS_RECIPIENT` | The USDC contract itself                                                                                                                                                                                                            |
| `SELF_SEND`                   | The user's own address                                                                                                                                                                                                              |
| `WRONG_NETWORK`               | Chain id is not 84532 (Base Sepolia)                                                                                                                                                                                                |
| `WRONG_TOKEN`                 | Token contract is not canonical USDC (any token can claim the symbol "USDC")                                                                                                                                                        |
| `LOOKALIKE_HIGH_CONFIDENCE`   | Matches an anchor on ≥ P leading and ≥ S trailing hex characters, isn't identical to it, **and** first appeared in history through dust, zero-value or a counterfeit token. If history couldn't be read, the match alone is enough. |

The BLOCK screen explains the reason, shows the character comparison, and offers recovery
("Send to [contact] instead").

### WARN: explicit, proportional confirmation

| Code                                           | When                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `LOOKALIKE`                                    | Both-ends match with an anchor, but no planting origin in history                              |
| `NEW_RECIPIENT` / `NEW_RECIPIENT_LARGE_AMOUNT` | Not an anchor; "large" means above the first-send threshold                                    |
| `UNKNOWN_PROVENANCE`                           | The recipient appears in history only through entries whose provenance couldn't be established |
| `AMOUNT_ANOMALY`                               | More than 5× the median signer-confirmed send, once at least 3 such sends exist (D11)          |

Confirmation levels (D8):

- `acknowledge`: the only signal is `NEW_RECIPIENT` (at or below the threshold). The user ticks a
  checkbox saying they confirmed the address out of band.
- `middle-characters`: every other WARN. The user types 4 characters at random positions from the
  middle of the address, never the first or last characters. A new recipient also gets the
  test-send nudge.

### ALLOW

An exact trust anchor with no WARN signal. No friction.

## Re-verification before signing

`src/risk/reverify.ts` runs immediately before the signature request, on the final values:
recipient, amount, chain id, token, and current history. It aborts if any value changed, if the
decision is now BLOCK, if an ALLOW became a WARN, if the WARN confirmation level changed, or if
the WARN wasn't confirmed.

## Parameters (provisional)

| Parameter                 | Default   | Why                                                                                           |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `prefixMatchLength` (P)   | 3         | The CMU study's lookalike criterion (≥3 leading, ≥4 trailing). Hypothesis, to be chosen in S3 |
| `suffixMatchLength` (S)   | 4         | Same as above                                                                                 |
| `firstSendThreshold`      | 25 USDC   | Product choice: small enough to suggest a test send for meaningful amounts                    |
| `dustThreshold`           | 0.01 USDC | Inbound canonical-USDC transfers at or below this count as dust                               |
| `amountAnomalyMultiplier` | 5×        | Product choice, see D11                                                                       |
| `amountBaselineMinSends`  | 3         | No baseline, no signal                                                                        |

## Threshold evaluation

_To be filled in S3: 3/3, 3/4, 4/4 and 4/5 on the holdout set, with raw counts, precision,
recall, false-warning rate on legitimate sends, and the chosen default with its trade-off._
