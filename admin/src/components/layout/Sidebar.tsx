import { LogOut, ShoppingBasket } from 'lucide-react';
import { NavLink } from 'react-router';

import { useAuth } from '@/auth/authContext';
import { NAV_ITEMS } from '@/navigation';

import styles from './Sidebar.module.css';

export function Sidebar() {
  const { user, signOut } = useAuth();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          <ShoppingBasket size={18} strokeWidth={2} />
        </span>
        <span className={styles.brandText}>
          <span className={styles.shopName}>Bada Bazar</span>
          <span className={styles.caption}>Shop admin</span>
        </span>
      </div>

      <nav aria-label="Main">
        <ul className={styles.list}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/'}
                title={label}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                <span className={styles.label}>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {user ? (
        <div className={styles.account}>
          <span className={styles.avatar} aria-hidden>
            {user.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className={styles.accountText}>
            <span className={styles.accountName}>{user.name}</span>
            <span className={styles.caption}>{user.email}</span>
          </span>
          <button
            type="button"
            className={styles.signOut}
            onClick={() => void signOut()}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
