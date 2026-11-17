import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge, DesktopConfig } from './bridge.ts';

/** Única puerta entre la interfaz y Electron: `window.gerDesktop`. */
const bridge: DesktopBridge = {
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<DesktopConfig>,
  saveConfig: (config) => ipcRenderer.invoke('config:save', config) as Promise<DesktopConfig>,
};

contextBridge.exposeInMainWorld('gerDesktop', bridge);
