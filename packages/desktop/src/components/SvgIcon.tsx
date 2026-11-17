import styles from './SvgIcon.module.css';

interface SvgIconProps {
  /** Contenido de un archivo .svg propio (importado con `?raw`). */
  svg: string;
  className?: string;
}

/**
 * Dibuja un SVG de `src/assets/` dentro del HTML, así toma el color del tema
 * (`currentColor`). Solo para archivos del proyecto, nunca para contenido externo.
 */
export function SvgIcon({ svg, className }: SvgIconProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.icon, className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
