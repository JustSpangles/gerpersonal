import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizePhone } from './bot/phone.ts';
import { configSchema, loadConfig } from './config.ts';

// Números de mentira: nunca usar números reales en los tests.
const TOKEN = 'token-de-prueba-1234567890';
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ger-config-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function load(content: object) {
  const path = join(dir, 'config.json');
  writeFileSync(path, JSON.stringify(content));
  return loadConfig(path);
}

describe('lista blanca del bot', () => {
  it('lee los números de config.json y los deja solo con dígitos', () => {
    const { config } = load({ apiToken: TOKEN, bot: { allowedNumbers: ['+54 9 11 0000-0001', '5491100000002'] } });
    expect(config.bot.allowedNumbers).toEqual(['5491100000001', '5491100000002']);
  });

  it('un config.json sin "bot" sigue andando: el bot no le responde a nadie', () => {
    expect(load({ apiToken: TOKEN }).config.bot.allowedNumbers).toEqual([]);
  });

  it('avisa si un número está mal escrito', () => {
    expect(() => load({ apiToken: TOKEN, bot: { allowedNumbers: ['11-0000'] } })).toThrow(/código de país[\s\S]*bot\.allowedNumbers\[0\]/);
  });

  it('el config.json nuevo trae la lista vacía', () => {
    const path = join(dir, 'nuevo.json');
    const { created, config } = loadConfig(path);
    expect(created).toBe(true);
    expect(config.bot.allowedNumbers).toEqual([]);
    expect(JSON.parse(readFileSync(path, 'utf8')).bot).toEqual({ allowedNumbers: [] });
  });

  it('config.example.json es válido y trae un número de ejemplo', () => {
    const example = JSON.parse(readFileSync(new URL('../../../config.example.json', import.meta.url), 'utf8'));
    expect(configSchema.parse(example).bot.allowedNumbers).toEqual(['5491100000000']);
  });
});

describe('números de teléfono', () => {
  it('acepta el número escrito de cualquier forma o el JID de WhatsApp', () => {
    expect(normalizePhone('+54 9 11 0000-0001')).toBe('5491100000001');
    expect(normalizePhone('5491100000001@s.whatsapp.net')).toBe('5491100000001');
    expect(normalizePhone('5491100000001:12@s.whatsapp.net')).toBe('5491100000001');
  });
});
