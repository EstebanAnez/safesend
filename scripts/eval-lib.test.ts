import { describe, expect, it } from 'vitest';
import { caughtAt, regressions } from './eval-lib';
import type { BaselineEntry } from './eval-lib';

describe('caughtAt', () => {
  it('counts a checkbox WARN only as "flagged", never as strong friction', () => {
    expect(caughtAt('WARN_CHECKBOX', 'flagged')).toBe(true);
    expect(caughtAt('WARN_CHECKBOX', 'strong')).toBe(false);
    expect(caughtAt('WARN_STRONG', 'strong')).toBe(true);
    expect(caughtAt('WARN_STRONG', 'blocked')).toBe(false);
    expect(caughtAt('BLOCK', 'blocked')).toBe(true);
    expect(caughtAt('ALLOW', 'flagged')).toBe(false);
  });
});

describe('regressions', () => {
  const base: BaselineEntry = {
    setting: '3/4',
    tp: { blocked: 14, strong: 17, flagged: 20 },
    fp: { blocked: 1, strong: 7, flagged: 11 },
  };
  it('passes when nothing got worse', () => {
    expect(regressions(base, base)).toEqual([]);
  });
  it('fails on fewer attacks caught or more legit sends flagged, at any level', () => {
    const worse: BaselineEntry = {
      ...base,
      tp: { ...base.tp, blocked: 13 },
      fp: { ...base.fp, strong: 8 },
    };
    expect(regressions(worse, base)).toHaveLength(2);
  });
});
