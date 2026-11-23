import { describe, expect, it } from 'vitest';
import { formatUsdc, parseUsdcAmount } from './amount';

describe('parseUsdcAmount', () => {
  it.each([
    ['50', 50_000_000n],
    ['12.5', 12_500_000n],
    ['0.000001', 1n],
    ['1,250', 1_250_000_000n],
  ])('parses %s', (raw, value) => {
    expect(parseUsdcAmount(raw)).toEqual({ ok: true, value });
  });

  it.each([
    ['', 'empty'],
    ['abc', 'not-a-number'],
    ['-5', 'not-a-number'],
    ['1.0000001', 'too-many-decimals'],
    ['0', 'not-positive'],
  ] as const)('rejects %j as %s', (raw, error) => {
    expect(parseUsdcAmount(raw)).toEqual({ ok: false, error });
  });
});

describe('formatUsdc', () => {
  it('never rounds dust away', () => {
    expect(formatUsdc(1_000n)).toBe('0.001');
    expect(formatUsdc(1_250_500_000n)).toBe('1,250.5');
    expect(formatUsdc(50_000_000n)).toBe('50');
  });
});
