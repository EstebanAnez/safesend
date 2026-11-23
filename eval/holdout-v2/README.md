# Holdout v2: how to write cases

Holdout v1 has been looked at, and three rules changed after we saw it. Its numbers after those
changes are **post-hoc**. Holdout v2 gives an untouched measurement. It has two authors:

- **Esteban** writes 5 to 10 cases in `esteban.cases.json`. These are the independent part:
  Claude has not seen them, and they aren't shaped by the engine.
- **Claude** wrote `claude.cases.json` from a fresh list of threat scenarios. Claude has seen the
  v1 results and the rules, so those cases are not independent. Treat them as coverage, not as a
  blind test.

Nobody runs the engine on v2 until it is frozen and committed.

## The format, in one minute

Each case is one send that Daniela is about to make, plus the history her wallet shows at that
moment. You describe people by **name**, never by hex.

```jsonc
{
  "id": "V2-E01", // unique; use V2-E.. for yours
  "label": "attack", // "attack" or "legit": what is really going on
  "title": "One line a reviewer can scan",
  "rationale": "Why this case exists and why the label is right.",
  "sources": ["optional: paper, report, or your own experience"],
  "contacts": ["lucia"], // people Daniela deliberately saved
  "baseHistory": true, // include her ordinary month (see below)
  "history": [
    // extra transfers on top of baseHistory
    {
      "block": 3300,
      "from": "lookalike:lucia:4:4:x",
      "to": "me",
      "amount": "0.001",
      "signer": "lookalike:lucia:4:4:x",
    },
  ],
  "testSends": [], // optional: [{ "to": "friend", "block": 4000, "amount": "1" }]
  "historyAvailable": true, // false = the wallet could not load history
  "send": { "to": "lookalike:lucia:4:4:x", "amount": "50", "pickedFrom": "history" },
}
```

**Names you can use:** `me` (Daniela), `lucia` (sister), `mateo` (son, sends her money),
`landlord`, `cousin`, `friend`, `merchant`, `employer`, `exchange`, `attacker`.

**Making addresses:**

| You write                 | You get                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `"lucia"`                 | Lucía's real address                                                                                       |
| `"lookalike:lucia:4:4:x"` | An address with the same first 4 and last 4 characters as Lucía's. Change `x` to get a different lookalike |
| `"random:x"`              | An unrelated address                                                                                       |
| `"0xAbC…"` (42 chars)     | Exactly that address (to test casing, typos, etc.)                                                         |

**Transfers** (`history`): `block` orders time (bigger = later; base history uses blocks 1000 to
3200). `from` and `to` are names or address forms. `amount` is in USDC as a string (`"0.001"`,
`"0"`, `"250"`). `signer` is who signed the transaction: usually the sender, the attacker for a
zero-value "from you" transfer, or `null` if unknown.

- For a fake token, add `"token": { "fake": "USDC" }` (or `"USDC.e"`, etc.).
- Optional: `"provenance": "inferred"` or `"unknown"` for entries the data source couldn't verify.

**baseHistory** adds Daniela's ordinary life:

- her son sends 400 three times
- she sends 40 to 45 to Lucía three times
- she pays 250 rent three times

## Ideas that would be most valuable from you

Things you've seen or heard of that a rule-writer wouldn't think of. For example:

- how people in Bolivia actually get and share addresses (WhatsApp screenshots? QR codes?)
- payments that look odd but are normal
- an attack story told the way a victim would tell it

Legitimate cases matter as much as attacks.

## Workflow

1. Copy `esteban.cases.template.json` to `esteban.cases.json` and write your cases.
2. `npx tsx eval/holdout-v2/build.ts` validates and prints a summary. It does **not** run the
   engine.
3. `npx tsx eval/holdout-v2/build.ts --freeze` writes `cases.json` and `cases.sha256`.
4. Commit those files **first**. Then `npm run eval` includes holdout v2.
