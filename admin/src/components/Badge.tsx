import styles from './Badge.module.css';

export type BadgeTone = 'success' | 'solid' | 'warning' | 'danger' | 'neutral';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: string }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
