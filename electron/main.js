const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#ffffff',
    title: 'TEACHERaiah',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Open external links in the system browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- Save-as-PDF: render the current print view to a PDF file the user picks ----
ipcMain.handle('export-pdf', async (_evt, opts = {}) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow
  if (!win) return { ok: false, error: 'No window available' }

  const defaultName = (opts.defaultName || 'schedule').replace(/[\\/:*?"<>|]+/g, '_') + '.pdf'

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Schedule as PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    const data = await win.webContents.printToPDF({
      printBackground: true,
      landscape: opts.landscape !== false,
      pageSize: opts.pageSize || 'A4',
      margins: { marginType: 'custom', top: 0.35, bottom: 0.35, left: 0.35, right: 0.35 },
      preferCSSPageSize: true,
    })
    fs.writeFileSync(filePath, data)
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) }
  }
})

// ---- Native print dialog (physical printer or "Microsoft Print to PDF") ----
ipcMain.handle('print-page', async (_evt, opts = {}) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow
  if (!win) return { ok: false, error: 'No window available' }
  return new Promise((resolve) => {
    win.webContents.print(
      { printBackground: true, landscape: opts.landscape !== false },
      (success, failureReason) => resolve({ ok: success, error: success ? undefined : failureReason })
    )
  })
})
