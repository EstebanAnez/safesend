import type { Address } from 'viem';

/**
 * Canonical ERC-4337 EntryPoint deployments (same address on every chain).
 * Source: eth-infinitism/account-abstraction GitHub releases ("EntryPoint 0.6
 * address", "0.7", "0.8", "v0.9"), checked 2026-11-23. Each one is a verified
 * contract named "EntryPoint" on base-sepolia.blockscout.com, and its verified
 * ABI declares the identical UserOperationEvent and BeforeExecution events.
 * See docs/DECISIONS.md D5.
 *
 * Anyone can deploy a contract that emits an event with the same signature, so
 * only logs emitted BY one of these addresses are trusted.
 */
export const CANONICAL_ENTRYPOINTS: readonly { version: string; address: Address }[] = [
  { version: '0.6', address: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' },
  { version: '0.7', address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' },
  { version: '0.8', address: '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108' },
  { version: '0.9', address: '0x433709009B8330FDa32311DF1C2AFA402eD8D009' },
];
