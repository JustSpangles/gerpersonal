import { nombreZona } from '@ger/shared/areas/salud/zonas.ts';
import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import cuerpoSvg from '../assets/cuerpo.svg?raw';
import styles from './BodyMap.module.css';

interface BodyMapProps {
  onSelect(zona: string): void;
  /** Zona marcada (p. ej. la que se está viendo en Salud). */
  selected?: string | undefined;
}

const ZONE_SELECTOR = '[id^="zona-"]';

function zoneOf(target: EventTarget | null): string | undefined {
  const element = target instanceof Element ? target.closest(ZONE_SELECTOR) : null;
  return element?.id.slice('zona-'.length);
}

/**
 * Cuerpo humano clickeable. El dibujo es `src/assets/cuerpo.svg` y se puede
 * reemplazar por otro: cada zona tiene que tener `id="zona-<id>"` con los ids
 * de `ZONAS_CUERPO` (un test lo verifica).
 */
export function BodyMap({ onSelect, selected }: BodyMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string>();

  useEffect(() => {
    for (const element of ref.current?.querySelectorAll<SVGElement>(ZONE_SELECTOR) ?? []) {
      const zona = element.id.slice('zona-'.length);
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', nombreZona(zona) ?? zona);
      element.toggleAttribute('data-selected', zona === selected);
    }
  }, [selected]);

  const select = (event: SyntheticEvent) => {
    const zona = zoneOf(event.target);
    if (zona) onSelect(zona);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(event);
    }
  };

  const highlight = (event: SyntheticEvent) => setHovered(zoneOf(event.target));
  const label = hovered ?? selected;

  return (
    <figure className={styles.figure}>
      <div
        ref={ref}
        className={styles.body}
        onClick={select}
        onKeyDown={onKeyDown}
        onMouseOver={highlight}
        onFocus={highlight}
        onMouseLeave={() => setHovered(undefined)}
        onBlur={() => setHovered(undefined)}
        dangerouslySetInnerHTML={{ __html: cuerpoSvg }}
      />
      <figcaption className={styles.caption}>{label ? (nombreZona(label) ?? label) : 'Tocá una zona del cuerpo'}</figcaption>
    </figure>
  );
}
