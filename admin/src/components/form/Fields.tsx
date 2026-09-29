import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

import styles from './Form.module.css';

type FieldShell = {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
};

function Shell({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} {optional ? <span className={styles.optional}>(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <span className={styles.error} id={`${id}-error`}>
          {error}
        </span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  optional,
  prefix,
  ...input
}: FieldShell & { prefix?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const control = (
    <input
      id={id}
      className={styles.control}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...input}
    />
  );
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      {prefix ? (
        <div className={styles.prefixed}>
          <span className={styles.prefix}>{prefix}</span>
          {control}
        </div>
      ) : (
        control
      )}
    </Shell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  ...input
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        {...input}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  children,
  ...select
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        {...select}
      >
        {children}
      </select>
    </Shell>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.toggleText}>
        <span className={styles.label}>{label}</span>
        {description ? <span className={styles.hint}>{description}</span> : null}
      </span>
    </label>
  );
}
