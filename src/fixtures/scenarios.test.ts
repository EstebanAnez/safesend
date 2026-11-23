import { describe, expect, it } from 'vitest';
import { compareAddresses } from '@/risk/compare';
import { PEOPLE, SCENARIOS } from './scenarios';

describe('fixture scenarios', () => {
  it('uses distinct synthetic addresses', () => {
    const all = Object.values(PEOPLE).map((a) => a.toLowerCase());
    expect(new Set(all).size).toBe(all.length);
  });

  it('builds the lookalike to match Lucía on 4 leading and 4 trailing characters', () => {
    const c = compareAddresses(PEOPLE.luciaLookalike, PEOPLE.lucia);
    expect(c.prefixMatchLength).toBe(4);
    expect(c.suffixMatchLength).toBe(4);
  });

  it('has unique entry ids in every scenario', () => {
    for (const s of Object.values(SCENARIOS)) {
      const ids = s.history.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
