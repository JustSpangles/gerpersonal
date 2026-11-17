import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

/** Panel con fondo, borde y sombra del tema. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={[styles.card, className].filter(Boolean).join(' ')} {...props} />;
}
