// src/electron/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  addQso: (qso: any) => ipcRenderer.invoke('qso:add', qso),
  getAllDocs: () => ipcRenderer.invoke('qso:getAllDocs')
})
