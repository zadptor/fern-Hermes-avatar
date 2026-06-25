import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHermesWebSocketServer, type HermesWebSocketServer } from './websocket-server.js'

// WSL / headless: force software rendering so WebGL/PixiJS don't crash
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.disableHardwareAcceleration()

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null
let hermesServer: HermesWebSocketServer | null = null
let isQuitting = false

function createWindow(): void {
  const display = screen.getPrimaryDisplay()
  const width = 400
  const height = 600
  const margin = 24
  const { x, y, width: workWidth, height: workHeight } = display.workArea

  mainWindow = new BrowserWindow({
    width,
    height,
    x: x + workWidth - width - margin,
    y: y + workHeight - height - margin,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: true,
    type: 'panel',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  hermesServer = createHermesWebSocketServer({
    port: 9120,
    onEvent: (event) => mainWindow?.webContents.send('hermes-event', event),
    onStatusChange: (status) => mainWindow?.webContents.send('hermes-status', status)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('hermes-get-status', () => hermesServer?.getStatus() ?? { isListening: false, clients: 0 })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  hermesServer?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
