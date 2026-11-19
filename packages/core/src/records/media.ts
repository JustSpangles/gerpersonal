import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { nowTime, todayISO } from '@ger/shared';

/**
 * Archivos de los registros (fotos), en `data/media/`. En la base se guarda
 * la ruta relativa a esa carpeta, siempre con `/` (sirve igual en Windows y en Android).
 *
 * Los archivos van en una carpeta por mes y con un nombre que se lee solo:
 * `2026-11/F14_2026-11-19_13-30.jpg` (fecha y hora de Argentina). Si ya hay
 * uno con ese nombre, se le suma `_2`, `_3`…
 */

/** Tipos de foto que se guardan → extensión del archivo. */
export const PHOTO_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface MediaStore {
  /** Ruta absoluta de `data/media/`. */
  readonly dir: string;
  /** Guarda un archivo de un registro y devuelve su ruta relativa (`2026-11/F14_….jpg`). */
  save(code: string, data: Uint8Array, mime: string, now?: Date): string;
  /** Ruta absoluta de un archivo guardado (para mandarlo por el bot o servirlo). */
  resolve(file: string): string;
  /** Borra un archivo guardado. Si ya no estaba, no pasa nada. */
  remove(file: string): void;
}

export function createMediaStore(dir: string): MediaStore {
  const root = resolve(dir);

  const resolveFile = (file: string): string => {
    const full = resolve(root, file);
    if (!full.startsWith(root + sep)) throw new Error(`Ruta de archivo fuera de la carpeta de fotos: ${file}`);
    return full;
  };

  return {
    dir: root,

    save(code, data, mime, now = new Date()) {
      const extension = PHOTO_TYPES[mime];
      if (!extension) throw new Error(`Tipo de archivo no soportado: ${mime}`);
      if (!/^[A-Z]\d+$/.test(code)) throw new Error(`Código inválido: ${code}`);

      const day = todayISO(now);
      const base = `${day.slice(0, 7)}/${code}_${day}_${nowTime(now).replace(':', '-')}`;
      let file = `${base}.${extension}`;
      for (let n = 2; existsSync(resolveFile(file)); n++) file = `${base}_${n}.${extension}`;

      const full = resolveFile(file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data, { flag: 'wx' });
      return file;
    },

    resolve: resolveFile,

    remove(file) {
      rmSync(resolveFile(file), { force: true });
    },
  };
}
