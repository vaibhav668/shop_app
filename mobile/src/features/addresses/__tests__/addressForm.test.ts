import type { Address } from '@/api/addresses';
import {
  formatAddress,
  initialAddressState,
  isValidPincode,
  toAddressBody,
  validateAddress,
} from '@/features/addresses/addressForm';
import { resolveCheckoutAddress } from '@/features/addresses/hooks';

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: 'a1',
    label: 'Home',
    recipient_name: 'Asha Verma',
    phone: '9876543210',
    line1: 'Flat 12',
    line2: 'MG Road',
    landmark: null,
    city: 'Dehradun',
    state: 'Uttarakhand',
    pincode: '248001',
    is_default: false,
    is_serviceable: true,
    ...overrides,
  };
}

describe('isValidPincode', () => {
  it.each([
    ['248001', true],
    ['048001', false],
    ['24800', false],
    ['2480011', false],
    ['24800a', false],
  ])('%s → %s', (pin, ok) => expect(isValidPincode(pin)).toBe(ok));
});

describe('address form', () => {
  it('prefills the receiver from the profile for a new address', () => {
    const form = initialAddressState(undefined, { name: 'Asha', phone: '9876543210' });
    expect(form).toMatchObject({ label: 'Home', recipientName: 'Asha', phone: '9876543210' });
  });

  it('reports every missing or invalid field', () => {
    const errors = validateAddress(initialAddressState(undefined, { phone: '12345' }));
    expect(Object.keys(errors).sort()).toEqual(
      ['city', 'line1', 'phone', 'pincode', 'recipientName', 'state'].sort(),
    );
  });

  it('accepts a complete address and sends empty optionals as null', () => {
    const form = {
      ...initialAddressState(address(), {}),
      line2: '   ',
      landmark: '',
      city: ' Dehradun ',
    };
    expect(validateAddress(form)).toEqual({});
    expect(toAddressBody(form)).toMatchObject({ line2: null, landmark: null, city: 'Dehradun' });
  });

  it('formats one readable line', () => {
    expect(formatAddress(address({ landmark: 'Near the clock tower' }))).toBe(
      'Flat 12, MG Road, Near the clock tower, Dehradun 248001',
    );
    expect(formatAddress(address({ line2: null }))).toBe('Flat 12, Dehradun 248001');
  });
});

describe('resolveCheckoutAddress', () => {
  const home = address({ id: 'home', is_default: true });
  const work = address({ id: 'work', label: 'Work' });

  it('prefers the explicit choice, then the default, then the first', () => {
    expect(resolveCheckoutAddress([work, home], 'work')?.id).toBe('work');
    expect(resolveCheckoutAddress([work, home], null)?.id).toBe('home');
    expect(resolveCheckoutAddress([work, home], 'deleted')?.id).toBe('home');
    expect(resolveCheckoutAddress([work], null)?.id).toBe('work');
    expect(resolveCheckoutAddress([], null)).toBeNull();
    expect(resolveCheckoutAddress(undefined, 'work')).toBeNull();
  });
});
