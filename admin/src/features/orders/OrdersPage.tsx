import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type OrderStatus, ORDERS_PAGE_SIZE, ordersApi, ordersKeys } from '@/api/orders';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';
import { formatPaise } from '@/lib/money';

import { OrderDrawer } from './OrderDrawer';
import { formatDateTime, STATUS_LABEL, STATUS_TABS, STATUS_TONE } from './orderLabels';

import styles from './OrdersPage.module.css';

/** New orders refresh on their own while the page is open. */
const REFRESH_MS = 15_000;

export function OrdersPage() {
  // Tab, search, page and the open order live in the URL: refresh-safe and shareable.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as OrderStatus | null) ?? undefined;
  const all = params.get('status') === 'all';
  const page = Math.max(0, Number(params.get('page') ?? 0));
  const openId = params.get('order');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);

  const set = (changes: Record<string, string | null>, keepPage = false) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!keepPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get('q') ?? '') === q) return prev;
        const next = new URLSearchParams(prev);
        if (q) next.set('q', q);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [q, setParams]);

  // No status in the URL means the "New" tab: what needs the shop's attention first.
  const activeStatus: OrderStatus | undefined = all ? undefined : (status ?? 'PENDING');
  const filters = {
    // A search looks across every status: the shopkeeper usually has just a name or number.
    status: q ? undefined : activeStatus,
    q: q || undefined,
    offset: page * ORDERS_PAGE_SIZE,
  };
  const orders = useQuery({
    queryKey: ordersKeys.list(filters),
    queryFn: () => ordersApi.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  const total = orders.data?.total ?? 0;
  const items = orders.data?.items ?? [];
  const from = total === 0 ? 0 : page * ORDERS_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * ORDERS_PAGE_SIZE);
  const tabKey = all ? 'all' : (status ?? 'PENDING');

  return (
    <>
      <PageHeader title="Orders" description="Accept new orders and move them along to delivery." />

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Order status">
          {STATUS_TABS.map((tab) => {
            const key = tab.status ?? 'all';
            const selected = !q && tabKey === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
                onClick={() => {
                  setSearch('');
                  set({ status: key === 'PENDING' ? null : key, q: null });
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className={styles.search}>
          <TextField
            label="Search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, name or phone"
          />
        </div>
      </div>

      {orders.isError ? (
        <EmptyState
          icon={ReceiptText}
          title="Couldn't load orders"
          action={
            <Button variant="secondary" onClick={() => orders.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !orders.isPending && total === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={
            q
              ? 'No orders match this search.'
              : tabKey === 'PENDING'
                ? 'No new orders right now.'
                : `No ${STATUS_TABS.find((t) => (t.status ?? 'all') === tabKey)?.label.toLowerCase()} orders.`
          }
          message={tabKey === 'PENDING' && !q ? 'New orders appear here on their own.' : undefined}
        />
      ) : (
        <div
          className={`${table.panel} ${styles.panel}`}
          aria-busy={orders.isFetching || undefined}
        >
          <table className={`${table.table} ${styles.table}`}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Area</th>
                <th className={table.num}>Items</th>
                <th className={table.num}>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.isPending
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} className={table.loadingRow}>
                      <td colSpan={6}>
                        <span
                          className={table.skeleton}
                          style={{ width: `${45 + (i % 3) * 15}%` }}
                        />
                      </td>
                    </tr>
                  ))
                : items.map((o) => (
                    <tr
                      key={o.id}
                      className={styles.row}
                      onClick={() => set({ order: o.id }, true)}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.orderLink}
                          onClick={(e) => {
                            e.stopPropagation();
                            set({ order: o.id }, true);
                          }}
                        >
                          #{o.order_number}
                        </button>
                        <br />
                        <span className={table.secondary}>{formatDateTime(o.placed_at)}</span>
                      </td>
                      <td>
                        {o.customer_name}
                        <br />
                        <span className={`${table.secondary} tabular`}>{o.customer_phone}</span>
                      </td>
                      <td className={table.secondary}>{o.delivery_area}</td>
                      <td className={table.num}>{o.item_count}</td>
                      <td className={table.num}>
                        {formatPaise(o.total_paise)}
                        <br />
                        <span className={table.secondary}>
                          {o.payment_method === 'COD' ? 'Cash' : 'Online'}
                          {o.payment_status === 'PAID' ? ' · paid' : ''}
                        </span>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          <div className={table.footer}>
            <span className="tabular">
              {from}–{to} of {total}
            </span>
            <div className={table.pager}>
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => set({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={to >= total}
                onClick={() => set({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {openId ? <OrderDrawer orderId={openId} onClose={() => set({ order: null }, true)} /> : null}
    </>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
