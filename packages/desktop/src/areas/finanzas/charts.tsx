import { formatDate, formatMoney, formatMoneyShort, formatMonth, formatMonthShort, monthRange } from '@ger/shared';
import type { ResumenMes, TotalCategoria } from '@ger/shared/areas/finanzas/movimientos.ts';
import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tokens } from '../../theme/index.ts';
import styles from './charts.module.css';

/**
 * Gráficos de Finanzas. Colores, grilla y textos salen del tema
 * (`tokens.chart`); para cambiar el aspecto no hace falta tocar este archivo.
 */

const CHART_HEIGHT = 220;
const axisTick = { fill: tokens.chart.label, fontSize: 12 };

// --- Partes comunes ------------------------------------------------------------

interface TooltipRow {
  color: string;
  label: string;
  value: number;
}

/** Tooltip: el valor primero y bien visible; la serie, al lado y más suave. */
function ChartTooltip({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipTitle}>{title}</p>
      {rows.map((row) => (
        <p key={row.label} className={styles.tooltipRow}>
          <span className={styles.key} style={{ background: row.color }} aria-hidden="true" />
          <strong>{formatMoney(row.value)}</strong>
          <span className={styles.tooltipLabel}>{row.label}</span>
        </p>
      ))}
      {footer && <p className={styles.tooltipFooter}>{footer}</p>}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span className={styles.swatch} style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** El mes elegido se marca en negrita en el eje. */
interface TickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
}

function MonthTick({ x, y, payload, selected }: TickProps & { selected: string }) {
  const value = String(payload?.value ?? '');
  const isSelected = value === selected;
  return (
    <text
      x={Number(x)}
      y={Number(y) + 12}
      textAnchor="middle"
      fontSize={12}
      fill={isSelected ? tokens.color.text : tokens.chart.label}
      fontWeight={isSelected ? 700 : 400}
    >
      {formatMonthShort(value)}
    </text>
  );
}

// --- Ingresos y gastos por mes --------------------------------------------------

interface MonthlyChartProps {
  meses: readonly ResumenMes[];
  selected: string;
  onSelectMonth(mes: string): void;
}

/** Barras de ingresos y gastos de cada mes. Tocar un mes lo abre. */
export function MonthlyChart({ meses, selected, onSelectMonth }: MonthlyChartProps) {
  return (
    <div>
      <Legend
        items={[
          { color: tokens.chart.income, label: 'Ingresos' },
          { color: tokens.chart.expense, label: 'Gastos' },
        ]}
      />
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart
          data={[...meses]}
          barGap={2}
          barCategoryGap="22%"
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          onClick={(state) => {
            const mes = meses[Number(state.activeIndex)]?.mes;
            if (mes) onSelectMonth(mes);
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid vertical={false} stroke={tokens.chart.grid} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={{ stroke: tokens.chart.axis }}
            interval={0}
            tick={(props: TickProps) => <MonthTick {...props} selected={selected} />}
          />
          <YAxis tickFormatter={formatMoneyShort} tickLine={false} axisLine={false} tick={axisTick} width={76} />
          <Tooltip
            cursor={{ fill: tokens.color.surfaceAlt, opacity: 0.6 }}
            content={({ active, payload }) => {
              const mes = payload?.[0]?.payload as ResumenMes | undefined;
              if (!active || !mes) return null;
              return (
                <ChartTooltip
                  title={formatMonth(mes.mes)}
                  rows={[
                    { color: tokens.chart.income, label: 'Ingresos', value: mes.ingresos },
                    { color: tokens.chart.expense, label: 'Gastos', value: mes.egresos },
                  ]}
                  footer={`Saldo del mes: ${formatMoney(mes.saldo)}`}
                />
              );
            }}
          />
          <Bar dataKey="ingresos" name="Ingresos" fill={tokens.chart.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="egresos" name="Gastos" fill={tokens.chart.expense} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Evolución del saldo acumulado ----------------------------------------------

/** Línea del saldo acumulado al cierre de cada mes. */
export function BalanceChart({ meses }: { meses: readonly ResumenMes[] }) {
  const negative = meses.some((m) => m.saldoAcumulado < 0);
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={[...meses]} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={tokens.chart.grid} />
        <XAxis
          dataKey="mes"
          tickFormatter={formatMonthShort}
          tickLine={false}
          axisLine={{ stroke: tokens.chart.axis }}
          interval={0}
          tick={axisTick}
        />
        <YAxis
          tickFormatter={formatMoneyShort}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          width={76}
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
        />
        {negative && <ReferenceLine y={0} stroke={tokens.chart.axis} />}
        <Tooltip
          cursor={{ stroke: tokens.chart.axis, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const mes = payload?.[0]?.payload as ResumenMes | undefined;
            if (!active || !mes) return null;
            return (
              <ChartTooltip
                title={`Al ${formatDate(monthRange(mes.mes).hasta, { year: true })}`}
                rows={[{ color: tokens.chart.balance, label: 'Saldo acumulado', value: mes.saldoAcumulado }]}
              />
            );
          }}
        />
        <Area
          type="linear"
          dataKey="saldoAcumulado"
          name="Saldo acumulado"
          stroke={tokens.chart.balance}
          strokeWidth={2}
          fill={tokens.chart.balance}
          fillOpacity={0.1}
          baseValue={0}
          dot={false}
          activeDot={{ r: 5, fill: tokens.chart.balance, stroke: tokens.color.surface, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Por categoría ----------------------------------------------------------------

interface CategoryBarsProps {
  items: readonly TotalCategoria[];
  color: string;
  selected: string | null;
  onSelect(categoria: string | null): void;
}

/**
 * Barras horizontales ordenadas, de mayor a menor, con el monto y el % del
 * total. Tocar una categoría filtra la lista de movimientos.
 */
export function CategoryBars({ items, color, selected, onSelect }: CategoryBarsProps) {
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const max = items[0]?.total ?? 0;
  return (
    <ul className={styles.categories}>
      {items.map((item) => {
        const isSelected = item.categoria === selected;
        return (
          <li key={item.categoria}>
            <button
              type="button"
              className={styles.category}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : item.categoria)}
              title={isSelected ? 'Mostrar todas las categorías' : `Ver solo ${item.categoria}`}
            >
              <span className={styles.categoryName}>{item.categoria}</span>
              <span className={styles.categoryValue}>
                {formatMoney(item.total)}
                <span className={styles.share}>{Math.round((item.total / total) * 100)}%</span>
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.bar} style={{ width: `${(item.total / max) * 100}%`, background: color }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Tabla (los mismos datos, sin depender del color ni del mouse) ---------------

export function MonthlyTable({ meses }: { meses: readonly ResumenMes[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Mes</th>
          <th scope="col">Ingresos</th>
          <th scope="col">Gastos</th>
          <th scope="col">Saldo del mes</th>
          <th scope="col">Saldo acumulado</th>
        </tr>
      </thead>
      <tbody>
        {[...meses].reverse().map((m) => (
          <tr key={m.mes}>
            <th scope="row">{formatMonth(m.mes)}</th>
            <td>{formatMoney(m.ingresos)}</td>
            <td>{formatMoney(m.egresos)}</td>
            <td>{formatMoney(m.saldo)}</td>
            <td>{formatMoney(m.saldoAcumulado)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
