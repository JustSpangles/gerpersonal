import { useId, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
  hint?: ReactNode;
  error?: string | null | undefined;
}

/** Lista desplegable con el mismo aspecto que `TextField`. */
export function SelectField({ label, value, options, onChange, hint, error }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className={styles.error}>{error}</p> : hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
