import { describe, expect, it } from 'vitest';
import { contact, lookalikeOf, SISTER } from '@/test/builders';
import { buildNameBook, displayAddress, nameFor } from './names';

describe('name book (D24)', () => {
  it('names an address only on an exact full-address match, in any letter case', () => {
    const book = buildNameBook([contact('Lucía', SISTER)]);
    expect(nameFor(SISTER, book)).toBe('Lucía');
    expect(nameFor(SISTER.toLowerCase() as typeof SISTER, book)).toBe('Lucía');
    // A lookalike shares the ends but never the name.
    expect(nameFor(lookalikeOf(SISTER, 5, 5), book)).toBeNull();
  });

  it("a contact's name wins over a wallet label for the same address", () => {
    const book = buildNameBook([contact('Lucía (sister)', SISTER)], { [SISTER]: 'Old label' });
    expect(nameFor(SISTER, book)).toBe('Lucía (sister)');
  });
});

describe('displayAddress', () => {
  it('shows first 4, middle 4 (hex positions 19–22) and last 4 hex characters', () => {
    expect(displayAddress('0x7A3f9C21E4B8d05f6a1C3e9b2d47F80a5c16e4d2')).toBe('0x7A3f…1C3e…e4d2');
  });

  it('a lookalike that matches only the ends does not share the short form', () => {
    for (const [p, s] of [
      [4, 4],
      [5, 5],
      [8, 8],
    ] as const) {
      expect(displayAddress(lookalikeOf(SISTER, p, s))).not.toBe(displayAddress(SISTER));
    }
  });
});
