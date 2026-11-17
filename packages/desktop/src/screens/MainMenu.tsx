import { TIMEZONE } from '@ger/shared';
import { areas, BODY_AREA_ID, getAreaIcon } from '../areas/registry.ts';
import { BodyMap, Button, StatusPill, Tile } from '../components/index.ts';
import { areaRoute, navigate } from '../router.ts';
import styles from './MainMenu.module.css';

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIMEZONE,
});

function today(): string {
  const text = dateFormat.format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Menú principal: rectángulo grande con el cuerpo (Salud) y un cuadrado por área. */
export function MainMenu() {
  const bodyArea = areas.get(BODY_AREA_ID);
  const tiles = areas.all.filter((area) => area.id !== BODY_AREA_ID);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Hola, Ger</h1>
          <p className={styles.date}>{today()}</p>
        </div>
        <div className={styles.actions}>
          <StatusPill />
          <Button variant="ghost" onClick={() => navigate({ name: 'settings' })}>
            Ajustes
          </Button>
        </div>
      </header>

      <main className={styles.grid}>
        {bodyArea && (
          <section className={styles.bodyPanel} aria-label={bodyArea.name}>
            <button type="button" className={styles.bodyTitle} onClick={() => navigate(areaRoute(bodyArea.id))}>
              <span aria-hidden="true">{bodyArea.emoji}</span> {bodyArea.name}
            </button>
            <div className={styles.bodyMap}>
              <BodyMap onSelect={(zona) => navigate(areaRoute(bodyArea.id, { zona }))} />
            </div>
          </section>
        )}

        <div className={styles.tiles}>
          {tiles.map((area) => (
            <Tile key={area.id} label={area.name} icon={getAreaIcon(area.id)} onClick={() => navigate(areaRoute(area.id))} />
          ))}
        </div>
      </main>
    </div>
  );
}
