import type { ReactNode } from 'react';
import { navigate } from '../router.ts';
import { Button } from './Button.tsx';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Botones o datos a la derecha. */
  actions?: ReactNode;
  /** Muestra el botón para volver al menú (por defecto, sí). */
  back?: boolean;
}

export function PageHeader({ title, subtitle, actions, back = true }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.main}>
        {back && (
          <Button variant="ghost" onClick={() => navigate({ name: 'menu' })}>
            ← Menú
          </Button>
        )}
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
