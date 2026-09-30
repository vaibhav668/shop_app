import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Boxes,
  ChevronRight,
  CircleCheck,
  LayoutDashboard,
  PackageOpen,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { type OrderStatus, ordersApi, ordersKeys } from '@/api/orders';
import { useAuth } from '@/auth/authContext';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';
import { formatDateTime, STATUS_LABEL, STATUS_TONE } from '@/features/orders/orderLabels';
import { POLL_MS } from '@/features/orders/useNewOrderAlert';
import { formatPaise } from '@/lib/money';

import styles from './DashboardPage.module.css';

const PIPELINE: { status: OrderStatus; icon: LucideIcon; tint: string }[] = [
  { status: 'PENDING', icon: Bell, tint: styles.tintGold },
  { status: 'CONFIRMED', icon: CircleCheck, tint: styles.tintMint },
  { status: 'PREPARING', icon: PackageOpen, tint: styles.tintSage },
  { status: 'OUT_FOR_DELIVERY', icon: Truck, tint: styles.tintPeach },
];

function greeting(date: Date): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuth();
  const board = useQuery({
    queryKey: ordersKeys.dashboard,
    queryFn: ordersApi.dashboard,
    refetchInterval: POLL_MS,
  });
  const [today] = useState(() => new Date());
  const firstName = user?.name.trim().split(' ')[0];

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
          <section className={styles.hero} aria-busy={board.isPending || undefined}>
            <div className={styles.heroText}>
              <p className={styles.heroGreeting}>
                {greeting(today)}
                {firstName ? `, ${firstName}` : ''}
              </p>
              <p className={styles.heroDate}>
                {today.toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <div className={styles.heroFigure} title="Paid online, or cash from delivered orders">
              <span className={styles.heroLabel}>Collected today</span>
              <span className={styles.heroValue}>
                {board.data ? formatPaise(board.data.today_revenue_paise) : '–'}
              </span>
              <span className={styles.heroSub}>
                {board.data
                  ? `${board.data.today_orders} ${board.data.today_orders === 1 ? 'order' : 'orders'} today`
                  : ' '}
              </span>
            </div>
            <div className={styles.heroActions}>
              <Link to="/orders" className={styles.goldLink}>
                Open orders <ChevronRight size={16} aria-hidden />
              </Link>
              <Link to="/inventory/quick" className={styles.glassLink}>
                <Boxes size={16} aria-hidden /> Quick stock
              </Link>
            </div>
          </section>

          <section className={styles.stats} aria-label="Orders by status">
            {PIPELINE.map(({ status, icon: Icon, tint }) => {
              const count = board.data?.status_counts[status] ?? 0;
              return (
                <Link
                  key={status}
                  to={status === 'PENDING' ? '/orders' : `/orders?status=${status}`}
                  className={`${styles.stat} ${
                    status === 'PENDING' && count > 0 ? styles.attention : ''
                  }`}
                >
                  <span className={`${styles.statIcon} ${tint}`} aria-hidden>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className={styles.statValue}>{board.data ? count : '–'}</span>
                  <span className={styles.statLabel}>{STATUS_LABEL[status]}</span>
                </Link>
              );
            })}
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
                <p className={styles.empty}>No orders yet. They&apos;ll show up here.</p>
              ) : (
                <ul className={styles.orderList}>
                  {board.data?.recent_orders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/orders?status=all&order=${o.id}`} className={styles.orderRow}>
                        <span className={styles.orderMain}>
                          <span className={styles.orderNo}>#{o.order_number}</span>
                          <span className={table.secondary}>
                            {o.customer_name} · {formatDateTime(o.placed_at)}
                          </span>
                        </span>
                        <span className={styles.orderEnd}>
                          <span className={styles.orderTotal}>{formatPaise(o.total_paise)}</span>
                          <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
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
