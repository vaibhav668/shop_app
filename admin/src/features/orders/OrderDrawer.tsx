import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { type AdminOrderDetail, type OrderStatus, ordersApi, ordersKeys } from '@/api/orders';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Drawer } from '@/components/Drawer';
import { TextArea } from '@/components/form/Fields';
import { Modal } from '@/components/Modal';
import { formatPaise } from '@/lib/money';

import { ACTION_LABEL, formatDateTime, STATUS_LABEL, STATUS_TONE } from './orderLabels';

import styles from './OrderDrawer.module.css';

export function OrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const order = useQuery({
    queryKey: ordersKeys.detail(orderId),
    queryFn: () => ordersApi.get(orderId),
  });

  return (
    <Drawer
      title={order.data ? `Order #${order.data.order_number}` : 'Order'}
      onClose={onClose}
      footer={order.data ? <OrderActions order={order.data} /> : null}
    >
      {order.isPending ? (
        <p className={styles.muted}>Loading…</p>
      ) : order.isError ? (
        <Alert>
          {order.error instanceof ApiError && order.error.status === 404
            ? "This order doesn't exist."
            : "Couldn't load this order."}
        </Alert>
      ) : (
        <OrderBody order={order.data} />
      )}
    </Drawer>
  );
}

function OrderBody({ order }: { order: AdminOrderDetail }) {
  const a = order.delivery_address;
  return (
    <>
      <section className={styles.summary}>
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        <span className={styles.muted}>Placed {formatDateTime(order.placed_at)}</span>
      </section>

      {order.cancel_reason ? <Alert tone="warning">Cancelled: {order.cancel_reason}</Alert> : null}

      <section className={styles.section}>
        <h3 className={styles.heading}>Deliver to</h3>
        <p className={styles.strong}>{a.name}</p>
        <p>{[a.line1, a.line2, a.landmark].filter(Boolean).join(', ')}</p>
        <p>
          {a.city}, {a.state} {a.pincode}
        </p>
        <a className={styles.phone} href={`tel:+91${a.phone}`}>
          <Phone size={14} aria-hidden /> +91 {a.phone}
        </a>
        {order.customer_note ? (
          <p className={styles.note}>
            <span className={styles.strong}>Note:</span> {order.customer_note}
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>
          {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
        </h3>
        <ul className={styles.items}>
          {order.items.map((item) => (
            <li key={item.product_id} className={styles.item}>
              <span className={styles.qty}>{item.quantity} ×</span>
              <span className={styles.itemName}>
                {item.name}
                <span className={styles.muted}> · {item.unit_label}</span>
              </span>
              <span className="tabular">{formatPaise(item.line_total_paise)}</span>
            </li>
          ))}
        </ul>
        <dl className={styles.bill}>
          <dt>Items total</dt>
          <dd>{formatPaise(order.subtotal_paise)}</dd>
          <dt>Delivery</dt>
          <dd>{order.delivery_fee_paise ? formatPaise(order.delivery_fee_paise) : 'Free'}</dd>
          <dt className={styles.strong}>
            {order.payment_method === 'COD' ? 'Collect on delivery' : 'Paid online'}
          </dt>
          <dd className={styles.strong}>{formatPaise(order.total_paise)}</dd>
        </dl>
        <p className={styles.muted}>
          Payment: {order.payment_method === 'COD' ? 'Cash on delivery' : 'Online'} ·{' '}
          {order.payment_status === 'PAID' ? 'Paid' : order.payment_status.toLowerCase()}
        </p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Customer</h3>
        <p className={styles.strong}>{order.customer.name}</p>
        <p className={styles.muted}>{order.customer.email}</p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>History</h3>
        <ol className={styles.history}>
          {order.history.map((h, i) => (
            <li key={i}>
              <span className={styles.strong}>{STATUS_LABEL[h.to_status]}</span>{' '}
              <span className={styles.muted}>
                {formatDateTime(h.at)} ·{' '}
                {h.actor === 'CUSTOMER'
                  ? 'by customer'
                  : h.actor === 'SYSTEM'
                    ? 'automatic'
                    : `by ${h.actor_name ?? 'admin'}`}
              </span>
              {h.note ? <div className={styles.muted}>“{h.note}”</div> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function OrderActions({ order }: { order: AdminOrderDetail }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = useMutation({
    mutationFn: ({ to, note }: { to: OrderStatus; note?: string }) =>
      ordersApi.setStatus(order.id, to, note),
    onSuccess: (updated) => {
      // The response is the fresh order; only the lists and counts around it need refreshing.
      queryClient.setQueryData(ordersKeys.detail(order.id), updated);
      void queryClient.invalidateQueries({ queryKey: ordersKeys.lists });
      void queryClient.invalidateQueries({ queryKey: ordersKeys.summary });
      void queryClient.invalidateQueries({ queryKey: ordersKeys.dashboard });
      setCancelling(false);
      setError(null);
    },
    onError: (e) => {
      // Usually the customer cancelled a moment ago: show what the order is now.
      void queryClient.invalidateQueries({ queryKey: ordersKeys.detail(order.id) });
      setError(e instanceof ApiError ? e.message : "Couldn't update the order. Try again?");
    },
  });

  const next = order.next_statuses.find((s) => s !== 'CANCELLED');
  const canCancel = order.next_statuses.includes('CANCELLED');
  if (!next && !canCancel) return null;

  return (
    <>
      {error ? <span className={styles.footerError}>{error}</span> : null}
      {canCancel ? (
        <Button variant="secondary" onClick={() => setCancelling(true)}>
          Cancel order
        </Button>
      ) : null}
      {next ? (
        <Button loading={move.isPending && !cancelling} onClick={() => move.mutate({ to: next })}>
          {ACTION_LABEL[next] ?? STATUS_LABEL[next]}
        </Button>
      ) : null}
      {cancelling ? (
        <CancelDialog
          orderNumber={order.order_number}
          busy={move.isPending}
          onClose={() => setCancelling(false)}
          onConfirm={(reason) => move.mutate({ to: 'CANCELLED', note: reason })}
        />
      ) : null}
    </>
  );
}

const REASONS = ['Item out of stock', 'Customer asked to cancel', "Can't deliver to this address"];

function CancelDialog({
  orderNumber,
  busy,
  onClose,
  onConfirm,
}: {
  orderNumber: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = !reason.trim();

  return (
    <Modal
      title={`Cancel order #${orderNumber}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => {
              setTouched(true);
              if (!missing) onConfirm(reason.trim());
            }}
          >
            Cancel order
          </Button>
        </>
      }
    >
      <p className={styles.muted}>The customer sees this reason. The items go back into stock.</p>
      <div className={styles.reasons}>
        {REASONS.map((r) => (
          <button key={r} type="button" className={styles.reasonChip} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <TextArea
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        rows={3}
        error={touched && missing ? 'Tell the customer why.' : null}
      />
    </Modal>
  );
}
