import { areas, getAreaView } from '../areas/registry.ts';
import { Card, EmptyState, PageHeader } from '../components/index.ts';

interface AreaScreenProps {
  areaId: string;
  query: Record<string, string>;
}

/** Busca el área y muestra su pantalla (propia o la vista vacía). */
export function AreaScreen({ areaId, query }: AreaScreenProps) {
  const area = areas.get(areaId);
  if (!area) {
    return (
      <>
        <PageHeader title="Área desconocida" />
        <Card>
          <EmptyState title={`No existe el área "${areaId}"`} />
        </Card>
      </>
    );
  }
  const View = getAreaView(area.id);
  return <View area={area} query={query} />;
}
