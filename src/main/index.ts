import { app, BrowserWindow, ipcMain, protocol, screen } from 'electron'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { createHermesWebSocketServer, type HermesWebSocketServer } from './websocket-server.js'

// WSL / headless: allow SwiftShader software WebGL so PixiJS/Live2D can render.
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-unsafe-swiftshader')
app.disableHardwareAcceleration()

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let mainWindow: BrowserWindow | null = null
let hermesServer: HermesWebSocketServer | null = null
let isQuitting = false

function logRuntime(message: string): void {
  const line = `${new Date().toISOString()} ${message}\n`
  try {
    const logDir = join(app.getPath('userData'), 'logs')
    mkdirSync(logDir, { recursive: true })
    appendFileSync(join(logDir, 'runtime.log'), line)
  } catch {
    // Best-effort diagnostics only.
  }
  console.log(message)
}

function createWindow(): void {
  const display = screen.getPrimaryDisplay()
  const width = 560
  const height = 820
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
      preload: join(__dirname, '../preload/index.mjs'),
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
    port: 9120,
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

// ── Register custom protocol for audio file serving ───────────────────

const audioTmpDir = join(app.getPath('temp'), 'fern-avatar-tts')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hermes-audio',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

// ── TTS: Generate speech using edge-tts CLI ────────────────────────────

const edgeTtsBin = '/home/farihim/.local/bin/edge-tts'
const ffmpegBin = '/usr/bin/ffmpeg'
const winDirMnt = '/mnt/c/Users/USER/AppData/Local/Temp/fern-avatar-tts'

function generateSpeak(text: string): Promise<{ wslPath: string; winMntWav: string; winWav: string }> {
  return new Promise((resolve, reject) => {
    mkdirSync(audioTmpDir, { recursive: true })
    mkdirSync(winDirMnt, { recursive: true })
    const wslPath = join(audioTmpDir, `speak_${Date.now()}.mp3`)
    const wavPath = join(audioTmpDir, `speak_${Date.now()}.wav`)

    logRuntime(`[tts] generating speech: "${text.slice(0, 60)}..."`)

    execFile(
      edgeTtsBin,
      ['--voice', 'en-US-AnaNeural', '--text', text, '--write-media', wslPath],
      { timeout: 30_000 },
      (err) => {
        if (err) {
          logRuntime(`[tts] edge-tts failed: ${err}`)
          reject(err)
          return
        }
        logRuntime(`[tts] mp3 written: ${wslPath}`)

        // Convert MP3 → WAV with ffmpeg
        execFile(
          ffmpegBin,
          ['-y', '-i', wslPath, '-acodec', 'pcm_s16le', '-ar', '22050', wavPath],
          { timeout: 10_000 },
          (ffErr) => {
            if (ffErr) {
              logRuntime(`[tts] ffmpeg conversion failed: ${ffErr}`)
              reject(ffErr)
              return
            }
            logRuntime(`[tts] wav written: ${wavPath}`)

            // Copy WAV to Windows temp
            const winMntWav = join(winDirMnt, `speak_${Date.now()}.wav`)
            try {
              const data = readFileSync(wavPath)
              writeFileSync(winMntWav, data)
            } catch (copyErr) {
              logRuntime(`[tts] copy to Windows failed: ${copyErr}`)
              reject(copyErr)
              return
            }

            // Also get Windows path via wslpath
            execFile('wslpath', ['-w', winMntWav], { timeout: 5_000 }, (wpErr, winW) => {
              if (wpErr) {
                logRuntime(`[play] wslpath failed: ${wpErr}`)
                reject(wpErr)
                return
              }
              const winWav = winW.trim()
              logRuntime(`[tts] Windows WAV: ${winWav}`)
              resolve({ wslPath, winMntWav, winWav })
            })
          }
        )
      }
    )
  })
}

// ── Play audio through Windows speakers via PowerShell SoundPlayer ─────

function playOnWindows(winWav: string): void {
  logRuntime(`[play] playing WAV: ${winWav}`)
  // SoundPlayer plays WAV natively — completely headless, synchronous, no window
  execFile('powershell.exe', [
    '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
    `(New-Object Media.SoundPlayer '${winWav}').PlaySync()`
  ], { timeout: 60_000 }, (psErr) => {
    if (psErr) logRuntime(`[play] playback error: ${psErr}`)
    else logRuntime(`[play] playback complete`)
  })
}

// ── IPC handlers ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  protocol.handle('hermes-audio', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)
    logRuntime(`[protocol] serving audio: ${filePath}`)
    const data = readFileSync(filePath)
    return new Response(data, {
      headers: { 'Content-Type': 'audio/mpeg' }
    })
  })

  ipcMain.handle('hermes-get-status', () => hermesServer?.getStatus() ?? { isListening: false, clients: 0 })

  ipcMain.handle('hermes-speak', async (_event, text: string) => {
    logRuntime(`[speak] requested: "${text.slice(0, 80)}..."`)
    try {
      const { wslPath, winWav } = await generateSpeak(text)
      playOnWindows(winWav)
      const protocolUrl = `hermes-audio://localhost${wslPath}`
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hermes-audio-play', { url: protocolUrl, path: wslPath })
      }
      return { ok: true, path: wslPath, url: protocolUrl }
    } catch (err) {
      logRuntime(`[speak] error: ${err}`)
      return { ok: false, error: String(err) }
    }
  })

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
