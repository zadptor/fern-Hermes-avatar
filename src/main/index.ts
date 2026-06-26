import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HermesAvatarId } from '../shared/hermesProtocol.js'
import { runtimeConfig } from './runtime-config.js'
import { createTtsService, logRuntime } from './tts-service.js'
import { createHermesWebSocketServer, type HermesWebSocketServer } from './websocket-server.js'

for (const commandLineSwitch of runtimeConfig.rendering.commandLineSwitches) {
  app.commandLine.appendSwitch(commandLineSwitch)
}

if (runtimeConfig.rendering.disableHardwareAcceleration) {
  app.disableHardwareAcceleration()
}

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null
let hermesServer: HermesWebSocketServer | null = null
let isQuitting = false

const ttsService = createTtsService({
  log: logRuntime,
  onAudioReady: (payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('hermes-audio-play', payload)
    }
  }
})

function createWindow(): void {
  const display = screen.getPrimaryDisplay()
  const { x, y, width: workWidth, height: workHeight } = display.workArea
  const { width, height, margin } = runtimeConfig.window

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
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setAlwaysOnTop(true, runtimeConfig.window.alwaysOnTopLevel)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    logRuntime(`[renderer-console:${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logRuntime(`[renderer-gone] ${JSON.stringify(details)}`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logRuntime(`[renderer-load-failed] ${errorCode} ${errorDescription} ${validatedURL}`)
  })

  hermesServer = createHermesWebSocketServer({
    port: runtimeConfig.hermes.port,
    onEvent: (event) => {
      logRuntime(`[hermes-event] received: ${JSON.stringify(event)}`)
      mainWindow?.webContents.send('hermes-event', event)
    },
    onStatusChange: (status) => mainWindow?.webContents.send('hermes-status', status)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hermes-audio',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

app.whenReady().then(() => {
  ttsService.registerProtocol()

  ipcMain.handle('hermes-get-status', () => {
    return hermesServer?.getStatus() ?? { isListening: false, clients: 0, port: runtimeConfig.hermes.port }
  })
  ipcMain.handle('hermes-speak', async (_event, text: string, avatarId?: HermesAvatarId) => ttsService.speak(text, avatarId))

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
