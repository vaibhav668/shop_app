import { isValidIndianMobile, normalisePhoneInput } from '@/lib/validation';

describe('isValidIndianMobile', () => {
  it.each(['9876543210', '6000000000'])('accepts %s', (n) => {
    expect(isValidIndianMobile(n)).toBe(true);
  });
  it.each(['5876543210', '987654321', '98765432101', ''])('rejects %s', (n) => {
    expect(isValidIndianMobile(n)).toBe(false);
  });
});

describe('normalisePhoneInput', () => {
  it.each([
    ['+91 98765 43210', '9876543210'],
    ['09876543210', '9876543210'],
    ['98765-43210', '9876543210'],
    ['98765', '98765'],
  ])('%s → %s', (input, expected) => {
    expect(normalisePhoneInput(input)).toBe(expected);
  });
});
