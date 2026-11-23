# Decisions

Short records of choices that a reviewer might question. Newest last.

## D1. Start from the official CDS Next.js template

- **What:** Bootstrapped with `npx -y gitpick coinbase/cds/tree/master/templates/next-app .`
  (CDS web 9.30.1, Next.js 15.4.8, React 19.1.2). Removed the template's sample screens
  (asset list, staking cards, sidebar).
- **Why:** Same component system and tokens Coinbase product teams use, instead of
  re-creating them with custom CSS.

## D2. npm with two scoped peer overrides

- **What:** The template assumes yarn. We use npm (`npm run eval` etc.) and add
  `overrides` that let `framer-motion@10` and `@react-spring/web@9` (both required by
  `@coinbase/cds-web@9`) accept React 19 as a peer.
- **Why:** Both packages declare React ≤18 peers, which yarn only warns about but npm
  rejects. The overrides are scoped to those two packages, so peer checks stay on for
  everything else (no global `legacy-peer-deps`). The app builds and the e2e suite passes on
  React 19.
- **Revisit when:** CDS publishes a release with a React 19 peer range.

## D3. Canonical USDC on Base Sepolia

- **Address:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals, chain id 84532.
- **Source:** Circle, "USDC Contract Addresses", Testnet table, row "Base Sepolia"
  (<https://developers.circle.com/stablecoins/usdc-contract-addresses>), checked 2026-11-23.
  Cross-checked on Blockscout (`/api/v2/tokens/<address>`: symbol `USDC`, decimals `6`).
- **Where:** `src/config/chain.ts` is the only place it is defined.

## D4. Blockscout as the explorer provider

- **What:** `https://base-sepolia.blockscout.com/api/v2` (address token transfers, tokens,
  transactions).
- **Checked 2026-11-23:** works without an API key (HTTP 200).
- **Caveat:** rate limits are not documented. The provider must handle HTTP 429 and fall back to
  the RPC provider, and the UI must label that coverage as partial.

## D5. "Who signed it" with Coinbase Smart Wallet (proposed, implemented in S2/S6)

- **Problem:** The policy says a past send only counts as a trust anchor when the user signed the
  transaction. A Coinbase Smart Wallet is an ERC-4337 account. Its transactions are submitted by a
  bundler, so `tx.from` is the bundler's EOA, not the user.
- **Decision:** A send is confirmed when either
  1. `tx.from` equals the user's address (EOA wallets), or
  2. the transaction includes an EntryPoint `UserOperationEvent` with `sender` equal to the user's
     smart account, and the USDC Transfer was emitted during that user operation.
- **Why it's still safe:** zero-value poisoning is a `transferFrom(victim, lookalike, 0)` call
  the attacker submits. `tx.from` is the attacker and there is no user operation from the victim,
  so it fails both checks.
- **Encoded as:** `TxSigner.via: 'tx-from' | 'user-operation'` in `src/domain/types.ts`.

## D6. Architecture rules are enforced by lint, not convention

- `src/risk/**` cannot import React, Next, wagmi, TanStack, hooks, components or providers, and
  cannot use `fetch`/`window`/`document`/`localStorage`.
- `src/components/**` and `src/app/**` cannot import `src/providers/**`, `wagmi/actions` or
  `viem/actions`, and cannot call `fetch`. They go through hooks in `src/hooks/`.
- `any` is a lint error. See `eslint.config.mjs`.

## D7. Address input rules

- Trim surrounding whitespace and require the `0x` prefix plus 40 hex chars.
- All-lowercase or all-uppercase hex is accepted. Mixed case must be a valid EIP-55 checksum,
  otherwise it is rejected (never silently "corrected").
- Normalized with viem `getAddress`. Comparisons are case-insensitive on hex.
- Implemented in `src/risk/address.ts` with unit tests.

## D8. A first send to a new address is WARN, not ALLOW (open for review)

- **What:** A valid recipient that is not a trust anchor and doesn't look like one gets WARN
  (`NEW_RECIPIENT`). Above the first-send threshold it gets `NEW_RECIPIENT_LARGE_AMOUNT` with the
  test-send advice.
- **Why:** The policy defines ALLOW as "a trusted contact or confirmed past recipient with no risk
  signals". A new address is neither. The cost is one deliberate confirmation (type the last 4
  characters) on the first send to someone.
- **Trade-off:** This adds friction to every first send. The alternative is ALLOW below the
  threshold. The false-warning rate on legitimate sends in S3 will show what this costs.

## D9. No uppercase text styles anywhere an address or hash can appear

- CDS `caption` and `legal` fonts apply `text-transform: uppercase`, which rendered `0x7a3f…`
  as `0X7A3F…`. In an app whose job is reading addresses exactly, that is a correctness bug, not a
  style choice. Metadata uses `label2`, and an e2e test asserts `text-transform: none`.
- CDS `Banner` clamps string children to 3 lines. Reasons are passed as `Text` nodes so an
  explanation is never cut off mid-sentence (also covered by e2e).
