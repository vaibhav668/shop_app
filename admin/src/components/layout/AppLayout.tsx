import { Menu, ShoppingBasket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';

import { useNewOrderAlert } from '@/features/orders/useNewOrderAlert';

import { Sidebar } from './Sidebar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const pendingOrders = useNewOrderAlert();
  // Phones only: the sidebar becomes a slide-in menu opened from the top bar.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="main-menu"
        >
          <Menu size={22} aria-hidden />
        </button>
        <span className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            <ShoppingBasket size={16} strokeWidth={2} />
          </span>
          Bada Bazar
        </span>
        {pendingOrders > 0 ? (
          <Link to="/orders" className={styles.newOrders}>
            {pendingOrders} new
          </Link>
        ) : null}
      </header>

      <Sidebar badges={{ '/orders': pendingOrders }} open={menuOpen} onNavigate={closeMenu} />
      {menuOpen ? <div className={styles.scrim} onClick={closeMenu} aria-hidden /> : null}

      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
