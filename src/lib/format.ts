import type { Address } from 'viem';

/** How most wallets show addresses, and exactly what poisoning attacks imitate. */
export function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTime(unixSeconds: number | null): string {
  if (unixSeconds === null) return 'Time unknown';
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}
