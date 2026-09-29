/** Same rule as the backend: a 10-digit Indian mobile number starting 6–9. */
export function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

/** Keeps only digits and drops a leading +91 / 0 that people often type. */
export function normalisePhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2, 12);
  if (digits.length > 10 && digits.startsWith('0')) return digits.slice(1, 11);
  return digits.slice(0, 10);
}
