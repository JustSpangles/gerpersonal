import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * Ventana modal. Usa `<dialog>` del navegador: atrapa el foco y se cierra
 * con Esc. También se cierra tocando afuera.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.content}>
          <h2 className={styles.title}>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
