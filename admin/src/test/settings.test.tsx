import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ShopSettings } from '@/api/settings';
import {
  addPincodes,
  changes,
  initialState,
  parsePincodes,
  validate,
} from '@/features/settings/settingsForm';

import { authOk, mockApi, renderApp } from './renderApp';

function settings(overrides: Partial<ShopSettings> = {}): ShopSettings {
  return {
    shop_name: 'Bada Bazar',
    shop_phone: null,
    shop_address: null,
    is_accepting_orders: true,
    closed_message: "We're closed right now. Back tomorrow at 8 AM.",
    delivery_fee_paise: 2000,
    free_delivery_above_paise: 29900,
    min_order_paise: 9900,
    serviceable_pincodes: ['248001'],
    empty_pincodes_accept_all: false,
    cod_enabled: true,
    online_payment_enabled: true,
    payment_timeout_minutes: 15,
    default_low_stock_threshold: 5,
    updated_at: null,
    ...overrides,
  };
}

describe('settings form helpers', () => {
  it('parses pasted PIN codes and reports the bad ones', () => {
    expect(parsePincodes('248001, 248002;248003  12345 048001')).toEqual({
      valid: ['248001', '248002', '248003'],
      invalid: ['12345', '048001'],
    });
    expect(addPincodes(['248002'], ['248001', '248002'])).toEqual(['248001', '248002']);
  });

  it('sends only the fields that changed', () => {
    const saved = settings();
    const form = { ...initialState(saved), deliveryFee: '25', shopPhone: ' ' };
    expect(changes(form, saved)).toEqual({ delivery_fee_paise: 2500 });
    expect(changes(initialState(saved), saved)).toEqual({});
  });

  it('requires a payment method and sane amounts', () => {
    const form = {
      ...initialState(settings()),
      codEnabled: false,
      onlineEnabled: false,
      minOrder: 'abc',
      lowStockThreshold: '-1',
    };
    expect(Object.keys(validate(form)).sort()).toEqual([
      'codEnabled',
      'lowStockThreshold',
      'minOrder',
    ]);
  });
});

describe('settings page', () => {
  it('shows the delivery rules in plain words', async () => {
    mockApi({ '/auth/refresh': authOk(), '/admin/settings': { status: 200, body: settings() } });
    renderApp('/settings');
    expect(
      await screen.findByText(
        "Orders start at ₹99. Orders below ₹299 pay ₹20 delivery; from ₹299 it's free.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('adds and removes PIN codes, then saves only the changes', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': authOk(),
      'GET /admin/settings': { status: 200, body: settings() },
      'PATCH /admin/settings': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return {
          status: 200,
          body: settings({ ...sent, updated_at: '2026-10-01T10:00:00Z' } as Partial<ShopSettings>),
        };
      },
    });
    const user = userEvent.setup();
    renderApp('/settings');

    await user.type(await screen.findByLabelText('Add PIN codes'), '248003 12{Enter}');
    expect(screen.getByText('Not a PIN code: 12')).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'Delivery PIN codes' });
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['248001', '248003']);
    await user.click(screen.getByRole('button', { name: 'Remove 248001' }));
    await user.click(screen.getByRole('switch', { name: /Accepting orders/ }));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(sent).toEqual({ is_accepting_orders: false, serviceable_pincodes: ['248003'] }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Saved.');
  });

  it('warns when no PIN codes are set', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/settings': { status: 200, body: settings({ serviceable_pincodes: [] }) },
    });
    renderApp('/settings');
    expect(await screen.findByText(/no address can be delivered to/)).toBeInTheDocument();
  });

  it('shows the server message when saving fails', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      'GET /admin/settings': { status: 200, body: settings() },
      'PATCH /admin/settings': {
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', message: 'Some fields are invalid.' } },
      },
    });
    const user = userEvent.setup();
    renderApp('/settings');
    const fee = await screen.findByLabelText('Delivery fee');
    await user.clear(fee);
    await user.type(fee, '30');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Some fields are invalid.')).toBeInTheDocument();
  });
});
