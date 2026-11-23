import type { Address } from 'viem';

/**
 * Base Sepolia only. Nothing in SafeSend points at mainnet.
 * Source for the USDC address: Circle, "USDC Contract Addresses", Testnet table
 * (developers.circle.com/stablecoins/usdc-contract-addresses), verified 2026-11-23.
 * See docs/DECISIONS.md.
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532 as const;

export const CANONICAL_USDC: Readonly<{
  address: Address;
  symbol: 'USDC';
  decimals: 6;
  chainId: typeof BASE_SEPOLIA_CHAIN_ID;
}> = {
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  symbol: 'USDC',
  decimals: 6,
  chainId: BASE_SEPOLIA_CHAIN_ID,
};

export const EXPLORER_BASE_URL = 'https://base-sepolia.blockscout.com' as const;
