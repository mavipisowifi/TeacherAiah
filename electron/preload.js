const { contextBridge, ipcRenderer } = require('electron')

// Exposed to the renderer as window.scheduleAPI.
// The React app checks for this object to decide whether it is running
// inside Electron (one-click PDF export) or a plain browser (window.print fallback).
contextBridge.exposeInMainWorld('scheduleAPI', {
  isElectron: true,
  exportPDF: (opts) => ipcRenderer.invoke('export-pdf', opts),
  printPage: (opts) => ipcRenderer.invoke('print-page', opts),
})
