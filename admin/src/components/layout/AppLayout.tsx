import { Outlet } from 'react-router';

import { useNewOrderAlert } from '@/features/orders/useNewOrderAlert';

import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const pendingOrders = useNewOrderAlert();
  return (
    <div className={styles.shell}>
      <Sidebar badges={{ '/orders': pendingOrders }} />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
