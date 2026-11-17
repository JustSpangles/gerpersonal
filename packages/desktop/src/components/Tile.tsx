import { SvgIcon } from './SvgIcon.tsx';
import styles from './Tile.module.css';

interface TileProps {
  label: string;
  /** SVG del ícono. Si falta, se muestra el nombre en grande. */
  icon?: string | undefined;
  onClick(): void;
}

/** Cuadrado del menú principal. */
export function Tile({ label, icon, onClick }: TileProps) {
  return (
    <button type="button" className={styles.tile} onClick={onClick} aria-label={label}>
      {icon ? <SvgIcon svg={icon} className={styles.icon} /> : <span className={styles.text}>{label}</span>}
      <span className={styles.caption}>{label}</span>
    </button>
  );
}
