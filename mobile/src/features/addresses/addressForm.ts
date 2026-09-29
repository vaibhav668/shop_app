import type { Address, AddressCreate } from '@/api/addresses';
import { isValidIndianMobile } from '@/lib/validation';

export type AddressFormState = {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
};

export type AddressErrors = Partial<Record<keyof AddressFormState, string>>;

export const LABEL_PRESETS = ['Home', 'Work', 'Other'] as const;

/** Same rule as the backend: six digits, never starting with 0. */
export function isValidPincode(value: string): boolean {
  return /^[1-9]\d{5}$/.test(value);
}

export function initialAddressState(
  address: Address | undefined,
  defaults: { name?: string; phone?: string | null },
): AddressFormState {
  return {
    label: address?.label ?? 'Home',
    recipientName: address?.recipient_name ?? defaults.name ?? '',
    phone: address?.phone ?? defaults.phone ?? '',
    line1: address?.line1 ?? '',
    line2: address?.line2 ?? '',
    landmark: address?.landmark ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    pincode: address?.pincode ?? '',
  };
}

export function validateAddress(form: AddressFormState): AddressErrors {
  const errors: AddressErrors = {};
  if (!form.label.trim()) errors.label = 'Give this address a name, like Home';
  if (!form.recipientName.trim()) errors.recipientName = "Enter the receiver's name";
  if (!isValidIndianMobile(form.phone)) errors.phone = 'Enter a 10-digit mobile number';
  if (!form.line1.trim()) errors.line1 = 'Enter the house or flat number';
  if (!form.city.trim()) errors.city = 'Enter the city';
  if (!form.state.trim()) errors.state = 'Enter the state';
  if (!isValidPincode(form.pincode)) errors.pincode = 'Enter a 6-digit PIN code';
  return errors;
}

/** Trimmed request body. Empty optional lines are sent as null so they clear on edit. */
export function toAddressBody(form: AddressFormState): Omit<AddressCreate, 'is_default'> {
  return {
    label: form.label.trim(),
    recipient_name: form.recipientName.trim(),
    phone: form.phone,
    line1: form.line1.trim(),
    line2: form.line2.trim() || null,
    landmark: form.landmark.trim() || null,
    city: form.city.trim(),
    state: form.state.trim(),
    pincode: form.pincode,
  };
}

/** One line for lists and the checkout card: "Flat 12, MG Road, Dehradun 248001". */
export function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.landmark, `${a.city} ${a.pincode}`].filter(Boolean).join(', ');
}
