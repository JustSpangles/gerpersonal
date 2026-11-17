import { nombreZona } from '@ger/shared/areas/salud/zonas.ts';
import { BodyMap, Card, EmptyState } from '../../components/index.ts';
import { areaRoute, navigate } from '../../router.ts';
import { AreaLayout } from '../AreaLayout.tsx';
import type { AreaViewProps } from '../types.ts';
import styles from './View.module.css';

/** Salud: mapa del cuerpo a la izquierda y el historial de la zona a la derecha. */
export default function SaludView({ area, query }: AreaViewProps) {
  const zona = query.zona && nombreZona(query.zona) ? query.zona : undefined;
  const nombre = zona ? nombreZona(zona) : undefined;

  return (
    <AreaLayout area={area} subtitle={nombre ? `Zona: ${nombre}` : 'Todas las zonas'}>
      <div className={styles.layout}>
        <Card className={styles.body}>
          <BodyMap selected={zona} onSelect={(next) => navigate(areaRoute(area.id, next === zona ? {} : { zona: next }))} />
        </Card>
        <Card>
          <EmptyState icon={area.emoji} title={nombre ? `Sin registros de ${nombre.toLowerCase()}` : 'Sin registros todavía'}>
            <p>{area.description}</p>
            <p>El historial por zona se arma en la fase 6.</p>
          </EmptyState>
        </Card>
      </div>
    </AreaLayout>
  );
}
