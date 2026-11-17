import { mkdirSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { loadAreaRegistry } from '@ger/shared/node';
import { buildServer } from './api/server.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { defaultMigrationDirs, findMigrations, migrate } from './db/migrate.ts';

/**
 * Arranque del núcleo: configuración → base de datos → migraciones →
 * registro de áreas → API. (El bot y el scheduler se suman en las fases 3 y 4.)
 */

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const { config, path: configPath, dataDir, created } = loadConfig();
if (created) {
  console.log(`Se creó ${configPath} con un token nuevo.`);
  console.log('Copiá el valor de "apiToken" en Ajustes del programa de PC.');
}

mkdirSync(join(dataDir, 'media'), { recursive: true });
const db = openDatabase(join(dataDir, 'app.db'));

const { applied } = migrate(db, findMigrations(defaultMigrationDirs()));
for (const migration of applied) console.log(`Migración aplicada: ${migration.name}`);

const areas = await loadAreaRegistry();

const app = buildServer({ db, areas, apiToken: config.apiToken, version, logger: { level: 'warn' } });
await app.listen({ port: config.port, host: config.host });

console.log(`Núcleo v${version} escuchando en el puerto ${config.port} · ${areas.all.length} áreas · datos en ${dataDir}`);
for (const address of lanAddresses()) console.log(`  Desde la PC: http://${address}:${config.port}`);

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  console.log(`\n${signal}: cerrando el núcleo…`);
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info && info.family === 'IPv4' && !info.internal)
    .map((info) => info!.address);
}
