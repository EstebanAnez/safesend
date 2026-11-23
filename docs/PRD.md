# SafeSend PRD

> **Status:** testnet prototype (Base Sepolia). Demo mode is complete; live mode is next (S6).
> Nothing in this document has been measured with real users. The success metrics describe what a
> real launch would track.

## Summary

SafeSend helps people detect lookalike recipients before they send USDC, by tracking where every
address in their history came from and making a clear decision at send time: **ALLOW**, **WARN**
with a proportional confirmation, or **BLOCK** with a one-click recovery and no override.

## Problem

**Address poisoning** turns a reasonable habit into a loss. People copy a recipient from their own
transaction history and check the first and last few characters. Attackers generate addresses
whose ends match someone the victim pays, and plant them in the victim's history with:

- a **dust** transfer from the lookalike,
- a **zero-value** transfer that looks as if the victim paid the lookalike,
- or a **counterfeit token** named "USDC".

The transfer is irreversible. The attack is described in Tsuchiya et al., "Blockchain Address
Poisoning" (arXiv 2501.16681), and in Scam Sniffer's reporting (via Cointelegraph, Feb 2026);
SafeSend's threat cases are written from those descriptions. SafeSend is a prototype of one
mitigation and makes no claim about reducing real-world losses.

**Why existing protections fall short:**

- **Truncated addresses** (`0x7A3f…e4d2`) show exactly the characters attackers match.
- **"Is this address new?"** checks pass, because the lookalike is in history.
- **Generic warnings** on every new recipient train people to click through.

## Why now

- **Bolivia is shifting to dollar stablecoins.** During the dollar shortage, people are moving
  savings into USDC and similar tokens and sending them to family. Many of them are first-time
  users, the people address poisoning works best on.
- **Stablecoins and payments are a 2026 priority for Coinbase.** As more everyday payments move
  onto stablecoins, the send screen is where a payment product earns or loses trust.

## Persona

**Daniela, 52, Santa Cruz, Bolivia.** During the dollar shortage she started holding USDC. Her son
Mateo sends her USDC from Kansas. She sends some to her sister Lucía, pays rent, and takes part in a
pasanaku with friends. She is careful but not technical: she copies addresses from her wallet
history because it's easier than finding the original message.

**What she needs:** to keep her habit without losing money to it; to understand _why_ when
something is stopped; and to not be nagged when she pays people she always pays.

## Goals and non-goals

**Goals**

1. Catch lookalike recipients at send time, with the strongest response when there is evidence of
   planting.
2. Keep friction proportional: none for trusted recipients, light for small first sends, strong
   only when there is a real signal.
3. Explain every decision in plain language, with the evidence (a character comparison) visible
   within two seconds.
4. Always offer the safe path: the real contact, one click away.
5. Be usable by everyone: keyboard-only, screen readers, phone widths, dark mode, reduced motion.

**Non-goals**

- **Preventing all address poisoning.** SafeSend reduces one path to loss (copying from history).
  It blocks lookalikes of people the user knows (D23), but it cannot catch an attacker's address
  that resembles no one, sent from a compromised chat.
- **Overrides.** There is no "send anyway" on a BLOCK, anywhere (D16).
- **Hiding history.** Planted entries are collapsed and explained, not deleted. The user can still
  see everything.
- **Mainnet, custody or real funds.** Testnet only.
- **Detecting other scams** (phishing approvals, fake airdrops, social engineering for payment).
- **Cross-device sync of contacts** (open question; session-only in the demo).

## User journeys

1. **Pay a trusted person.** Daniela picks Lucía from contacts, types 50, reviews: "Ready to send".
   No confirmation needed.
2. **Copy a planted lookalike from history.** She opens the hidden entry and uses its address.
   SafeSend blocks the send, shows "Same start and end. Different middle." with the characters
   that differ, and offers "Send to Lucía (sister) instead". One click, and she is back on the
   ALLOW path.
3. **Pay someone new.** A first payment of 200 USDC gets a middle-character WARN (type 4 characters
   from random middle positions, checked against what the person sent her) and a nudge to send 1
   USDC as a test first. After a test send, SafeSend tells her not to copy the address from
   history for the rest.
4. **Pay a new member of her pasanaku.** She adds the group once, carefully. Monthly payments to
   members are then ordinary contact payments.
5. **"This really is a different person."** From a BLOCK, she can add them as a contact only by
   entering the full address herself, twice for a lookalike, and confirming she checked it by
   phone. The blocked send never resumes.

## Requirements

### Functional

Priority: **P0** shipped in the demo; **P1** live mode and persistence (S6); **P2** later.

| ID  | Priority | Requirement                                                                                                                                                                 | Where                              |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| F1  | P0       | Classify every history entry by provenance and signer (including ERC-4337 bundles via the canonical EntryPoints)                                                            | `src/risk/signer.ts`, `history.ts` |
| F2  | P0       | Maintain a trust set (the only path to ALLOW) and a wider protected set (what lookalikes are compared against)                                                              | `src/risk/anchors.ts` (D14)        |
| F3  | P0       | BLOCK structural errors and every lookalike of a protected address, with no override                                                                                        | `src/risk/evaluate.ts` (D23)       |
| F4  | P0       | WARN with a proportional confirmation; never ask for the first or last characters                                                                                           | `src/risk/confirmation.ts` (D8)    |
| F5  | P0       | Flag unusual amounts against a per-recipient baseline, with a global fallback                                                                                               | D11                                |
| F6  | P0       | Re-verify on the final values immediately before any signature                                                                                                              | `src/risk/reverify.ts`             |
| F7  | P0       | Collapse and explain planted history entries                                                                                                                                | `HistoryList`                      |
| F8  | P0       | Add contacts and groups deliberately: full address entered, never prefilled; re-entry and out-of-band confirmation for lookalikes; group members checked against each other | `src/risk/contacts.ts` (D16, D18)  |
| F9  | P0       | Show history loading, empty and error states; explain what an error means for checks; offer retry                                                                           | D21                                |
| F10 | P1       | Connect a Coinbase Smart Wallet and send real testnet USDC, re-verified before the signature                                                                                | S6                                 |
| F11 | P1       | Read real history (Blockscout, RPC fallback) and label its coverage honestly (complete, partial, which tokens)                                                              | S6, `src/providers/history`        |
| F12 | P1       | Persist contacts and groups across sessions                                                                                                                                 | S6 (open question below)           |
| F13 | P1       | A Content-Security-Policy before real wallet connections                                                                                                                    | D22                                |
| F14 | P2       | Keep the protected set available when history is down (closes V2-C10)                                                                                                       | Open question below                |
| F15 | P2       | Group lifecycle: remove rotated members; shareable groups with their own threat model                                                                                       | Pasanaku section                   |

### Non-functional

- **Accessibility:** target WCAG 2.2 AA. The full journey works with the keyboard alone; focus
  moves to each new panel; decisions are announced; color is never the only signal; reduced motion
  is respected (D19). Checked by e2e tests with axe; no manual screen-reader pass yet.
- **Honesty:** every simulated action is labeled as simulated; every number in the evaluation is
  labeled synthetic, with intervals.
- **Purity and testability:** the risk engine is a pure function, lint-enforced (D6).
- **Performance:** a mobile Lighthouse target of 90. Not yet reliably met (D20).

## Success metrics (for a real launch; not measured in this prototype)

**Primary**

- **Lookalike interception rate:** among sends to addresses later confirmed as poisoning (from
  reports and on-chain labeling), the share that SafeSend BLOCKed or gave strong friction. Report
  separately for BLOCK and for strong friction, and by planting technique.
- **Recovery rate:** after a BLOCK, the share of sessions that complete a send to the suggested
  contact within 10 minutes. This measures whether blocking redirects users or just frustrates
  them.

**Counter-metrics (friction)**

- **Strong-friction rate on legitimate sends:** the share of sends to non-poisoning recipients that
  got a middle-character WARN. Track per user, because warning fatigue concentrates in heavy users.
- **Challenge abandonment:** the share of middle-character WARNs that end without a send. Too high
  means the friction blocks legitimate payments; too low may mean users treat it as a formality.
- **False BLOCK reports:** "This is a different person" flows started, and support contacts about
  blocked sends.

**Guardrails**

- No increase in successful lookalike sends among users who created contacts or groups (deliberate
  adds must not become a bypass).
- Send completion time for trusted recipients does not increase.

## Experiment design (for a real launch)

- **Unit:** user, not send, because the treatment changes habits.
- **Arms:** every arm applies every BLOCK (lookalikes and structural errors) with recovery (see Ethics).
  - (A) control: every other decision runs in shadow mode.
  - (B) WARNs shown, all as a checkbox.
  - (C) full SafeSend: middle-character confirmations where the policy asks for them.
- **Why three arms:** B against A measures whether showing lower-confidence signals changes what
  people send, at little cost. C against B isolates the cost and benefit of the strong
  confirmation, which is where warning fatigue lives.
- **Ethics:** no arm withholds a BLOCK from a user who is being attacked. BLOCKs
  apply in every arm. In arm A, every other decision runs in **shadow mode**: SafeSend decides and
  logs, but does not intervene. The experiment measures everything below BLOCK.
- **Duration and power:** poisoning sends are rare events, so interception is estimated from
  shadow decisions over all users, not only the experiment. The friction counter-metrics drive the
  sample size.

## Risks

| Risk                                                               | Mitigation                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Attackers adapt: match fewer end characters, or more in the middle | The shipped rule requires only 6 matched characters in total, at least 2 on each end (D15)        |
| Lookalike delivered outside history (a chat), with no planting     | BLOCK, like any lookalike of a protected address (D23). The genuine case goes through add-contact |
| History provider incomplete or down                                | Coverage labels (S6); any lookalike is BLOCKed while history can't be read; known gap V2-C10      |
| Warning fatigue erodes the WARN                                    | Proportional confirmations (D8), group contacts (D18), friction counter-metrics                   |
| Users treat "This is a different person" as an override            | It never resumes the send, requires re-entry, and stricter confirmation for lookalikes (D16)      |
| The evaluation overfits the builder's own cases                    | Frozen holdouts with hashes; independent cases; holdout v3 required for new claims (EVAL.md)      |

## Pasanaku: recurring payments to new people

**Context.** A pasanaku is a rotating savings group common in Bolivia. Each member contributes every
month, and each month one member receives the pot. With USDC, Daniela sends 50 USDC to a
different member each month, often someone she has never paid before. The addresses are shared in
the group's chat.

**Problem.** SafeSend treats a first send to a new address above 25 USDC as risky. It asks for the
strongest confirmation: typing 4 characters from the middle of the address. For a pasanaku that
means the hardest friction every single month, for a payment that is entirely normal. Friction that
fires on routine behavior trains people to click through it, and that is exactly when it fails
against a real attack.

**Options considered.**

| Option                           | Effect on pasanaku            | Effect on everyone else                | Decision         |
| -------------------------------- | ----------------------------- | -------------------------------------- | ---------------- |
| Raise the first-send threshold   | Less friction                 | Weaker protection for every first send | Rejected         |
| Skip checks for "small" amounts  | Less friction                 | Attackers adapt: many small thefts     | Rejected         |
| **Group contacts** ("Add group") | One careful setup, then ALLOW | None: rules for strangers unchanged    | **Chosen** (D18) |

**Requirements.**

1. The user can create a named group (for example "Pasanaku Mayo") and add several members in one
   flow.
2. Every member is added with the same rules as a single contact: the full address is entered,
   never picked from history, and the user explicitly confirms they got it from the member.
3. A member whose address looks like someone already protected, **or like another member of the
   same group**, needs the address typed twice and a confirmation that it was checked through
   another channel, like a phone call.
4. The same address can't be added twice.
5. After saving, members are ordinary contacts with a group label. Paying them is a contact payment
   (ALLOW, unless another signal such as an unusual amount applies).
6. Grouping never grants extra trust and never relaxes BLOCK.

**Success metrics (for a real launch; not measured in this prototype).**

- **Repeat-confirmation rate for group members:** the share of monthly group payments that still
  hit a middle-character WARN. Target: near zero after setup.
- **Group setup completion rate and time to complete:** the setup is deliberately careful, so watch
  for abandonment.
- **Lookalike interception for group members:** lookalikes of group members should still BLOCK
  when planted.
- **Guardrail:** no increase in successful lookalike sends among users who created groups.

**Open questions.** Group membership changes every round (members rotate or leave): should SafeSend
suggest removing old members? Should a group be shareable, for example as a signed list from the
organizer? Sharing it would add a new trust channel, which needs its own threat model.

## Open questions

- **Persistence of contacts and groups.** The demo keeps them for the session only. Live mode
  needs a decision (local storage on the device, or something that syncs), with its own threat
  model. To decide in S6.
- **Group lifecycle.** See the pasanaku section: removing rotated members, shareable groups.
- **Pasted lookalikes with no planting (V2-C05). Decided: BLOCK (D23).** Any lookalike of a
  protected address is blocked, which catches "my address changed" messages. The cost is that a
  genuine coincidence (about 1 in 290,000 first sends at 20 protected addresses) must be added as a
  contact first. Open: measure that cost, and whether users complete the add-contact path, on
  holdout v3 and, in a real launch, with the "This is a different person" counter-metric.
- **History unavailable (V2-C10).** Past recipients come from history, so they can't be protected
  during an outage. Caching the protected set on the device would close this, at the cost of
  storing it.
- **Performance target.** Lighthouse mobile performance is not reliably at 90 on the development
  laptop (D20). Re-measure with PageSpeed Insights on the deployed demo.
