import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '@/risk/evaluate';
import { contact, dustFrom, lookalikeOf, riskInput, SISTER } from '@/test/builders';
import { decisionAnnouncement, sentAnnouncement } from './announce';

describe('announcements', () => {
  it('a BLOCK says it cannot go ahead and names the reason', () => {
    const look = lookalikeOf(SISTER, 5, 5);
    const result = evaluateRisk(
      riskInput(look, {
        amount: 50_000_000n,
        anchors: [{ kind: 'contact', address: SISTER, contact: contact('Lucía', SISTER) }],
        history: [dustFrom(look)],
      }),
    );
    expect(result.decision).toBe('BLOCK');
    const text = decisionAnnouncement(result);
    expect(text).toMatch(/^Blocked\. This send cannot go ahead\. /);
    expect(text).toContain('imitates Lucía');
    // Secondary signals are not read out on a BLOCK.
    expect(text).not.toMatch(/First send/);
  });

  it('send status always says it was simulated', () => {
    expect(sentAnnouncement(50_000_000n, 'Lucía', false)).toMatch(
      /^Simulated send complete: 50 USDC to Lucía\. Nothing was signed or broadcast\.$/,
    );
    expect(sentAnnouncement(1_000_000n, 'the address you tested', true)).toBe(
      'Test send complete (simulated): 1 USDC to the address you tested.',
    );
  });
});
