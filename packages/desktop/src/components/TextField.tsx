import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: ReactNode;
  error?: string | null | undefined;
}

export function TextField({ label, value, onChange, hint, error, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <p className={styles.error}>{error}</p> : hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
