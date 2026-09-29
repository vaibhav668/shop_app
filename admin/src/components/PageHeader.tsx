import type { ReactNode } from 'react';

import styles from './PageHeader.module.css';

export type PageHeaderProps = {
  title: string;
  description?: string;
  /** The page's primary action, top-right. */
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
