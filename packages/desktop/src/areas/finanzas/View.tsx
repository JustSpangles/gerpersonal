import { addMonths, formatDate, formatMoney, formatMonth, isValidMonth, monthOf, monthRange, todayISO, type FieldValues } from '@ger/shared';
import {
  CAMPOS_MOVIMIENTO,
  type CategoriasResponse,
  type Movimiento,
  type MovimientoResponse,
  type MovimientosResponse,
  type ResumenFinanzas,
  type TipoMovimiento,
} from '@ger/shared/areas/finanzas/movimientos.ts';
import { useEffect, useState } from 'react';
import { Button, Card, Dialog, EmptyState, RecordForm, Segmented, Stat } from '../../components/index.ts';
import { useCore } from '../../core/CoreProvider.tsx';
import { useApiQuery } from '../../core/useApi.ts';
import { areaRoute, navigate } from '../../router.ts';
import { tokens } from '../../theme/index.ts';
import { AreaLayout } from '../AreaLayout.tsx';
import type { AreaViewProps } from '../types.ts';
import { BalanceChart, CategoryBars, MonthlyChart, MonthlyTable } from './charts.tsx';
import { MovimientosTable } from './MovimientosTable.tsx';
import styles from './View.module.css';

/**
 * Finanzas: un mes a la vez (`#/area/finanzas?mes=2026-11`).
 * Totales, gráficos y la lista de movimientos, con alta, edición y borrado.
 * Es la plantilla de pantalla para las demás áreas.
 */

const BASE = '/areas/finanzas';

type Editor = { mode: 'create'; tipo: TipoMovimiento } | { mode: 'update'; movimiento: Movimiento };
type FiltroTipo = 'todos' | TipoMovimiento;

const NOMBRE_TIPO: Record<TipoMovimiento, string> = { egreso: 'Gasto', ingreso: 'Ingreso' };

export default function FinanzasView({ area, query }: AreaViewProps) {
  const { api } = useCore();
  const hoy = todayISO();
  const mesActual = monthOf(hoy);
  const mes = query.mes && isValidMonth(query.mes) ? query.mes : mesActual;
  const { desde, hasta } = monthRange(mes);

  const resumen = useApiQuery<ResumenFinanzas>(`${BASE}/resumen?mes=${mes}&meses=12`);
  const lista = useApiQuery<MovimientosResponse>(`${BASE}/movimientos?desde=${desde}&hasta=${hasta}`);
  const categorias = useApiQuery<CategoriasResponse>(`${BASE}/categorias`);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [aBorrar, setABorrar] = useState<Movimiento | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [tipoCategorias, setTipoCategorias] = useState<TipoMovimiento>('egreso');
  const [verTabla, setVerTabla] = useState(false);

  // Al cambiar de mes, se limpian los filtros de la lista.
  useEffect(() => {
    setCategoria(null);
    setFiltroTipo('todos');
  }, [mes]);

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(timer);
  }, [aviso]);

  const irAMes = (m: string) => navigate(areaRoute(area.id, m === mesActual ? {} : { mes: m }));
  const recargar = () => {
    resumen.reload();
    lista.reload();
    categorias.reload();
  };

  async function guardar(values: FieldValues) {
    if (!editor) return;
    const { movimiento } =
      editor.mode === 'create'
        ? await api.post<MovimientoResponse>(`${BASE}/movimientos`, values)
        : await api.patch<MovimientoResponse>(`${BASE}/movimientos/${editor.movimiento.code}`, values);
    setEditor(null);
    setAviso(`✅ ${movimiento.code} guardado: ${describir(movimiento)}`);
    // Si quedó en otro mes, se va a ese mes para verlo.
    if (monthOf(movimiento.fecha) !== mes) irAMes(monthOf(movimiento.fecha));
    recargar();
  }

  async function borrar(movimiento: Movimiento) {
    await api.delete(`${BASE}/movimientos/${movimiento.code}`);
    setABorrar(null);
    setAviso(`🗑️ ${movimiento.code} borrado`);
    recargar();
  }

  const error = resumen.error ?? lista.error;
  const datos = resumen.data;
  const movimientos = (lista.data?.movimientos ?? []).filter(
    (m) => (filtroTipo === 'todos' || m.tipo === filtroTipo) && (categoria === null || m.categoria === categoria),
  );
  const cierre = datos?.meses.at(-1);

  return (
    <AreaLayout area={area} subtitle={`Movimientos ${area.prefix}1, ${area.prefix}2… · montos en pesos`}>
      <div className={styles.page}>
        <div className={styles.toolbar}>
          <div className={styles.monthNav}>
            <Button variant="ghost" onClick={() => irAMes(addMonths(mes, -1))} aria-label="Mes anterior">
              ‹
            </Button>
            <h2 className={styles.month}>{capitalizar(formatMonth(mes))}</h2>
            <Button variant="ghost" onClick={() => irAMes(addMonths(mes, 1))} aria-label="Mes siguiente">
              ›
            </Button>
            {mes !== mesActual && (
              <Button variant="ghost" size="sm" onClick={() => irAMes(mesActual)}>
                Ir a este mes
              </Button>
            )}
          </div>
          {aviso && (
            <p className={styles.aviso} role="status">
              {aviso}
            </p>
          )}
          <div className={styles.toolbarActions}>
            <Button variant="primary" onClick={() => setEditor({ mode: 'create', tipo: 'egreso' })}>
              + Gasto
            </Button>
            <Button onClick={() => setEditor({ mode: 'create', tipo: 'ingreso' })}>+ Ingreso</Button>
          </div>
        </div>

        {error && !datos ? (
          <Card>
            <EmptyState icon="⚠️" title="No se pudieron traer los datos">
              <p>{error.message}</p>
              <div className={styles.errorActions}>
                <Button onClick={recargar}>Reintentar</Button>
                {(error.status === 0 || error.status === 401) && (
                  <Button variant="ghost" onClick={() => navigate({ name: 'settings' })}>
                    Revisar Ajustes
                  </Button>
                )}
              </div>
            </EmptyState>
          </Card>
        ) : (
          <>
            <div className={styles.stats}>
              <Stat label="Ingresos del mes" value={datos ? formatMoney(datos.totales.ingresos) : '…'} />
              <Stat label="Gastos del mes" value={datos ? formatMoney(datos.totales.egresos) : '…'} />
              <Stat label="Saldo del mes" value={datos ? formatMoney(datos.totales.saldo) : '…'} detail="Ingresos menos gastos" />
              <Stat
                label="Saldo acumulado"
                value={cierre ? formatMoney(cierre.saldoAcumulado) : '…'}
                detail={`Al ${formatDate(hasta, { year: true })}`}
              />
            </div>

            <div className={styles.charts}>
              <Card className={styles.chartCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Saldo mensual</h3>
                    <p className={styles.cardSubtitle}>Ingresos y gastos de los últimos 12 meses. Tocá un mes para abrirlo.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setVerTabla((v) => !v)}>
                    {verTabla ? 'Ver gráfico' : 'Ver tabla'}
                  </Button>
                </div>
                {datos &&
                  (verTabla ? <MonthlyTable meses={datos.meses} /> : <MonthlyChart meses={datos.meses} selected={mes} onSelectMonth={irAMes} />)}
              </Card>

              <Card className={`${styles.chartCard} ${styles.categoriesCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Por categoría</h3>
                    <p className={styles.cardSubtitle}>{capitalizar(formatMonth(mes))}</p>
                  </div>
                  <Segmented
                    label="Tipo de movimiento"
                    value={tipoCategorias}
                    options={[
                      { value: 'egreso', label: 'Gastos' },
                      { value: 'ingreso', label: 'Ingresos' },
                    ]}
                    onChange={setTipoCategorias}
                  />
                </div>
                {datos && datos.porCategoria[tipoCategorias].length > 0 ? (
                  <CategoryBars
                    items={datos.porCategoria[tipoCategorias]}
                    color={tipoCategorias === 'egreso' ? tokens.chart.expense : tokens.chart.income}
                    selected={categoria}
                    onSelect={setCategoria}
                  />
                ) : (
                  <p className={styles.muted}>{datos ? `Sin ${tipoCategorias === 'egreso' ? 'gastos' : 'ingresos'} este mes.` : '…'}</p>
                )}
              </Card>

              <Card className={styles.chartCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <h3 className={styles.cardTitle}>Evolución del saldo</h3>
                    <p className={styles.cardSubtitle}>
                      Saldo acumulado al cierre de cada mes{cierre && <> · ahora {formatMoney(cierre.saldoAcumulado)}</>}
                    </p>
                  </div>
                </div>
                {datos && <BalanceChart meses={datos.meses} />}
              </Card>
            </div>

            <Card>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardTitle}>Movimientos</h3>
                  <p className={styles.cardSubtitle}>
                    {lista.data ? `${movimientos.length} de ${lista.data.movimientos.length}` : '…'}
                    {categoria && (
                      <>
                        {' · '}categoría <strong>{categoria}</strong>{' '}
                        <Button variant="ghost" size="sm" onClick={() => setCategoria(null)}>
                          Quitar filtro
                        </Button>
                      </>
                    )}
                  </p>
                </div>
                <Segmented
                  label="Mostrar"
                  value={filtroTipo}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'egreso', label: 'Gastos' },
                    { value: 'ingreso', label: 'Ingresos' },
                  ]}
                  onChange={setFiltroTipo}
                />
              </div>
              {movimientos.length > 0 ? (
                <MovimientosTable movimientos={movimientos} onEdit={(m) => setEditor({ mode: 'update', movimiento: m })} onDelete={setABorrar} />
              ) : (
                lista.data && (
                  <EmptyState icon={area.emoji} title={`Sin movimientos ${lista.data.movimientos.length > 0 ? 'con este filtro' : `en ${formatMonth(mes)}`}`}>
                    <p>Anotá uno con “+ Gasto” o “+ Ingreso”.</p>
                  </EmptyState>
                )
              )}
            </Card>
          </>
        )}
      </div>

      <Dialog
        open={editor !== null}
        title={editor?.mode === 'update' ? `Editar ${editor.movimiento.code}` : `Nuevo ${NOMBRE_TIPO[editor?.tipo ?? 'egreso'].toLowerCase()}`}
        onClose={() => setEditor(null)}
      >
        {editor && (
          <RecordForm
            fields={CAMPOS_MOVIMIENTO}
            mode={editor.mode}
            initial={editor.mode === 'update' ? editor.movimiento : { tipo: editor.tipo, fecha: hoy }}
            suggestions={{ categoria: categorias.data?.categorias ?? [] }}
            submitLabel="Guardar"
            onSubmit={guardar}
            onCancel={() => setEditor(null)}
          />
        )}
      </Dialog>

      <Dialog open={aBorrar !== null} title={`¿Borrar ${aBorrar?.code ?? ''}?`} onClose={() => setABorrar(null)}>
        {aBorrar && <ConfirmarBorrado movimiento={aBorrar} onConfirm={() => borrar(aBorrar)} onCancel={() => setABorrar(null)} />}
      </Dialog>
    </AreaLayout>
  );
}

function ConfirmarBorrado({ movimiento, onConfirm, onCancel }: { movimiento: Movimiento; onConfirm(): Promise<void>; onCancel(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <p>
        {NOMBRE_TIPO[movimiento.tipo]} de <strong>{describir(movimiento)}</strong>. No se puede deshacer y el código no se vuelve a usar.
      </p>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.dialogButtons}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onConfirm().catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : String(reason));
              setBusy(false);
            });
          }}
        >
          Borrar
        </Button>
      </div>
    </>
  );
}

/** `$ 1.500 · comida · 15/11`, como la confirmación del bot. */
function describir(m: Movimiento): string {
  return [formatMoney(m.monto), m.categoria, m.nota, formatDate(m.fecha)].filter(Boolean).join(' · ');
}

function capitalizar(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
