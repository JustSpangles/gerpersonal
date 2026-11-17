import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { DEFAULT_DESKTOP_CONFIG, sanitizeConfig, type DesktopConfig } from './bridge.ts';

/**
 * Proceso principal de Electron. El programa de PC es solo un cliente: no
 * tiene base propia, todo lo pide a la API del núcleo. Acá solo se guarda la
 * configuración local (URL del núcleo y token).
 */

const configFile = () => join(app.getPath('userData'), 'config.json');

async function readConfig(): Promise<DesktopConfig> {
  try {
    return sanitizeConfig(JSON.parse(await readFile(configFile(), 'utf8')));
  } catch {
    return { ...DEFAULT_DESKTOP_CONFIG };
  }
}

async function saveConfig(raw: unknown): Promise<DesktopConfig> {
  const config = sanitizeConfig(raw);
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return config;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'Ger Personal',
    backgroundColor: '#f3efe6',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Los links externos se abren en el navegador, nunca dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(devUrl ?? 'file://')) event.preventDefault();
  });

  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  ipcMain.handle('config:get', () => readConfig());
  ipcMain.handle('config:save', (_event, raw: unknown) => saveConfig(raw));

  void app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
