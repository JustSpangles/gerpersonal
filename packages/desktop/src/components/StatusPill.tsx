import { useCore } from '../core/CoreProvider.tsx';
import { navigate } from '../router.ts';
import styles from './StatusPill.module.css';

/** Estado de la conexión con el núcleo. Al tocarlo, abre Ajustes. */
export function StatusPill() {
  const { status, config } = useCore();

  let tone: 'ok' | 'warn' | 'danger' | 'muted';
  let text: string;
  switch (status.state) {
    case 'checking':
      [tone, text] = ['muted', 'Conectando…'];
      break;
    case 'ok':
      [tone, text] = ['ok', 'Núcleo conectado'];
      break;
    case 'unauthorized':
      [tone, text] = ['warn', config.apiToken ? 'Token incorrecto' : 'Falta el token'];
      break;
    case 'offline':
      [tone, text] = ['danger', 'Sin conexión'];
      break;
  }

  return (
    <button
      type="button"
      className={`${styles.pill} ${styles[tone]}`}
      onClick={() => navigate({ name: 'settings' })}
      title={status.state === 'offline' ? status.message : config.coreUrl}
    >
      <span className={styles.dot} aria-hidden="true" />
      {text}
    </button>
  );
}
