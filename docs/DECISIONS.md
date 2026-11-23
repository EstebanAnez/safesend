# Decisions

Short records of choices that a reviewer might question. Newest last.

## D1. Start from the official CDS Next.js template

- **What:** Bootstrapped with `npx -y gitpick coinbase/cds/tree/master/templates/next-app .`
  (CDS web 9.30.1, Next.js 15.4.8, React 19.1.2). Removed the template's sample screens
  (asset list, staking cards, sidebar).
- **Why:** It's the same component system and tokens Coinbase product teams use, so we don't
  re-create them with custom CSS.

## D2. npm with two scoped peer overrides (React 19 comes from the template)

- **What:** The template assumes yarn. We use npm (`npm run eval` etc.) and add `overrides` that
  let `framer-motion@10` and `@react-spring/web@9` (both pulled in by `@coinbase/cds-web@9`) accept
  React 19 as a peer.
- **The React version is the template's, not ours.** The official template's own `package.json`
  pins `react` and `react-dom` to `19.1.2` (see the bootstrap commit `abb0ff6`). The conflict is
  between the template and its own transitive peers, which declare React ≤18. yarn only warns
  about that; npm rejects it. We don't pin React 18, because that would diverge from the template
  CDS ships and tests.
- **Scope:** the overrides cover those two packages only, so peer checks stay on for everything
  else (no global `legacy-peer-deps`).
- **Risk accepted:** those two packages aren't officially tested on React 19. Mitigation: every
  CDS component we use is exercised by unit or e2e tests (including axe), and both run in CI.
- **Revisit when:** CDS publishes a release with a React 19 peer range.

## D3. Canonical USDC on Base Sepolia

- **Address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals, chain id 84532.
- **Source:** Circle, "USDC Contract Addresses", Testnet table, row "Base Sepolia"
  (<https://developers.circle.com/stablecoins/usdc-contract-addresses>), checked 2026-11-23.
  Cross-checked on Blockscout (`/api/v2/tokens/<address>`: symbol `USDC`, decimals `6`).
- **Where:** `src/config/chain.ts` is the only place it is defined.

## D4. Blockscout as the explorer provider

- **What:** `https://base-sepolia.blockscout.com/api/v2` (address token transfers, tokens,
  transactions, verified contract ABIs).
- **Checked 2026-11-23:** works without an API key (HTTP 200).
- **Caveat:** rate limits are not documented. The provider must handle HTTP 429 and fall back to
  the RPC provider, and the UI must label that coverage as partial.

## D5. Who signed a transfer, including Coinbase Smart Wallet (ERC-4337)

- **Problem:** A past send only becomes a trust anchor if the user signed it. A Coinbase Smart
  Wallet is an ERC-4337 account: a bundler submits its transactions, so `tx.from` is the bundler.
  A bundle can also carry user operations from **other accounts** in the same transaction, so
  "the user's op is somewhere in this tx" proves nothing about a given transfer.
- **Rule:** implemented in `src/risk/signer.ts` as `resolveTransferSigner`. A send counts as the
  user's only if `isConfirmedUserSend` also holds.
  1. **The tx has no canonical EntryPoint logs:** the signer is `tx.from`. It counts as the user's
     send only if `tx.from` is the user and `Transfer.from` is the user.
  2. **The tx has canonical EntryPoint logs (a bundle):** the transfer is attributed to a user
     operation only if **all** of these hold:
     - The `UserOperationEvent` was emitted **by a canonical EntryPoint**. Anyone can emit an event
       with the same signature from their own contract.
     - `success == true`.
     - The Transfer log falls strictly inside that op's log range. That means after the previous
       boundary from the **same** EntryPoint, and before this op's `UserOperationEvent`. The
       previous boundary is the previous op's `UserOperationEvent`, or `BeforeExecution` for the
       first op.
     - `Transfer.from == sender`.
  3. **Anything not verifiable gives `{ status: "unknown" }`, which is never a trust anchor.**
     That covers a failed op, a transfer during validation (before `BeforeExecution`), a transfer
     inside another account's op, mismatched EntryPoints, and logs that can't be decoded.
- **Stricter than "tx.from is the user OR ...":** in a bundle, `tx.from == user` is **not**
  accepted on its own. Otherwise a user EOA acting as a bundler would vouch for another account's
  operation that moves the user's tokens. A test covers this.
- **Canonical EntryPoints:** defined in `src/config/entrypoints.ts`, from the
  eth-infinitism/account-abstraction GitHub releases, checked 2026-11-23:

  | Version | Address                                      |
  | ------- | -------------------------------------------- |
  | 0.6     | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
  | 0.7     | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
  | 0.8     | `0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108` |
  | 0.9     | `0x433709009B8330FDa32311DF1C2AFA402eD8D009` |

  Each one is a verified contract named "EntryPoint" on base-sepolia.blockscout.com. Each one's
  verified ABI declares the same two events, `BeforeExecution()` and
  `UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed
paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)`.
  The Coinbase Smart Wallet README refers to EntryPoint v0.6.

- **Tests** (`src/risk/signer.test.ts`):
  - EOA send
  - zero-value `transferFrom` by an attacker
  - **multi-op bundle where another account's op moves the user's tokens in the same tx**
  - a later op not covered by an earlier user op
  - failed op
  - a fake EntryPoint emitting look-alike events
  - a transfer before `BeforeExecution`
  - `Transfer.from` not equal to the sender
  - a range opened by one EntryPoint and closed by another
  - a user EOA acting as the bundler

## D6. Architecture rules are enforced by lint, not convention

- `src/risk/**` cannot import React, Next, wagmi, TanStack, hooks, components or providers. It
  also cannot use `fetch`, `window`, `document` or `localStorage`.
- `src/components/**` and `src/app/**` cannot import `src/providers/**`, `wagmi/actions` or
  `viem/actions`, and cannot call `fetch`. They go through hooks in `src/hooks/`.
- `any` is a lint error. See `eslint.config.mjs`.

## D7. Address input rules

- Trim surrounding whitespace and require the `0x` prefix plus 40 hex characters.
- All-lowercase or all-uppercase hex is accepted. Mixed case must be a valid EIP-55 checksum,
  otherwise it is rejected, never silently "corrected".
- Normalized with viem `getAddress`. Comparisons are case-insensitive on hex.
- Implemented in `src/risk/address.ts`, with unit tests.

## D8. WARN confirmations are proportional and never use the first or last characters

- **The decision stays WARN** for a first send to a new address. ALLOW is reserved for trust
  anchors with no risk signals.
- **Never confirm with the last (or first) characters.** Lookalikes are generated to match exactly
  those, so "type the last 4" is a check the attacker has already passed. The S1 version did this.
  It's gone now, and a test asserts the last 4 characters don't unlock a WARN.
- **Two confirmation levels** (`RiskResult.confirmation`):
  - `acknowledge`: a new recipient **at or below** the first-send threshold with **no other
    signal**. The user ticks one checkbox: "I confirmed this address with the recipient through
    another channel".
  - `middle-characters`: every other WARN (above the threshold, lookalike, unknown provenance,
    amount anomaly). The user types 4 characters at positions drawn at random **for every review**
    with `crypto.getRandomValues`. Positions come from the middle range, which excludes at least 6
    characters at each end, and more when a lookalike matches a longer prefix or suffix.
- **Not color-only:** the challenge positions are outlined in the comparison or address view and
  also listed in text ("Type characters 17, 26, 27 and 29").
- **Test-send nudge** (`RiskResult.testSendSuggested`): shown for a new recipient that needs the
  middle-character confirmation. It offers a one-tap "Send 1 USDC as a test" and warns that
  attackers strike right after test sends. It's never shown for a trusted contact.
- **Honest limit:** the characters are on screen, so the challenge forces the user to look at the
  middle of the address and compare it with what the person sent. It doesn't prove the comparison
  happened. The copy says so: "Check them against the address the person gave you, not against
  your history."
- **The engine stays deterministic:** it returns the range, and `useChallengePositions` picks the
  random positions with an injectable RNG, so tests are reproducible.

## D9. No uppercase text styles anywhere an address or hash can appear

- CDS `caption` and `legal` fonts apply `text-transform: uppercase`, which rendered `0x7a3f…` as
  `0X7A3F…`. In an app whose job is reading addresses exactly, that is a correctness bug, not a
  style choice. Metadata uses `label2`, and an e2e test asserts `text-transform: none`.
- CDS `Banner` clamps string children to 3 lines. Reasons are passed as `Text` nodes so an
  explanation is never cut off mid-sentence. This is also covered by e2e.

## D10. A past send does not make a previously poisoned address trusted

- Suppose the user already sent to an address that **first entered their history through a
  planting technique** (dust, zero-value, counterfeit). That address is **not** a
  confirmed-recipient anchor. That's what a victim who already fell for a lookalike once looks
  like, and trusting it would ALLOW every later send to the attacker. Instead, the lookalike check
  runs against the real contact, and the send BLOCKs.
- "First appearance" means the earliest entry, by block number and then log index. An address
  first seen through ordinary activity and dusted later gets WARN, not BLOCK, because the policy
  says "first appeared through".

## D11. Amount anomaly: per-recipient baseline, global fallback

- WARN when the amount is more than 5× the usual send:
  1. **Per recipient:** the median of signer-confirmed sends to **this** recipient, once there are
     at least **3** (`amountRecipientMinSends`).
  2. **Otherwise global:** the median of all signer-confirmed sends, once there are at least **3**
     (`amountBaselineMinSends`).
  3. **Otherwise no signal.** Missing data isn't evidence.
- **Why per recipient** (changed in S3): a global median mixes rent with family transfers. In
  holdout v1, a 400 USDC "emergency" to the sister (usually 40–60) passed, because rent payments
  pulled the global median up to 175.
- Sends with unknown signers are excluded, so forged history can't shift either baseline.
- This applies to trusted contacts too: a large, unusual payment to "your sister" is a classic
  social-engineering pattern.

## D12. Component tests render real CDS

- Vitest bundles `@coinbase/cds-*` (`server.deps.inline`), because CDS ships ESM with
  extensionless imports that Node's resolver rejects.
- Component tests render the real CDS components inside the same providers the app uses
  (`src/test/render.tsx`), not mocks.

## D13. Test-send follow-up

- SafeSend records the test sends it makes (`RiskInput.testSends`). A recorded test-send recipient
  is in the trust set, so the rest of the payment to the same address is ALLOWed. That changes if
  the address itself first appeared through planting (D10).
- **Any** lookalike of a test-send recipient that appears in history **after** the test send is
  high risk (BLOCK), whatever the amount or token. Attackers mirror the test amount ("1 USDC back")
  to look like a reply, so a dust threshold would miss them.
- **UI:** after a test send, the screen sends the rest to the remembered address or a contact,
  never to an address copied from history. The history list shows a caution banner, and
  after-test lookalikes are collapsed.

## D14. Trust and protection are separate sets

- **Trust set** (narrow, unchanged): contacts, signer-confirmed past recipients, and recorded test
  sends. It is the only path to ALLOW.
- **Protected set** (broader): the trust set plus **inbound senders** with at least
  `protectInboundMinTransfers` (default 1) canonical-USDC transfers to the user. Each transfer must
  be above the dust threshold, signed by the sender, and have verified provenance. Lookalikes are
  compared against this set.
- **Why:** people who pay you are people you'll pay back, so attackers imitate them (holdout v1
  case H-A16: a lookalike of her son). But receiving money from an address proves nothing about
  paying it, so inbound senders never become trusted for sending.
- An attacker can't buy protection cheaply. Dust doesn't count, and a protected attacker address
  only adds comparisons; it never adds trust.

## D15. Lookalike rule: "total ≥ 6, ≥ 2 each end" (shipped), 3/4 (previous)

- The rule is configurable (`RiskConfig.lookalike`) as either prefix/suffix minimums or a total
  with a per-end minimum.
- **History:** 3/4 shipped first. It matches the CMU criterion. The total rule was derived from the
  threat model (users often check only one end) and developed on the dev set.
- **Now shipped: total ≥ 6, ≥ 2 each end.** The product owner switched to it after holdout v2.
  - **What it catches:** 2/4, 2/5 and 4/2 lookalikes by their own signal. That includes V2-E05,
    which 3/4 stopped only because of the amount.
  - **Cost:** one extra middle-character WARN on a benign 2/4 overlap in v2.
  - **Collision rate:** about 1 in 5.8 million per protected address, versus 1 in 268 million for
    3/4 (RISK_MODEL.md).
- **Evaluation consequence:** v2 informed the switch, so v2 is no longer a clean holdout for the
  shipped rule. Future claims need a holdout v3 (EVAL.md).
- `eval/baseline.json` was re-recorded deliberately for the new rule. A unit test pins the shipped
  default.

## D16. Adding a contact is deliberate, and stricter for lookalikes

- **Every contact needs:** a name, the full address typed or pasted (never prefilled, never taken
  from history), and an explicit confirmation ("I got this address directly from <name>").
- **If the address resembles a protected address** (same rule as send time), the user must also
  type the full address a second time and confirm they verified it through another channel, like
  a phone call. The contact is recorded as `verifiedOutOfBand`.
- **From a BLOCK screen,** "This is a different person" opens the same form in its strictest mode,
  with nothing prefilled. Saving it **never** resumes, approves or retries the blocked send. The
  form is cleared, and the user starts a new send from contacts. That is the only way past a
  lookalike BLOCK, and it requires deliberate effort.
- Rules live in `src/risk/contacts.ts` (pure, unit-tested). The UI is in `src/components/Contacts/`.
  Demo contacts last for the session only. Persistence comes with live mode (S6).

## D17. The comparison is the hero

- **Order on BLOCK and lookalike WARN screens:** heading, then the comparison, then the recovery
  action, then the detailed reasons. The "why" comes before the "what".
- **Three layers, readable in two seconds:**
  1. A sentence: "Same start and end. Different middle."
  2. A 40-cell strip. Hollow cells mean same; solid cells mean different. **Shape, not only
     color**, carries the meaning, so it reads in grayscale and for color-blind users.
  3. The two addresses aligned in groups of 4, five groups per line, so it fits a phone without
     horizontal scrolling. Differing characters are bold, underlined and tinted.
- **Screen readers** get the sentence and a text description through `aria-describedby`. The
  strip and grid are `aria-hidden` duplicates.
- **WARN challenge positions** are outlined in the primary color, and also listed in text.

## D18. Group contacts instead of a higher first-send threshold (pasanaku)

- **Problem:** in a pasanaku (a Bolivian rotating savings group), Daniela pays a different, often
  new, member every month, with addresses shared in the group chat. Each payment is above the
  first-send threshold, so it got the strongest WARN every month: warning fatigue built into a
  normal habit (holdout v2 case V2-E06).
- **Rejected:** raising the first-send threshold. That would weaken protection for every new
  recipient, not just group members.
- **Decision:** "Add group" (for example "Pasanaku Mayo") lets the user add several members in one
  deliberate session.
  - Every member follows the D16 contact rules: full address entered (never prefilled), explicit
    confirmation, and re-entry plus out-of-band confirmation for a lookalike of a protected
    address.
  - **Members are also checked against each other.** Every earlier member with a valid address
    protects the later ones, even before that member is confirmed. A member who looks like another
    member needs re-entry and a phone check. The same address twice is rejected.
- **Effect:** members become ordinary contacts tagged with the group name, so monthly payments are
  ALLOWed. Grouping grants no extra trust: the group tag is a label, not a permission.
- **Rules:** `checkNewGroup` in `src/risk/contacts.ts` (unit-tested). **UI:**
  `src/components/Contacts/AddGroupForm.tsx`. **Demo:** the "Pasanaku" scenario, covered by e2e.

## D19. Accessibility: focus follows the journey, decisions are announced, motion is optional

- **Focus (WCAG 2.4.3).** Every user action that replaces the send panel moves focus to the new
  panel's heading: the decision, the add-contact and add-group forms, the "saved" notice and the
  sent screen. "Go back" returns focus to the recipient field. Panels are code-split (D20), so the
  helper (`focusWhenShown` in `src/components/a11y/focus.ts`) waits up to 3 seconds for the heading
  to appear instead of letting focus fall to `<body>`.
- **Announcements.** One polite live region (CDS `AccessibilityAnnouncer`) carries what the focused
  heading does not: the verdict and the reasons ("Blocked. This send cannot go ahead. This address
  imitates Lucía (sister)."), the simulated send result, and history load or failure after a user
  action. "Sending" is announced by the CDS Spinner, which is itself a status region, so it is not
  announced twice. Message text lives in `src/lib/announce.ts` (unit-tested).
- **Headings.** One `h1` per page and no skipped levels: the decision is an `h3` inside the "Send
  USDC" `h2`, and group members are `h4`. The scenario header stays on the sent screen. An e2e test
  checks the outline at each step.
- **Reduced motion (WCAG 2.3.3).** `<MotionConfig reducedMotion="user">` covers CDS's framer-motion
  animations. CDS also animates in CSS (Spinner, skeleton shimmer, press feedback), so
  `src/app/reduced-motion.css` stops those under `prefers-reduced-motion: reduce`. It is the only
  global CSS in the app: an exception to "CDS only", because no CDS prop covers it.
- **Tested:** `e2e/keyboard-journey.spec.ts` runs the full journey with the keyboard alone (Tab,
  Shift+Tab, Enter, Space, arrows, typing; no clicks): BLOCK and recovery, the WARN
  middle-character challenge, Add group, "This is a different person", and a history outage with
  retry. It also records what the live region said. `e2e/a11y.spec.ts` runs axe (WCAG 2.2 AA tags)
  in dark mode and in the loading, empty and error states. Both run on desktop and Pixel 7.
- **Not done:** no manual pass with a real screen reader (NVDA, VoiceOver) yet. The tests check
  roles, names, focus and live-region text, not how a given screen reader speaks them.

## D20. Performance: keep the icon font off the critical path

- **Measured** with Lighthouse 12 (mobile defaults: Moto G Power emulation, simulated slow 4G, 4×
  CPU), production build, on the development laptop.
- **Finding.** The CDS icon font is 275 KB, almost half the page weight. Any icon in the first
  render (the theme toggle, "+ Add contact") put it on the critical path, and Lighthouse charged it
  to FCP and LCP.
- **Decision.** No icon renders on first paint. The theme toggle is a text button ("Dark mode",
  accessible name "Switch to dark mode"; the visible text is inside the name, WCAG 2.5.3), and the
  Contacts buttons dropped their `+`. Icons still appear in banners and checkboxes, after a user
  action. The font is fetched when the browser is idle (`document.fonts.load` in
  `requestIdleCallback`), so it is normally cached before the first banner shows.
- **Also:** panels that only appear after a click (DecisionPanel, AddContactForm, AddGroupForm)
  are code-split and prefetched when idle. It saved only about 4.5 KB of first-load JS, because
  most of it is shared CDS code. The history result is applied in `startTransition`, so rendering
  the list is time-sliced. A favicon fixed the only best-practices failure (a 404).
- **Tried and rejected:**
  - `experimental.inlineCss`: FCP improved only from 2.7 to 2.4 s, and the HTML grew to 477 KB.
  - Suspense boundaries to split hydration: they delayed hydration enough that early clicks landed
    before React was attached (a native form submit, a radio that did not toggle).
- **Results.** The laptop's CPU speed varied by up to 4× between runs (Lighthouse `benchmarkIndex`
  from about 550 to 2,600), which moves Total Blocking Time and the score a lot. So the comparison
  that counts is an **interleaved A/B**: `main` and this branch served side by side, 5 runs each,
  alternating order, same machine state.

  | Page (median of 5)     | Build    | Perf | A11y | Best practices | FCP   | LCP   | TBT    |
  | ---------------------- | -------- | ---- | ---- | -------------- | ----- | ----- | ------ |
  | `/demo`                | baseline | 68   | 100  | 96             | 3.0 s | 4.8 s | 398 ms |
  | `/demo`                | S5       | 73   | 100  | 100            | 1.2 s | 3.7 s | 568 ms |
  | `/demo/dust-poisoning` | baseline | 62   | 100  | 96             | 2.7 s | 4.5 s | 801 ms |
  | `/demo/dust-poisoning` | S5       | 71   | 100  | 100            | 1.2 s | 3.7 s | 711 ms |
  - In a faster machine state (`benchmarkIndex` about 2,500), the S5 build scored a median of 90
    (`/demo`) and 91 (scenario).
  - **Performance is not reliably at 90 or above.** What remains is Total Blocking Time from
    hydrating React, Next and CDS. `/demo` TBT was higher on S5 in this sample (568 vs 398 ms);
    per-run differences were within the noise, so it is not proven either way.
  - **Next step:** re-measure with PageSpeed Insights on the deployed demo, which runs on
    consistent hardware, and decide then whether TBT needs more work.

## D21. History list: dense rows, details on demand, honest loading and error states

- **Before:** every transfer was a ~190 px card with its own "Use as recipient" button, so the page
  offered "copy an address from history" eleven times: the exact habit address poisoning exploits.
- **Now:** one ~80 px row per transfer (who, amount, when, provenance). Each row is a disclosure
  button (`aria-expanded`). The details (full address, signer, source, tx) and "Use as recipient"
  appear only for the row the user opens. Planted entries stay collapsed behind their explanation,
  as before. An entry from a suspicious origin that imitates nobody now gets an "Unusual origin"
  tag (the classification already existed but was not shown).
- **States:**
  - Loading: text ("Loading activity…") plus a skeleton hidden from assistive tech.
  - Empty: says what will appear there.
  - Error: says what it means for safety (lookalikes of contacts are blocked; past recipients
    cannot be checked, see known gap V2-C10) and offers "Try again".
- **Demo control:** "Simulate the activity source" (normal, slow, outage where the first load
  fails, no activity), so reviewers can see each state and try a send while history is
  unavailable. It is implemented in the fixture provider, not the UI.
