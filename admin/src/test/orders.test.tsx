import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { AdminOrderDetail, AdminOrderRow, Dashboard } from '@/api/orders';
import { isNewer } from '@/features/orders/useNewOrderAlert';

import { authOk, mockApi, renderApp } from './renderApp';

const PLACED = '2026-10-02T05:30:00Z';

function row(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
  return {
    id: 'o1',
    order_number: 10042,
    status: 'PENDING',
    payment_method: 'COD',
    payment_status: 'PENDING',
    total_paise: 26000,
    item_count: 2,
    placed_at: PLACED,
    customer_name: 'Asha Verma',
    customer_phone: '9876543210',
    delivery_area: 'Rajpur Road, 248001',
    ...overrides,
  };
}

function detail(overrides: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  return {
    ...row(),
    first_item_images: [],
    items: [
      {
        product_id: 'p1',
        name: 'Toor Dal',
        unit_label: '500 g',
        image_url: null,
        unit_price_paise: 12000,
        mrp_paise: 13000,
        quantity: 2,
        line_total_paise: 24000,
      },
    ],
    subtotal_paise: 24000,
    delivery_fee_paise: 2000,
    discount_paise: 0,
    delivery_address: {
      name: 'Asha Verma',
      phone: '9876543210',
      line1: 'Flat 12',
      line2: 'Rajpur Road',
      landmark: null,
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    customer_note: 'Ring twice',
    timeline: [{ status: 'PENDING', at: PLACED }],
    can_cancel: true,
    cancel_reason: null,
    customer: { id: 'u1', name: 'Asha Verma', email: 'asha@example.com', phone: '9876543210' },
    history: [
      {
        from_status: null,
        to_status: 'PENDING',
        at: PLACED,
        actor: 'CUSTOMER',
        actor_name: 'Asha Verma',
        note: null,
      },
    ],
    next_statuses: ['CONFIRMED', 'CANCELLED'],
    ...overrides,
  };
}

const page = (items: AdminOrderRow[]) => ({
  status: 200,
  body: { items, total: items.length, limit: 20, offset: 0 },
});
const summary = (pending = 0, latest: string | null = null) => ({
  status: 200,
  body: { pending_count: pending, latest_order_at: latest },
});

afterEach(() => {
  document.title = 'Bada Bazar · Admin';
});

describe('isNewer', () => {
  it('only fires after the first load, for a later order', () => {
    expect(isNewer(PLACED, undefined)).toBe(false); // first load: orders already waiting
    expect(isNewer(PLACED, null)).toBe(true); // first ever order
    expect(isNewer('2026-10-02T05:31:00Z', PLACED)).toBe(true);
    expect(isNewer(PLACED, PLACED)).toBe(false);
    expect(isNewer(null, PLACED)).toBe(false);
  });
});

describe('orders page', () => {
  it('opens on New orders and lists them', async () => {
    const fetchMock = mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': summary(1, PLACED),
      '/admin/orders': page([row()]),
    });
    renderApp('/orders');

    const r = (await screen.findByText('#10042')).closest('tr')!;
    expect(within(r).getByText('Asha Verma')).toBeInTheDocument();
    expect(within(r).getByText('Rajpur Road, 248001')).toBeInTheDocument();
    expect(within(r).getByText('₹260')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'New' })).toHaveAttribute('aria-selected', 'true');
    const listCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/admin/orders?'));
    expect(String(listCall![0])).toContain('status=PENDING');
  });

  it('accepts an order from the drawer', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': summary(1, PLACED),
      '/admin/orders': page([row()]),
      'GET /admin/orders/o1': { status: 200, body: detail() },
      'PATCH /admin/orders/o1/status': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return {
          status: 200,
          body: detail({ status: 'CONFIRMED', next_statuses: ['PREPARING', 'CANCELLED'] }),
        };
      },
    });
    const user = userEvent.setup();
    renderApp('/orders');

    await user.click(await screen.findByRole('button', { name: '#10042' }));
    expect(await screen.findByText('Ring twice')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept order' }));
    await waitFor(() => expect(sent).toEqual({ to_status: 'CONFIRMED', note: null }));
    expect(await screen.findByRole('button', { name: 'Start packing' })).toBeInTheDocument();
  });

  it('asks for a reason before cancelling', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': summary(),
      '/admin/orders': page([row()]),
      'GET /admin/orders/o1': { status: 200, body: detail() },
      'PATCH /admin/orders/o1/status': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return {
          status: 200,
          body: detail({
            status: 'CANCELLED',
            next_statuses: [],
            cancel_reason: 'Item out of stock',
          }),
        };
      },
    });
    const user = userEvent.setup();
    renderApp('/orders?order=o1');

    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    expect(within(dialog).getByText('Tell the customer why.')).toBeInTheDocument();
    expect(sent).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Item out of stock' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() =>
      expect(sent).toEqual({ to_status: 'CANCELLED', note: 'Item out of stock' }),
    );
    expect(await screen.findByText('Cancelled: Item out of stock')).toBeInTheDocument();
  });

  it('shows waiting orders in the sidebar and the tab title', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': summary(3, PLACED),
      '/admin/orders': page([]),
    });
    renderApp('/orders');
    expect(await screen.findByLabelText('3 waiting')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('(3) Bada Bazar · Admin'));
    expect(screen.getByText('No new orders right now.')).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  it("shows today's numbers, the pipeline and low stock", async () => {
    const board: Dashboard = {
      today_orders: 7,
      today_revenue_paise: 184000,
      status_counts: { PENDING: 2, CONFIRMED: 1, PREPARING: 0, OUT_FOR_DELIVERY: 1 },
      low_stock: [
        { id: 'p1', name: 'Amul Butter', unit_label: '100 g', stock_quantity: 0, threshold: 5 },
        { id: 'p2', name: 'Bread', unit_label: '400 g', stock_quantity: 3, threshold: 5 },
      ],
      recent_orders: [row()],
    };
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': summary(2, PLACED),
      '/admin/dashboard': { status: 200, body: board },
    });
    renderApp('/');

    expect(await screen.findByText('₹1,840')).toBeInTheDocument();
    expect(screen.getByText('7 orders today')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2\s*New/ })).toHaveAttribute('href', '/orders');
    expect(screen.getByText('Out')).toBeInTheDocument();
    expect(screen.getByText('3 left')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /#10042/ })).toHaveAttribute(
      'href',
      '/orders?status=all&order=o1',
    );
  });
});
