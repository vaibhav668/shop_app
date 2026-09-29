import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { initialState, validate } from '@/features/catalog/productForm';

import { authOk, mockApi, renderApp } from './renderApp';

const DAIRY = {
  id: 'c-dairy',
  name: 'Dairy & Eggs',
  slug: 'dairy-eggs',
  image_key: null,
  image_url: null,
  sort_order: 1,
  is_active: true,
  product_count: 2,
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-milk',
    category_id: 'c-dairy',
    category_name: 'Dairy & Eggs',
    name: 'Toned Milk',
    slug: 'toned-milk',
    description: null,
    unit_label: '500 ml',
    price_paise: 2800,
    mrp_paise: 3000,
    stock_quantity: 24,
    low_stock_threshold: null,
    max_per_order: null,
    is_active: true,
    is_featured: false,
    is_low_stock: false,
    image_key: null,
    image_url: null,
    search_keywords: null,
    archived_at: null,
    updated_at: '2026-09-29T10:00:00Z',
    ...overrides,
  };
}

const page = (items: unknown[]) => ({ items, total: items.length, limit: 20, offset: 0 });

describe('product form validation', () => {
  const valid = {
    ...initialState(),
    name: 'Toned Milk',
    categoryId: 'c-dairy',
    unitLabel: '500 ml',
    price: '28',
    mrp: '30',
    stock: '24',
  };

  it('accepts a complete product', () => {
    expect(validate(valid)).toEqual({});
  });

  it('rejects MRP below the selling price', () => {
    expect(validate({ ...valid, price: '35', mrp: '30' }).mrp).toMatch(/MRP can't be lower/);
  });

  it('rejects bad numbers', () => {
    const errors = validate({ ...valid, price: 'abc', stock: '-1', maxPerOrder: '99' });
    expect(Object.keys(errors).sort()).toEqual(['maxPerOrder', 'price', 'stock']);
  });
});

describe('products page', () => {
  it('lists products with price, stock and status', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': { status: 200, body: [DAIRY] },
      '/admin/products': {
        status: 200,
        body: page([
          product(),
          product({ id: 'p-curd', name: 'Curd', stock_quantity: 0, is_low_stock: true }),
        ]),
      },
    });
    renderApp('/products');

    const milk = (await screen.findByRole('link', { name: 'Toned Milk' })).closest('tr')!;
    expect(within(milk).getByText('₹28')).toBeInTheDocument();
    expect(within(milk).getByText('₹30')).toBeInTheDocument();
    expect(within(milk).getByText('Shown')).toBeInTheDocument();

    const curd = screen.getByRole('link', { name: 'Curd' }).closest('tr')!;
    expect(within(curd).getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument();
  });

  it('shows a friendly empty state for a new shop', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': { status: 200, body: [] },
      '/admin/products': { status: 200, body: page([]) },
    });
    renderApp('/products');
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
  });
});

describe('add product', () => {
  it('sends prices in paise and opening stock', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': { status: 200, body: [DAIRY] },
      'POST /admin/products': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return { status: 201, body: product() };
      },
      'GET /admin/products': { status: 200, body: page([product()]) },
    });
    renderApp('/products/new');

    await userEvent.type(await screen.findByLabelText('Name'), 'Toned Milk');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c-dairy');
    await userEvent.type(screen.getByLabelText('Pack size'), '500 ml');
    await userEvent.type(screen.getByLabelText('Selling price'), '28');
    await userEvent.type(screen.getByLabelText('MRP'), '30.50');
    await userEvent.clear(screen.getByLabelText('Opening stock'));
    await userEvent.type(screen.getByLabelText('Opening stock'), '24');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add product' })[0]);

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({
      name: 'Toned Milk',
      category_id: 'c-dairy',
      unit_label: '500 ml',
      price_paise: 2800,
      mrp_paise: 3050,
      stock_quantity: 24,
    });
  });

  it('does not submit an invalid form', async () => {
    const fetchMock = mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': { status: 200, body: [DAIRY] },
    });
    renderApp('/products/new');

    await userEvent.click((await screen.findAllByRole('button', { name: 'Add product' }))[0]);

    expect(await screen.findByText('Fix the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('Enter the product name.')).toBeInTheDocument();
    const posted = fetchMock.mock.calls.some(
      ([url, init]) => init?.method === 'POST' && String(url).includes('/admin/products'),
    );
    expect(posted).toBe(false);
  });
});

describe('edit product stock', () => {
  it('explains a stock conflict instead of overwriting a sale', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': { status: 200, body: [DAIRY] },
      'GET /admin/products/p-milk': { status: 200, body: product() },
      'PATCH /admin/products/p-milk': { status: 200, body: product() },
      'PATCH /admin/products/p-milk/stock': {
        status: 409,
        body: {
          error: {
            code: 'STOCK_CONFLICT',
            message: 'Stock changed to 22 while you were editing.',
            details: { current: 22, expected: 24 },
          },
        },
      },
    });
    renderApp('/products/p-milk');

    const stock = await screen.findByLabelText('Units in stock');
    await userEvent.clear(stock);
    await userEvent.type(stock, '30');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(/stock changed to 22 while you were editing/i),
    ).toBeInTheDocument();
  });
});

describe('categories page', () => {
  it('lists categories and blocks deleting a non-empty one', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/categories': {
        status: 200,
        body: [DAIRY, { ...DAIRY, id: 'c-empty', name: 'Bakery', product_count: 0 }],
      },
    });
    renderApp('/categories');

    expect(await screen.findByText('Dairy & Eggs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Dairy & Eggs' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Bakery' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Dairy & Eggs up' })).toBeDisabled();
  });
});
