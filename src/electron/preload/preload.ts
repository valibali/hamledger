import { contextBridge, ipcRenderer } from 'electron';
import type { QsoEntry } from '../../types/qso';
import type { WSJTXDecodeMessage } from '../../types/wsjtx';

contextBridge.exposeInMainWorld('electronAPI', {
  addQso: (qso: QsoEntry) => ipcRenderer.invoke('qso:add', qso),
  getAllDocs: () => ipcRenderer.invoke('qso:getAllDocs'),
  importAdif: () => ipcRenderer.invoke('adif:import'),
  selectAdifFile: () => ipcRenderer.invoke('adif:selectFile'),
  parseAdifFile: (filePath: string) => ipcRenderer.invoke('adif:parseFile', filePath),
  importAdifWithProgress: (filePath: string) =>
    ipcRenderer.invoke('adif:importWithProgress', filePath),
  onAdifImportProgress: (callback: (progress: { imported: number }) => void) => {
    ipcRenderer.on('adif:importProgress', (_, progress) => callback(progress));
  },
  saveAdifFile: (content: string) => ipcRenderer.invoke('adif:saveFile', content),
  deleteQso: (qsoId: string) => ipcRenderer.invoke('qso:delete', qsoId),
  onHamlibDownloadProgress: (callback: (progress: { progress: number }) => void) => {
    ipcRenderer.on('hamlib:downloadProgress', (_, progress) => callback(progress));
  },
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('settings:save', settings),
  updateQso: (qso: QsoEntry) => ipcRenderer.invoke('qso:update', qso),
  fetchDxSpots: (params: string) => ipcRenderer.invoke('fetchDxSpots', params),
  fetchPropagationData: () => ipcRenderer.invoke('fetchPropagationData'),
  fetchWeather: (lat: number, lon: number) => ipcRenderer.invoke('fetchWeather', lat, lon),
  rigctldConnect: (host: string, port: number, model?: number, device?: string) =>
    ipcRenderer.invoke('rigctld:connect', host, port, model, device),
  rigctldDisconnect: () => ipcRenderer.invoke('rigctld:disconnect'),
  rigctldCommand: (command: string) => ipcRenderer.invoke('rigctld:command', command),
  rigctldGetCapabilities: () => ipcRenderer.invoke('rigctld:capabilities'),
  rigctldRestart: () => ipcRenderer.invoke('rigctld:restart'),
  executeCommand: (command: string) => ipcRenderer.invoke('execute:command', command),
  downloadAndInstallHamlib: () => ipcRenderer.invoke('hamlib:downloadAndInstall'),
  checkRigctldInPath: () => ipcRenderer.invoke('hamlib:checkRigctldInPath'),
  addFirewallExceptions: () => ipcRenderer.invoke('firewall:addExceptions'),
  wsjtxStart: (port?: number) => ipcRenderer.invoke('wsjtx:start', port),
  wsjtxStop: () => ipcRenderer.invoke('wsjtx:stop'),
  wsjtxStatus: () => ipcRenderer.invoke('wsjtx:status'),
  onWSJTXDecode: (callback: (decode: WSJTXDecodeMessage) => void) => {
    ipcRenderer.on('wsjtx:decode', (_, decode) => callback(decode));
  },
  onWSJTXQSOLogged: (callback: (qso: QsoEntry) => void) => {
    ipcRenderer.on('wsjtx:qso-logged', (_, qso) => callback(qso));
  },
  onWSJTXAddQSO: (callback: (qso: QsoEntry) => void) => {
    console.log('🔧 Setting up wsjtx:add-qso IPC listener in preload');
    ipcRenderer.on('wsjtx:add-qso', (_, qso) => {
      console.log('📨 Received wsjtx:add-qso in preload:', qso);
      callback(qso);
    });
    console.log('✅ wsjtx:add-qso IPC listener set up in preload');
  },
  generateQslLabel: (labelData: any) => ipcRenderer.invoke('qsl:generateLabel', labelData),
});
