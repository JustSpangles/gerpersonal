import { tokens, type Tokens } from './tokens.ts';

export { tokens };

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Nombre de la variable CSS de un token: cssVarName('color', 'surfaceAlt') → `--color-surface-alt`. */
export function cssVarName(group: string, name: string): string {
  return `--${group}-${kebab(name)}`;
}

/** Publica los tokens como variables CSS en `:root`. */
export function applyTheme(theme: Tokens = tokens, root: HTMLElement = document.documentElement): void {
  for (const [group, values] of Object.entries(theme)) {
    for (const [name, value] of Object.entries(values as Record<string, string>)) {
      root.style.setProperty(cssVarName(group, name), value);
    }
  }
}
