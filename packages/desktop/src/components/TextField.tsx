import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange(value: string): void;
  hint?: ReactNode;
  error?: string | null | undefined;
  /** Opciones para autocompletar (igual se puede escribir otra cosa). */
  suggestions?: readonly string[] | undefined;
}

export function TextField({ label, value, onChange, hint, error, suggestions, ...props }: TextFieldProps) {
  const id = useId();
  const listId = suggestions && suggestions.length > 0 ? `${id}-sugerencias` : undefined;
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
        list={listId}
        {...props}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {error ? <p className={styles.error}>{error}</p> : hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
