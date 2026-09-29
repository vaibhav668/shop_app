import type { ShopSettings, ShopSettingsUpdate } from '@/api/settings';
import { paiseToInput, parseRupees } from '@/lib/money';

export type FormState = {
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  isAcceptingOrders: boolean;
  closedMessage: string;
  deliveryFee: string;
  freeDeliveryAbove: string;
  minOrder: string;
  pincodes: string[];
  codEnabled: boolean;
  onlineEnabled: boolean;
  lowStockThreshold: string;
};

export type Errors = Partial<Record<keyof FormState, string>>;

const MAX_FEE_PAISE = 1_000_000;

export function initialState(s: ShopSettings): FormState {
  return {
    shopName: s.shop_name,
    shopPhone: s.shop_phone ?? '',
    shopAddress: s.shop_address ?? '',
    isAcceptingOrders: s.is_accepting_orders,
    closedMessage: s.closed_message,
    deliveryFee: paiseToInput(s.delivery_fee_paise),
    freeDeliveryAbove: paiseToInput(s.free_delivery_above_paise),
    minOrder: paiseToInput(s.min_order_paise),
    pincodes: s.serviceable_pincodes,
    codEnabled: s.cod_enabled,
    onlineEnabled: s.online_payment_enabled,
    lowStockThreshold: String(s.default_low_stock_threshold),
  };
}

/** Splits pasted or typed text ("248001, 248002 248003") into PIN codes; reports bad ones. */
export function parsePincodes(input: string): { valid: string[]; invalid: string[] } {
  const parts = input.split(/[\s,;]+/).filter(Boolean);
  return {
    valid: parts.filter((p) => /^[1-9]\d{5}$/.test(p)),
    invalid: parts.filter((p) => !/^[1-9]\d{5}$/.test(p)),
  };
}

export function addPincodes(current: string[], added: string[]): string[] {
  return [...new Set([...current, ...added])].sort();
}

const fee = (value: string) => {
  const paise = parseRupees(value);
  return paise !== null && paise <= MAX_FEE_PAISE ? paise : null;
};

export function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.shopName.trim()) errors.shopName = 'Enter the shop name.';
  if (form.shopPhone.trim() && !/^\+?[0-9 -]{8,16}$/.test(form.shopPhone.trim())) {
    errors.shopPhone = 'Enter a phone number, e.g. 98765 43210.';
  }
  if (!form.closedMessage.trim()) errors.closedMessage = 'Customers see this while you are closed.';
  if (fee(form.deliveryFee) === null) errors.deliveryFee = 'Enter an amount like 20, or 0.';
  if (fee(form.freeDeliveryAbove) === null) {
    errors.freeDeliveryAbove = 'Enter an amount like 299.';
  }
  if (fee(form.minOrder) === null) errors.minOrder = 'Enter an amount like 99, or 0.';
  if (!form.codEnabled && !form.onlineEnabled) {
    errors.codEnabled =
      'Keep at least one payment method on. To pause orders, use the switch above.';
  }
  const threshold = form.lowStockThreshold.trim();
  if (!/^\d+$/.test(threshold) || Number(threshold) > 1000) {
    errors.lowStockThreshold = 'A whole number between 0 and 1000.';
  }
  return errors;
}

/** Only what changed, so saving never overwrites a field someone else just edited. */
export function changes(form: FormState, saved: ShopSettings): ShopSettingsUpdate {
  const next: Required<ShopSettingsUpdate> = {
    shop_name: form.shopName.trim(),
    shop_phone: form.shopPhone.trim() || null,
    shop_address: form.shopAddress.trim() || null,
    is_accepting_orders: form.isAcceptingOrders,
    closed_message: form.closedMessage.trim(),
    delivery_fee_paise: parseRupees(form.deliveryFee),
    free_delivery_above_paise: parseRupees(form.freeDeliveryAbove),
    min_order_paise: parseRupees(form.minOrder),
    serviceable_pincodes: form.pincodes,
    cod_enabled: form.codEnabled,
    online_payment_enabled: form.onlineEnabled,
    payment_timeout_minutes: saved.payment_timeout_minutes,
    default_low_stock_threshold: Number(form.lowStockThreshold.trim()),
  };
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    const before = saved[key as keyof ShopSettings];
    if (JSON.stringify(value) !== JSON.stringify(before)) update[key] = value;
  }
  return update as ShopSettingsUpdate;
}
