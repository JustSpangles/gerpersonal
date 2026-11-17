import { Card, EmptyState } from '../components/index.ts';
import { AreaLayout } from './AreaLayout.tsx';
import type { AreaViewProps } from './types.ts';

/** Pantalla de un área que todavía no tiene `View.tsx` propio. */
export function EmptyAreaView({ area }: AreaViewProps) {
  return (
    <AreaLayout area={area}>
      <Card>
        <EmptyState icon={area.emoji} title="Todavía no hay nada acá">
          <p>{area.description}</p>
          <p>Esta pantalla se arma en una próxima fase.</p>
        </EmptyState>
      </Card>
    </AreaLayout>
  );
}
