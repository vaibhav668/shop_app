import { discountPercent, formatPaise } from '@/lib/money';

describe('formatPaise', () => {
  it('drops paise for whole rupees', () => {
    expect(formatPaise(4500)).toBe('₹45');
  });

  it('always shows two decimals when there are paise', () => {
    expect(formatPaise(4550)).toBe('₹45.50');
    expect(formatPaise(4505)).toBe('₹45.05');
  });

  it('uses Indian digit grouping', () => {
    expect(formatPaise(12345600)).toBe('₹1,23,456');
  });
});

describe('discountPercent', () => {
  it('rounds down to a whole percent', () => {
    expect(discountPercent(4500, 5000)).toBe(10);
    expect(discountPercent(5450, 6000)).toBe(9);
  });

  it('is zero when there is no discount', () => {
    expect(discountPercent(5000, 5000)).toBe(0);
    expect(discountPercent(5000, 0)).toBe(0);
  });
});
