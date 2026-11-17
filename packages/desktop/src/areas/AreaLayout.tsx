import type { AreaDefinition } from '@ger/shared';
import type { ReactNode } from 'react';
import { PageHeader, StatusPill } from '../components/index.ts';
import styles from './AreaLayout.module.css';

interface AreaLayoutProps {
  area: AreaDefinition;
  subtitle?: ReactNode;
  children: ReactNode;
}

/** Marco común de las pantallas de área: encabezado con volver, nombre y código. */
export function AreaLayout({ area, subtitle, children }: AreaLayoutProps) {
  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <>
            <span aria-hidden="true">{area.emoji}</span> {area.name}
          </>
        }
        subtitle={subtitle ?? `Códigos ${area.prefix}1, ${area.prefix}2, ${area.prefix}3…`}
        actions={<StatusPill />}
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
