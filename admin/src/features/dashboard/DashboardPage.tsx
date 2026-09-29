import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router';

import { type OrderStatus, ordersApi, ordersKeys } from '@/api/orders';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';
import { formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/features/orders/orderLabels';
import { POLL_MS } from '@/features/orders/useNewOrderAlert';
import { formatPaise } from '@/lib/money';

import styles from './DashboardPage.module.css';

const PIPELINE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

export function DashboardPage() {
  const board = useQuery({
    queryKey: ordersKeys.dashboard,
    queryFn: ordersApi.dashboard,
    refetchInterval: POLL_MS,
  });

  return (
    <>
      <PageHeader title="Dashboard" description="How today is going, and what needs doing next." />

      {board.isError ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Couldn't load the dashboard"
          action={
            <Button variant="secondary" onClick={() => board.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <section className={styles.stats} aria-busy={board.isPending || undefined}>
            <Stat label="Orders today" value={board.data ? String(board.data.today_orders) : '–'} />
            <Stat
              label="Collected today"
              value={board.data ? formatPaise(board.data.today_revenue_paise) : '–'}
              hint="Paid online, or cash from delivered orders"
            />
            {PIPELINE.map((status) => (
              <Link
                key={status}
                to={status === 'PENDING' ? '/orders' : `/orders?status=${status}`}
                className={`${styles.stat} ${styles.statLink} ${
                  status === 'PENDING' && (board.data?.status_counts.PENDING ?? 0) > 0
                    ? styles.attention
                    : ''
                }`}
              >
                <span className={styles.statLabel}>{STATUS_LABEL[status]}</span>
                <span className={styles.statValue}>
                  {board.data ? (board.data.status_counts[status] ?? 0) : '–'}
                </span>
              </Link>
            ))}
          </section>

          <div className={styles.columns}>
            <section className={table.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Recent orders</h2>
                <Link to="/orders?status=all" className={styles.more}>
                  All orders
                </Link>
              </header>
              {board.data && board.data.recent_orders.length === 0 ? (
                <p className={styles.empty}>No orders yet. They'll show up here.</p>
              ) : (
                <table className={table.table}>
                  <tbody>
                    {board.data?.recent_orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/orders?status=all&order=${o.id}`} className={table.primary}>
                            #{o.order_number}
                          </Link>
                          <br />
                          <span className={table.secondary}>{formatDateTime(o.placed_at)}</span>
                        </td>
                        <td>{o.customer_name}</td>
                        <td className={table.num}>{formatPaise(o.total_paise)}</td>
                        <td>
                          <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className={table.panel}>
              <header className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>
                  <AlertTriangle size={16} aria-hidden className={styles.warnIcon} /> Low stock
                </h2>
                <Link to="/products?low=1" className={styles.more}>
                  See all
                </Link>
              </header>
              {board.data && board.data.low_stock.length === 0 ? (
                <p className={styles.empty}>Everything is well stocked.</p>
              ) : (
                <ul className={styles.stockList}>
                  {board.data?.low_stock.map((p) => (
                    <li key={p.id}>
                      <Link to={`/products/${p.id}`} className={styles.stockName}>
                        {p.name}
                        <span className={table.secondary}> · {p.unit_label}</span>
                      </Link>
                      <span
                        className={`${styles.stockCount} ${p.stock_quantity === 0 ? styles.zero : ''}`}
                      >
                        {p.stock_quantity === 0 ? 'Out' : `${p.stock_quantity} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.stat} title={hint}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
