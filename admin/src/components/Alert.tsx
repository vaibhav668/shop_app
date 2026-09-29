import type { ReactNode } from 'react';

import styles from './Alert.module.css';

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'warning';
  children: ReactNode;
}) {
  return (
    <div role="alert" className={`${styles.alert} ${styles[tone]}`}>
      {children}
    </div>
  );
}
