import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import styles from './EmptyState.module.css';

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <section className={styles.panel}>
      <Icon size={40} strokeWidth={1.75} className={styles.icon} aria-hidden />
      <h2 className={styles.title}>{title}</h2>
      {message ? <p className={styles.message}>{message}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
