import type { ReactNode } from 'react';
import styles from './Stat.module.css';

interface StatProps {
  label: string;
  value: ReactNode;
  /** Aclaración chica debajo del valor. */
  detail?: ReactNode;
}

/** Un número destacado con su nombre (totales, récords…). */
export function Stat({ label, value, detail }: StatProps) {
  return (
    <div className={styles.stat}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}
