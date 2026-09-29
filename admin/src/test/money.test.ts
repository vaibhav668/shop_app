import { describe, expect, it } from 'vitest';

import { discountPercent, formatPaise, paiseToInput, parseRupees } from '@/lib/money';

describe('parseRupees', () => {
  it.each([
    ['45', 4500],
    ['45.5', 4550],
    ['45.05', 4505],
    ['₹ 1,200', 120000],
    ['0.99', 99],
  ])('%s → %i paise', (input, paise) => {
    expect(parseRupees(input)).toBe(paise);
  });

  it.each(['', 'abc', '45.555', '-5', '4 5'])('rejects %j', (input) => {
    expect(parseRupees(input)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats paise for display and editing', () => {
    expect(formatPaise(4500)).toBe('₹45');
    expect(formatPaise(4550)).toBe('₹45.50');
    expect(paiseToInput(4500)).toBe('45');
    expect(paiseToInput(4550)).toBe('45.50');
  });

  it('computes whole-percent discounts', () => {
    expect(discountPercent(4500, 5000)).toBe(10);
    expect(discountPercent(5000, 5000)).toBe(0);
  });
});
