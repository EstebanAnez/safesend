import { formatUnits, parseUnits } from 'viem';
import { CANONICAL_USDC } from '@/config/chain';

export type AmountParseResult =
  | { ok: true; value: bigint }
  | { ok: false; error: 'empty' | 'not-a-number' | 'too-many-decimals' | 'not-positive' };

const DECIMAL = /^\d+(\.\d+)?$/;

/** Parses a user-typed USDC amount ("50", "50.5", "0.000001") into base units. */
export function parseUsdcAmount(raw: string): AmountParseResult {
  const input = raw.trim().replace(/,/g, '');
  if (input.length === 0) return { ok: false, error: 'empty' };
  if (!DECIMAL.test(input)) return { ok: false, error: 'not-a-number' };
  const decimals = input.split('.')[1]?.length ?? 0;
  if (decimals > CANONICAL_USDC.decimals) return { ok: false, error: 'too-many-decimals' };
  const value = parseUnits(input, CANONICAL_USDC.decimals);
  if (value <= 0n) return { ok: false, error: 'not-positive' };
  return { ok: true, value };
}

/** "50", "0.001", "1,250.5". Never rounds: dust must stay visible as dust. */
export function formatUsdc(value: bigint): string {
  const [whole = '0', fraction] = formatUnits(value, CANONICAL_USDC.decimals).split('.');
  const grouped = BigInt(whole).toLocaleString('en-US');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

export const AMOUNT_ERROR_TEXT: Record<Exclude<AmountParseResult, { ok: true }>['error'], string> =
  {
    empty: 'Enter an amount.',
    'not-a-number': 'Use numbers only, for example 50 or 12.5.',
    'too-many-decimals': 'USDC has at most 6 decimal places.',
    'not-positive': 'The amount must be more than 0.',
  };
