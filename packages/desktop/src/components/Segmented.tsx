import styles from './Segmented.module.css';

interface SegmentedProps<T extends string> {
  /** Nombre del grupo para lectores de pantalla. */
  label: string;
  value: T;
  options: readonly { value: NoInfer<T>; label: string }[];
  onChange(value: NoInfer<T>): void;
}

/** Opciones excluyentes en una fila de botones (pocas opciones, siempre a la vista). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
