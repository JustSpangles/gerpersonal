import { useState, type FormEvent } from 'react';
import { normalizeCoreUrl } from '../../electron/bridge.ts';
import { Button, Card, PageHeader, TextField } from '../components/index.ts';
import { checkConnection, type ConnectionStatus } from '../core/client.ts';
import { useCore } from '../core/CoreProvider.tsx';
import styles from './Settings.module.css';

function describe(status: ConnectionStatus): { tone: 'ok' | 'warn' | 'danger'; text: string } {
  switch (status.state) {
    case 'ok':
      return { tone: 'ok', text: `Conectado al núcleo v${status.version}.` };
    case 'unauthorized':
      return { tone: 'warn', text: 'El núcleo responde, pero el token no coincide con el de su config.json.' };
    case 'offline':
      return { tone: 'danger', text: `${status.message}. ¿Está prendido el núcleo y la URL es correcta?` };
    case 'checking':
      return { tone: 'warn', text: 'Probando…' };
  }
}

/** Ajustes: dónde está el núcleo y con qué token entrar. */
export function Settings() {
  const { config, saveConfig } = useCore();
  const [coreUrl, setCoreUrl] = useState(config.coreUrl);
  const [apiToken, setApiToken] = useState(config.apiToken);
  const [result, setResult] = useState<ConnectionStatus | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const normalizedUrl = normalizeCoreUrl(coreUrl);
  const urlError = coreUrl.trim() && !normalizedUrl ? 'No es una URL válida (ej.: http://192.168.0.50:3210)' : null;
  const canSubmit = Boolean(normalizedUrl) && !busy;

  async function test() {
    if (!normalizedUrl) return;
    setBusy(true);
    setResult({ state: 'checking' });
    setResult(await checkConnection({ coreUrl: normalizedUrl, apiToken: apiToken.trim() }));
    setBusy(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!normalizedUrl) return;
    setBusy(true);
    await saveConfig({ coreUrl: normalizedUrl, apiToken: apiToken.trim() });
    setCoreUrl(normalizedUrl);
    setSaved(true);
    setBusy(false);
    await test();
  }

  const message = result && describe(result);

  return (
    <div className={styles.page}>
      <PageHeader title="Ajustes" subtitle="Conexión con el núcleo (el celular)" />
      <Card className={styles.card}>
        <form className={styles.form} onSubmit={save}>
          <TextField
            label="URL del núcleo"
            value={coreUrl}
            onChange={(value) => {
              setCoreUrl(value);
              setSaved(false);
            }}
            placeholder="http://192.168.0.50:3210"
            spellCheck={false}
            error={urlError}
            hint="En casa: la IP local del celular. Afuera: su IP de Tailscale. El puerto por defecto es 3210."
          />
          <TextField
            label="Token"
            type="password"
            value={apiToken}
            onChange={(value) => {
              setApiToken(value);
              setSaved(false);
            }}
            autoComplete="off"
            spellCheck={false}
            hint={'Es el valor de "apiToken" en el config.json del núcleo.'}
          />
          <div className={styles.buttons}>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              Guardar
            </Button>
            <Button onClick={() => void test()} disabled={!canSubmit}>
              Probar conexión
            </Button>
            {saved && <span className={styles.saved}>Guardado</span>}
          </div>
          {message && (
            <p className={`${styles.result} ${styles[message.tone]}`} role="status">
              {message.text}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
