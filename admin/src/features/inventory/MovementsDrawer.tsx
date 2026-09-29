import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { inventoryApi, inventoryKeys, type Movement } from '@/api/inventory';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import { formatDateTime } from '@/features/orders/orderLabels';

import styles from './MovementsDrawer.module.css';

const REASON: Record<Movement['reason'], string> = {
  INITIAL: 'Opening stock',
  ORDER_PLACED: 'Order',
  ORDER_CANCELLED: 'Order cancelled',
  MANUAL_ADJUST: 'Adjusted',
  STOCK_SET: 'Count set',
};

export function MovementsDrawer({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName?: string;
  onClose: () => void;
}) {
  const history = useInfiniteQuery({
    queryKey: inventoryKeys.movements(productId),
    queryFn: ({ pageParam }) => inventoryApi.movements(productId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  });
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];
  const name = productName ?? items[0]?.product_name;

  return (
    <Drawer title={name ? `Stock history · ${name}` : 'Stock history'} onClose={onClose}>
      {history.isPending ? (
        <p className={styles.muted}>Loading…</p>
      ) : history.isError ? (
        <Alert>Couldn't load the history.</Alert>
      ) : items.length === 0 ? (
        <p className={styles.muted}>No stock changes yet.</p>
      ) : (
        <>
          <ol className={styles.list}>
            {items.map((m) => (
              <li key={m.id} className={styles.item}>
                <span className={`${styles.delta} ${m.delta < 0 ? styles.down : styles.up}`}>
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </span>
                <span className={styles.what}>
                  <span className={styles.reason}>
                    {REASON[m.reason]}
                    {m.order_number ? (
                      <>
                        {' '}
                        <Link to={`/orders?status=all&order=${m.order_id}`}>#{m.order_number}</Link>
                      </>
                    ) : null}
                  </span>
                  <span className={styles.muted}>
                    {formatDateTime(m.created_at)}
                    {m.actor_name ? ` · ${m.actor_name}` : ''}
                  </span>
                  {m.note ? <span className={styles.note}>“{m.note}”</span> : null}
                </span>
                <span className={styles.result} title="Stock after this change">
                  {m.resulting_stock}
                </span>
              </li>
            ))}
          </ol>
          {history.hasNextPage ? (
            <Button
              variant="secondary"
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              Show older
            </Button>
          ) : null}
        </>
      )}
    </Drawer>
  );
}
