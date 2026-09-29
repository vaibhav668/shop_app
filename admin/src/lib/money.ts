const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 4500 → "₹45", 4550 → "₹45.50". */
export function formatPaise(paise: number): string {
  return paise % 100 === 0 ? wholeRupees.format(paise / 100) : withPaise.format(paise / 100);
}

/** What the shopkeeper types ("45", "45.5", "1,200") → paise, or null if it isn't a price. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,]/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** paise → editable rupee text: 4500 → "45", 4550 → "45.50". */
export function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function discountPercent(pricePaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
