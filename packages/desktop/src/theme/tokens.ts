/**
 * Tema central: TODO lo visual sale de acá (colores, tipografía, espacios).
 * Se publica como variables CSS (`--color-accent`, `--space-md`…) y los
 * gráficos pueden usar estos mismos valores desde TypeScript.
 *
 * Para cambiar el diseño: editar estos valores, los íconos de
 * `src/assets/` y los componentes base de `src/components/`.
 */
export const tokens = {
  color: {
    bg: '#f3efe6',
    surface: '#fffdf8',
    surfaceAlt: '#ebe5d8',
    border: '#d8cfbd',
    text: '#26231d',
    textMuted: '#6d6657',
    accent: '#2e6b5a',
    accentHover: '#245646',
    accentSoft: '#dcebe4',
    accentText: '#ffffff',
    ok: '#2f7a46',
    warn: '#9a6510',
    danger: '#b0412e',
    bodyFill: '#e4dccb',
    bodyStroke: '#a2967e',
    bodyHover: '#2e6b5a',
  },
  /**
   * Gráficos. Colores de series validados para daltonismo (sobre `surface`):
   * ingresos y gastos van juntos en un gráfico; el saldo, siempre solo.
   */
  chart: {
    income: '#2a78d6',
    expense: '#eb6834',
    balance: '#008300',
    grid: '#ebe5d8',
    axis: '#d8cfbd',
    label: '#6d6657',
  },
  font: {
    family: '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif',
    sizeSm: '13px',
    sizeMd: '15px',
    sizeLg: '19px',
    sizeXl: '26px',
    sizeXxl: '34px',
    sizeXs: '12px',
    weightNormal: '400',
    weightBold: '650',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
  },
  radius: {
    sm: '6px',
    md: '12px',
    lg: '18px',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 2px rgb(40 30 10 / 6%), 0 6px 16px rgb(40 30 10 / 6%)',
    raised: '0 2px 4px rgb(40 30 10 / 8%), 0 12px 28px rgb(40 30 10 / 12%)',
  },
} as const;

export type Tokens = typeof tokens;
