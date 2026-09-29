import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { AdminProduct } from '@/api/catalog';
import {
  applyResult,
  isChanged,
  keepMine,
  type QuickRow,
  takeCurrent,
  toUpdates,
  validateRows,
} from '@/features/inventory/quickStock';

import { authOk, mockApi, renderApp } from './renderApp';

function quick(id: string, base: number, draft = String(base)): QuickRow {
  return { id, name: id, unitLabel: '1 L', base, draft, conflict: null, error: null };
}

function product(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: 'p1',
    category_id: 'c1',
    category_name: 'Dairy',
    name: 'Milk',
    slug: 'milk',
    description: null,
    unit_label: '1 L',
    price_paise: 6800,
    mrp_paise: 6800,
    stock_quantity: 10,
    low_stock_threshold: null,
    max_per_order: null,
    is_active: true,
    is_featured: false,
    is_low_stock: false,
    image_key: null,
    image_url: null,
    search_keywords: null,
    sort_order: 1,
    archived_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  } as AdminProduct;
}

const productPage = (items: AdminProduct[]) => ({
  status: 200,
  body: { items, total: items.length, limit: 50, offset: 0 },
});
const noOrders = { status: 200, body: { pending_count: 0, latest_order_at: null } };

describe('quick stock rules', () => {
  it('sends only changed, valid rows with the count they started from', () => {
    const rows = [quick('milk', 10, '24'), quick('bread', 4), quick('eggs', 30, ' 30 ')];
    expect(rows.map(isChanged)).toEqual([true, false, false]);
    expect(toUpdates(rows)).toEqual([{ product_id: 'milk', stock: 24, expected_stock: 10 }]);
  });

  it('flags counts that are not whole numbers', () => {
    const checked = validateRows([quick('a', 1, '-2'), quick('b', 1, '2.5'), quick('c', 1, '3')]);
    expect(checked.map((r) => Boolean(r.error))).toEqual([true, true, false]);
  });

  it('applies saved rows and holds conflicts for a decision', () => {
    const rows = applyResult([quick('milk', 10, '24'), quick('bread', 6, '12')], {
      applied: [{ product_id: 'milk', stock_quantity: 24 }],
      conflicts: [{ product_id: 'bread', expected: 6, current: 4 }],
    });
    expect(rows[0]).toMatchObject({ base: 24, draft: '24', conflict: null });
    expect(rows[1]).toMatchObject({ base: 6, draft: '12', conflict: { current: 4 } });

    // "Keep 12": next save expects the new count, so it goes through.
    expect(toUpdates([keepMine(rows[1])])).toEqual([
      { product_id: 'bread', stock: 12, expected_stock: 4 },
    ]);
    // "Use 4": the edit is dropped.
    expect(isChanged(takeCurrent(rows[1]))).toBe(false);
  });
});

describe('quick stock page', () => {
  it('saves many counts at once and resolves a conflict', async () => {
    const sent: unknown[] = [];
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': noOrders,
      '/admin/categories': { status: 200, body: [] },
      '/admin/products': productPage([
        product(),
        product({ id: 'p2', name: 'Bread', stock_quantity: 6 }),
      ]),
      'POST /admin/inventory/bulk': (_url, init) => {
        const body = JSON.parse(String(init.body));
        sent.push(body);
        return sent.length === 1
          ? {
              status: 200,
              body: {
                applied: [{ product_id: 'p1', stock_quantity: 24 }],
                conflicts: [{ product_id: 'p2', expected: 6, current: 4 }],
              },
            }
          : {
              status: 200,
              body: { applied: [{ product_id: 'p2', stock_quantity: 12 }], conflicts: [] },
            };
      },
    });
    const user = userEvent.setup();
    renderApp('/inventory/quick');

    const milk = await screen.findByLabelText('Stock for Milk');
    await user.clear(milk);
    await user.type(milk, '24{Enter}');
    // Enter moved to the next row.
    expect(screen.getByLabelText('Stock for Bread')).toHaveFocus();
    await user.keyboard('12');
    expect(screen.getByRole('status')).toHaveTextContent('2 changes');

    await user.click(screen.getByRole('button', { name: 'Save 2' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      updates: [
        { product_id: 'p1', stock: 24, expected_stock: 10 },
        { product_id: 'p2', stock: 12, expected_stock: 6 },
      ],
    });
    expect(await screen.findByText(/Changed 6 → 4/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep 12' }));
    await user.click(screen.getByRole('button', { name: 'Save 1' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toEqual({ updates: [{ product_id: 'p2', stock: 12, expected_stock: 4 }] });
    expect(await screen.findByText('Saved 1 count.')).toBeInTheDocument();
  });
});

describe('inventory page', () => {
  it('adjusts stock with the + button and shows low stock', async () => {
    let adjusted: unknown = null;
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': noOrders,
      '/admin/categories': { status: 200, body: [] },
      '/admin/products': productPage([
        product({ stock_quantity: 2, is_low_stock: true }),
        product({ id: 'p2', name: 'Ghee', stock_quantity: 0, is_low_stock: true }),
      ]),
      'POST /admin/products/p1/stock-adjust': (_url, init) => {
        adjusted = JSON.parse(String(init.body));
        return { status: 200, body: { product_id: 'p1', stock_quantity: 3 } };
      },
    });
    const user = userEvent.setup();
    renderApp('/inventory');

    const milkRow = (await screen.findByText('Milk')).closest('tr')!;
    expect(within(milkRow).getByText('Low')).toBeInTheDocument();
    const gheeRow = screen.getByText('Ghee').closest('tr')!;
    expect(within(gheeRow).getByText('Out')).toBeInTheDocument();
    expect(within(gheeRow).getByRole('button', { name: 'Remove one Ghee' })).toBeDisabled();

    await user.click(within(milkRow).getByRole('button', { name: 'Add one Milk' }));
    await waitFor(() => expect(adjusted).toEqual({ delta: 1, note: null }));
  });

  it('explains a conflict when the count changed meanwhile', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': noOrders,
      '/admin/categories': { status: 200, body: [] },
      '/admin/products': productPage([product()]),
      'PATCH /admin/products/p1/stock': {
        status: 409,
        body: {
          error: {
            code: 'STOCK_CONFLICT',
            message: 'Stock changed to 8 while you were editing.',
            details: { current: 8 },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/inventory');

    const input = await screen.findByLabelText('Stock for Milk');
    await user.clear(input);
    await user.type(input, '20{Enter}');
    expect(
      await screen.findByText('Stock changed to 8 while you were editing.'),
    ).toBeInTheDocument();
  });
});

describe('customers page', () => {
  it('lists customers and opens one', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/orders/summary': noOrders,
      '/admin/customers': {
        status: 200,
        body: {
          items: [
            {
              id: 'u1',
              name: 'Asha Verma',
              email: 'asha@example.com',
              phone: '9876543210',
              is_active: true,
              joined_at: '2026-09-01T00:00:00Z',
              order_count: 3,
              total_spent_paise: 84000,
              last_order_at: '2026-10-02T05:30:00Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
      '/admin/customers/u1': {
        status: 200,
        body: {
          id: 'u1',
          name: 'Asha Verma',
          email: 'asha@example.com',
          phone: '9876543210',
          is_active: true,
          joined_at: '2026-09-01T00:00:00Z',
          order_count: 3,
          total_spent_paise: 84000,
          last_order_at: '2026-10-02T05:30:00Z',
          cancelled_count: 1,
          recent_orders: [],
        },
      },
    });
    const user = userEvent.setup();
    renderApp('/customers');

    const r = (await screen.findByRole('button', { name: 'Asha Verma' })).closest('tr')!;
    expect(within(r).getByText('₹840')).toBeInTheDocument();
    await user.click(within(r).getByRole('button', { name: 'Asha Verma' }));
    expect(await screen.findByRole('link', { name: /\+91 9876543210/ })).toHaveAttribute(
      'href',
      'tel:+919876543210',
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});
