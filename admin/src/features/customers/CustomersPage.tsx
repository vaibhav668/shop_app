import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Phone, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { inventoryApi, inventoryKeys } from '@/api/inventory';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';
import { formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/features/orders/orderLabels';
import { formatPaise } from '@/lib/money';

import styles from './CustomersPage.module.css';

const PAGE = 20;

export function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get('page') ?? 0));
  const openId = params.get('customer');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);

  const set = (changes: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

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

  const customers = useQuery({
    queryKey: inventoryKeys.customers(q, page * PAGE),
    queryFn: () => inventoryApi.customers(q, page * PAGE),
    placeholderData: keepPreviousData,
  });
  const total = customers.data?.total ?? 0;
  const items = customers.data?.items ?? [];
  const from = total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(total, (page + 1) * PAGE);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who has signed up, most recent buyers first."
      />
      <div className={styles.search}>
        <TextField
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, email or phone"
        />
      </div>

      {customers.isError ? (
        <EmptyState
          icon={Users}
          title="Couldn't load customers"
          action={
            <Button variant="secondary" onClick={() => customers.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !customers.isPending && total === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? 'No customers match this search.' : 'No customers yet.'}
          message={q ? undefined : 'People who sign in to the app appear here.'}
        />
      ) : (
        <div className={table.panel} aria-busy={customers.isFetching || undefined}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th className={table.num}>Orders</th>
                <th className={table.num}>Spent</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className={styles.row} onClick={() => set({ customer: c.id })}>
                  <td>
                    <button
                      type="button"
                      className={styles.nameButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        set({ customer: c.id });
                      }}
                    >
                      {c.name}
                    </button>
                    <br />
                    <span className={table.secondary}>{c.email}</span>
                  </td>
                  <td className="tabular">{c.phone ?? '—'}</td>
                  <td className={table.num}>{c.order_count}</td>
                  <td className={table.num}>{formatPaise(c.total_spent_paise)}</td>
                  <td className={table.secondary}>
                    {c.last_order_at ? formatDateTime(c.last_order_at) : 'Never'}
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

      {openId ? <CustomerDrawer id={openId} onClose={() => set({ customer: null })} /> : null}
    </>
  );
}

function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const customer = useQuery({
    queryKey: inventoryKeys.customer(id),
    queryFn: () => inventoryApi.customer(id),
  });
  const c = customer.data;

  return (
    <Drawer title={c?.name ?? 'Customer'} onClose={onClose}>
      {customer.isPending ? (
        <p className={styles.muted}>Loading…</p>
      ) : customer.isError || !c ? (
        <Alert>Couldn't load this customer.</Alert>
      ) : (
        <>
          <section className={styles.section}>
            <span>{c.email}</span>
            {c.phone ? (
              <a className={styles.phone} href={`tel:+91${c.phone}`}>
                <Phone size={14} aria-hidden /> +91 {c.phone}
              </a>
            ) : null}
            <span className={styles.muted}>Joined {formatDateTime(c.joined_at)}</span>
          </section>
          <dl className={styles.stats}>
            <div>
              <dt>Orders</dt>
              <dd>{c.order_count}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{formatPaise(c.total_spent_paise)}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd>{c.cancelled_count}</dd>
            </div>
          </dl>
          <section className={styles.section}>
            <h3 className={styles.heading}>Recent orders</h3>
            {c.recent_orders.length === 0 ? (
              <p className={styles.muted}>No orders yet.</p>
            ) : (
              <ul className={styles.orders}>
                {c.recent_orders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders?status=all&order=${o.id}`}>#{o.order_number}</Link>
                    <span className={styles.muted}>{formatDateTime(o.placed_at)}</span>
                    <span className="tabular">{formatPaise(o.total_paise)}</span>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Drawer>
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
