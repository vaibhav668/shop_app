import styles from './FullPageSpinner.module.css';

export function FullPageSpinner() {
  return (
    <div className={styles.wrap} role="status" aria-label="Loading">
      <span className={styles.spinner} />
    </div>
  );
}
