import type { RiskResult } from '@/risk/types';
import { formatUsdc } from './amount';

/**
 * Screen-reader announcements (polite live region). Focus moves to the panel
 * heading on each step, so these carry what the heading does not: the reasons.
 */
export function decisionAnnouncement(result: RiskResult): string {
  const verdict =
    result.decision === 'BLOCK'
      ? 'Blocked. This send cannot go ahead.'
      : result.decision === 'WARN'
        ? 'Check needed before you send.'
        : 'Ready to send.';
  // On a BLOCK only the blocking reasons are read, as on screen (other signals are folded away).
  const shown =
    result.decision === 'BLOCK'
      ? result.reasons.filter((r) => r.severity === 'block')
      : result.reasons;
  const reasons = shown.map((r) => r.title).join('. ');
  return reasons ? `${verdict} ${reasons}.` : verdict;
}

export function sentAnnouncement(amount: bigint, to: string, test: boolean): string {
  return test
    ? `Test send complete (simulated): ${formatUsdc(amount)} USDC to ${to}.`
    : `Simulated send complete: ${formatUsdc(amount)} USDC to ${to}. Nothing was signed or broadcast.`;
}
