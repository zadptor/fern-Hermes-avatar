import { app, protocol } from 'electron'
import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import type { HermesAudioPayload, HermesAvatarId, HermesSpeakResult } from '../shared/hermesProtocol.js'
import { runtimeConfig } from './runtime-config.js'

export interface TtsService {
  speak: (text: string, avatarId?: HermesAvatarId) => Promise<HermesSpeakResult>
  registerProtocol: () => void
}

export function createTtsService(options: {
  onAudioReady: (payload: HermesAudioPayload) => void
  log: (message: string) => void
}): TtsService {
  const config = runtimeConfig.tts
  const audioTempDir = join(app.getPath('temp'), config.audioTempDirName)
  let playbackQueue: Promise<void> = Promise.resolve()

  function registerProtocol(): void {
    protocol.handle('hermes-audio', (request) => {
      const filePath = resolve(decodeURIComponent(new URL(request.url).pathname))
      if (!isPathInside(filePath, audioTempDir)) {
        options.log(`[protocol] blocked audio path outside temp directory: ${filePath}`)
        return new Response('Not found', { status: 404 })
      }

      options.log(`[protocol] serving audio: ${filePath}`)
      try {
        const data = readFileSync(filePath)
        return new Response(data, {
          headers: { 'Content-Type': 'audio/mpeg' }
        })
      } catch (err) {
        options.log(`[protocol] failed to read audio: ${err}`)
        return new Response('Not found', { status: 404 })
      }
    })
  }

  async function speak(text: string, avatarId?: HermesAvatarId): Promise<HermesSpeakResult> {
    const speakText = text.length > config.maxTextLength ? `${text.slice(0, config.maxTextLength)}...` : text
    const voice = resolveVoice(avatarId)
    options.log(`[speak] requested with ${voice}: "${speakText.slice(0, 80)}..."`)

    try {
      const { mp3Path, windowsWavPath } = await generateSpeech(speakText, voice)
      if (windowsWavPath) {
        playOnWindows(windowsWavPath)
      }

      const protocolUrl = `hermes-audio://localhost${mp3Path}`
      if (config.playbackMode === 'renderer' || config.playbackMode === 'both') {
        options.onAudioReady({ url: protocolUrl, path: mp3Path })
      }
      return { ok: true, path: mp3Path, url: protocolUrl, voice }
    } catch (err) {
      options.log(`[speak] error: ${err}`)
      return { ok: false, error: String(err) }
    }
  }

  function generateSpeech(text: string, voice: string): Promise<{ mp3Path: string; windowsWavPath?: string }> {
    return new Promise((resolvePromise, reject) => {
      mkdirSync(audioTempDir, { recursive: true })
      if (config.windowsTempMount) {
        mkdirSync(config.windowsTempMount, { recursive: true })
      }

      const fileBase = `speak_${Date.now()}`
      const mp3Path = join(audioTempDir, `${fileBase}.mp3`)
      const wavPath = join(audioTempDir, `${fileBase}.wav`)

      options.log(`[tts] generating speech: "${text.slice(0, 60)}..."`)
      runEdgeTts(voice, text, mp3Path)
        .then(() => {
        options.log(`[tts] mp3 written: ${mp3Path}`)
        if (config.playbackMode === 'renderer') {
          resolvePromise({ mp3Path })
          return
        }

        convertToWav(mp3Path, wavPath, resolvePromise, reject)
        })
        .catch(reject)
    })
  }

  function runEdgeTts(voice: string, text: string, mp3Path: string): Promise<void> {
    return tryEdgeTtsCommand(0, voice, text, mp3Path)
  }

  function tryEdgeTtsCommand(index: number, voice: string, text: string, mp3Path: string): Promise<void> {
    const command = config.edgeTtsCommands[index]
    if (!command) {
      return Promise.reject(new Error(`No usable edge-tts command found. Tried: ${formatTtsCommands(config.edgeTtsCommands)}`))
    }

    const [bin, ...baseArgs] = command
    const args = [...baseArgs, '--voice', voice, '--text', text, '--write-media', mp3Path]
    options.log(`[tts] running: ${[bin, ...baseArgs].join(' ')}`)

    return new Promise((resolveCommand, rejectCommand) => {
      execFile(bin, args, { timeout: config.edgeTtsTimeoutMs }, (err) => {
        if (!err) {
          resolveCommand()
          return
        }

        options.log(`[tts] command failed: ${[bin, ...baseArgs].join(' ')}: ${err}`)
        if ('code' in err && err.code === 'ENOENT') {
          tryEdgeTtsCommand(index + 1, voice, text, mp3Path).then(resolveCommand).catch(rejectCommand)
          return
        }

        rejectCommand(err)
      })
    })
  }

  function convertToWav(
    mp3Path: string,
    wavPath: string,
    resolvePromise: (value: { mp3Path: string; windowsWavPath?: string }) => void,
    reject: (reason?: unknown) => void
  ): void {
    execFile(config.ffmpegBin, ['-y', '-i', mp3Path, '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wavPath], { timeout: config.ffmpegTimeoutMs }, (ffErr) => {
      if (ffErr) {
        options.log(`[tts] ffmpeg conversion failed: ${ffErr}`)
        reject(ffErr)
        return
      }

      options.log(`[tts] wav written: ${wavPath}`)
      resolveWindowsWavPath(mp3Path, wavPath, resolvePromise, reject)
    })
  }

  function resolveWindowsWavPath(
    mp3Path: string,
    wavPath: string,
    resolvePromise: (value: { mp3Path: string; windowsWavPath?: string }) => void,
    reject: (reason?: unknown) => void
  ): void {
    let mountedWavPath = wavPath

    if (config.windowsTempMount) {
      mountedWavPath = join(config.windowsTempMount, `speak_${Date.now()}.wav`)
      try {
        writeFileSync(mountedWavPath, readFileSync(wavPath))
      } catch (copyErr) {
        options.log(`[tts] copy to Windows failed: ${copyErr}`)
        reject(copyErr)
        return
      }
    }

    execFile(config.wslpathBin, ['-w', mountedWavPath], { timeout: config.wslpathTimeoutMs }, (wpErr, windowsPath) => {
      if (wpErr) {
        options.log(`[play] wslpath failed: ${wpErr}`)
        reject(wpErr)
        return
      }

      const windowsWavPath = windowsPath.trim()
      options.log(`[tts] Windows WAV: ${windowsWavPath}`)
      resolvePromise({ mp3Path, windowsWavPath })
    })
  }

  function playOnWindows(windowsWavPath: string): void {
    playbackQueue = playbackQueue.then(() => {
      return new Promise<void>((resolvePlayback) => {
        options.log(`[play] playing WAV: ${windowsWavPath}`)
        execFile(
          config.powershellBin,
          ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `(New-Object Media.SoundPlayer '${escapePowerShellSingleQuotedString(windowsWavPath)}').PlaySync()`],
          { timeout: config.playbackTimeoutMs },
          (psErr) => {
            if (psErr) options.log(`[play] playback error: ${psErr}`)
            else options.log('[play] playback complete')
            resolvePlayback()
          }
        )
      })
    })
  }

  return { speak, registerProtocol }
}

function resolveVoice(avatarId: HermesAvatarId | undefined): string {
  if (avatarId && runtimeConfig.tts.voiceByAvatar[avatarId]) {
    return runtimeConfig.tts.voiceByAvatar[avatarId]
  }

  return runtimeConfig.tts.voice
}

function isPathInside(filePath: string, parentPath: string): boolean {
  const normalizedFile = normalize(filePath)
  const normalizedParent = normalize(resolve(parentPath))
  return normalizedFile === normalizedParent || normalizedFile.startsWith(`${normalizedParent}\\`) || normalizedFile.startsWith(`${normalizedParent}/`)
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replaceAll("'", "''")
}

function formatTtsCommands(commands: string[][]): string {
  return commands.map((command) => command.join(' ')).join('; ')
}

export function logRuntime(message: string): void {
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
