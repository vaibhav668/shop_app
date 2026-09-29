import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { AdminBanner } from '@/api/catalog';
import { bannerStatus } from '@/features/catalog/bannerStatus';
import { fromLocalInput, toLocalInput } from '@/features/catalog/dates';

import { authOk, mockApi, renderApp } from './renderApp';

function banner(overrides: Partial<AdminBanner> = {}): AdminBanner {
  return {
    id: 'b1',
    title: 'Fresh vegetables',
    subtitle: 'Every morning',
    image_key: null,
    image_url: null,
    target_type: 'NONE',
    target_id: null,
    target_label: null,
    sort_order: 1,
    is_active: true,
    starts_at: null,
    ends_at: null,
    is_live: true,
    ...overrides,
  };
}

describe('bannerStatus', () => {
  const now = new Date('2026-10-01T10:00:00Z');
  it.each([
    [{}, 'Live'],
    [{ is_active: false }, 'Hidden'],
    [{ starts_at: '2026-10-02T00:00:00Z' }, 'Scheduled'],
    [{ ends_at: '2026-09-30T00:00:00Z' }, 'Ended'],
  ] as const)('%o → %s', (overrides, label) => {
    expect(bannerStatus(banner(overrides), now).label).toBe(label);
  });
});

describe('datetime-local conversion', () => {
  it('round-trips and treats empty as no date', () => {
    const iso = '2026-10-01T04:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(fromLocalInput('')).toBeNull();
    expect(toLocalInput(null)).toBe('');
  });
});

describe('banners page', () => {
  it('lists banners with where they open and their status', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/banners': {
        status: 200,
        body: [
          banner(),
          banner({
            id: 'b2',
            title: 'Dairy week',
            target_type: 'CATEGORY',
            target_id: 'c1',
            target_label: 'Dairy & Eggs',
            is_active: false,
          }),
        ],
      },
    });
    renderApp('/banners');

    const dairy = (await screen.findByText('Dairy week')).closest('tr')!;
    expect(within(dairy).getByText('Dairy & Eggs')).toBeInTheDocument();
    expect(within(dairy).getByText('Hidden')).toBeInTheDocument();
    const veg = screen.getByText('Fresh vegetables').closest('tr')!;
    expect(within(veg).getByText('Nothing')).toBeInTheDocument();
    expect(within(veg).getByText('Live')).toBeInTheDocument();
  });

  it('creates a banner that opens a category', async () => {
    let sent: Record<string, unknown> | null = null;
    mockApi({
      '/auth/refresh': authOk(),
      'GET /admin/banners': { status: 200, body: [] },
      'POST /admin/banners': (_url, init) => {
        sent = JSON.parse(String(init.body));
        return { status: 201, body: banner() };
      },
      '/admin/categories': {
        status: 200,
        body: [
          {
            id: 'c1',
            name: 'Dairy & Eggs',
            slug: 'dairy-eggs',
            image_key: null,
            image_url: null,
            sort_order: 1,
            is_active: true,
            product_count: 3,
          },
        ],
      },
    });
    renderApp('/banners');

    await userEvent.click((await screen.findAllByRole('button', { name: /Add banner/ }))[0]);
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Dairy week');
    await userEvent.selectOptions(within(dialog).getByLabelText('When tapped, open'), 'CATEGORY');
    await userEvent.selectOptions(await within(dialog).findByLabelText('Category'), 'c1');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent).not.toBeNull());
    expect(sent).toMatchObject({
      title: 'Dairy week',
      target_type: 'CATEGORY',
      target_id: 'c1',
      is_active: true,
    });
  });

  it('asks for a target before saving a linked banner', async () => {
    mockApi({
      '/auth/refresh': authOk(),
      '/admin/banners': { status: 200, body: [] },
      '/admin/products': { status: 200, body: { items: [], total: 0, limit: 20, offset: 0 } },
    });
    renderApp('/banners');

    await userEvent.click((await screen.findAllByRole('button', { name: /Add banner/ }))[0]);
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Title'), 'New arrival');
    await userEvent.selectOptions(within(dialog).getByLabelText('When tapped, open'), 'PRODUCT');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Choose which product it opens.')).toBeInTheDocument();
  });
});
