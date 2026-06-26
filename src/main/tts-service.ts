import { app, protocol } from 'electron'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize, resolve } from 'node:path'
import type { HermesAudioPayload, HermesAvatarId, HermesSpeakResult } from '../shared/hermesProtocol.js'
import { runtimeConfig } from './runtime-config.js'

export interface TtsService {
  speak: (text: string, avatarId?: HermesAvatarId) => Promise<HermesSpeakResult>
  cleanupAudio: (filePath: string) => void
  cleanupTempFiles: () => void
  registerProtocol: () => void
}

interface GeneratedSpeech {
  mp3Path: string
  windowsWavPath?: string
  wavCleanupPath?: string
}

interface InMemoryAudio {
  data: Buffer
  contentType: string
  createdAt: number
}

interface TempAudioFile {
  path: string
  size: number
  mtimeMs: number
}

export function createTtsService(options: {
  onAudioReady: (payload: HermesAudioPayload) => void
  log: (message: string) => void
}): TtsService {
  const config = runtimeConfig.tts
  const audioTempDir = join(app.getPath('temp'), config.audioTempDirName)
  const inMemoryAudio = new Map<string, InMemoryAudio>()
  let playbackQueue: Promise<void> = Promise.resolve()

  function registerProtocol(): void {
    protocol.handle('hermes-audio', (request) => {
      const url = new URL(request.url)
      const streamId = parseMemoryAudioId(url.pathname)
      if (streamId) {
        const audio = inMemoryAudio.get(streamId)
        if (!audio) {
          options.log(`[protocol] missing in-memory audio: ${streamId}`)
          return new Response('Not found', { status: 404 })
        }

        options.log(`[protocol] serving in-memory audio: ${streamId}`)
        return new Response(new Uint8Array(audio.data), {
          headers: { 'Content-Type': audio.contentType }
        })
      }

      const filePath = resolve(decodeURIComponent(url.pathname))
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
      cleanupTempFiles()
      cleanupInMemoryAudio()
      if (config.provider === 'elevenlabs') {
        const result = await speakWithElevenLabs(speakText, voice)
        return { ...result, voice }
      }

      const { mp3Path, windowsWavPath, wavCleanupPath } = await generateSpeech(speakText, voice)
      if (windowsWavPath && wavCleanupPath) {
        playOnWindows(windowsWavPath, wavCleanupPath)
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

  async function speakWithElevenLabs(text: string, voice: string): Promise<HermesSpeakResult> {
    const audio = await fetchElevenLabsAudio(text, voice)

    if (config.playbackMode === 'renderer') {
      const audioId = randomUUID()
      inMemoryAudio.set(audioId, audio)
      const protocolUrl = `hermes-audio://localhost/memory/${audioId}`
      options.onAudioReady({ url: protocolUrl, path: `memory:${audioId}` })
      return { ok: true, path: `memory:${audioId}`, url: protocolUrl }
    }

    const fileBase = `speak_${Date.now()}`
    const mp3Path = join(audioTempDir, `${fileBase}.mp3`)
    const wavPath = join(audioTempDir, `${fileBase}.wav`)

    mkdirSync(audioTempDir, { recursive: true })
    writeFileSync(mp3Path, audio.data)

    if (config.playbackMode === 'both') {
      const audioId = randomUUID()
      inMemoryAudio.set(audioId, audio)
      const protocolUrl = `hermes-audio://localhost/memory/${audioId}`
      options.onAudioReady({ url: protocolUrl, path: `memory:${audioId}` })
    }

    if (config.playbackMode === 'windows' || config.playbackMode === 'both') {
      return await new Promise<HermesSpeakResult>((resolvePromise, reject) => {
        convertToWav(mp3Path, wavPath, (generated) => {
          cleanupAudio(generated.mp3Path)
          if (generated.windowsWavPath && generated.wavCleanupPath) {
            playOnWindows(generated.windowsWavPath, generated.wavCleanupPath)
          }

          const protocolUrl = `hermes-audio://localhost${mp3Path}`
          resolvePromise({ ok: true, path: mp3Path, url: protocolUrl })
        }, reject)
      })
    }

    const protocolUrl = `hermes-audio://localhost${mp3Path}`
    return { ok: true, path: mp3Path, url: protocolUrl }
  }

  async function fetchElevenLabsAudio(text: string, voice: string): Promise<InMemoryAudio> {
    const apiKey = config.elevenLabsApiKey
    if (!apiKey) {
      throw new Error('HERMES_ELEVENLABS_API_KEY is required when HERMES_TTS_PROVIDER=elevenlabs')
    }
    if (!voice) {
      throw new Error('HERMES_ELEVENLABS_VOICE_ID is required when HERMES_TTS_PROVIDER=elevenlabs')
    }

    const endpoint = new URL(`/v1/text-to-speech/${encodeURIComponent(voice)}/stream`, config.elevenLabsBaseUrl)
    endpoint.searchParams.set('output_format', config.elevenLabsOutputFormat)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.elevenLabsTimeoutMs)

    try {
      options.log(`[tts] requesting ElevenLabs speech with voice ${voice}`)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: config.elevenLabsModelId
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`ElevenLabs TTS failed with ${response.status}: ${errorText || response.statusText}`)
      }

      const contentType = response.headers.get('content-type') ?? 'audio/mpeg'
      const data = Buffer.from(await response.arrayBuffer())
      if (data.length === 0) {
        throw new Error('ElevenLabs TTS returned empty audio')
      }

      return { data, contentType, createdAt: Date.now() }
    } finally {
      clearTimeout(timeout)
    }
  }

  function generateSpeech(text: string, voice: string): Promise<GeneratedSpeech> {
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
    resolvePromise: (value: GeneratedSpeech) => void,
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
    resolvePromise: (value: GeneratedSpeech) => void,
    reject: (reason?: unknown) => void
  ): void {
    let mountedWavPath = wavPath

    if (config.windowsTempMount) {
      mountedWavPath = join(config.windowsTempMount, `speak_${Date.now()}.wav`)
      try {
        writeFileSync(mountedWavPath, readFileSync(wavPath))
        cleanupAudio(wavPath)
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
      resolvePromise({ mp3Path, windowsWavPath, wavCleanupPath: mountedWavPath })
    })
  }

  function playOnWindows(windowsWavPath: string, wavCleanupPath: string): void {
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
            cleanupAudio(wavCleanupPath)
            resolvePlayback()
          }
        )
      })
    })
  }

  function cleanupAudio(filePath: string): void {
    const memoryAudioId = parseMemoryAudioPath(filePath)
    if (memoryAudioId) {
      inMemoryAudio.delete(memoryAudioId)
      return
    }

    deleteGeneratedAudioFile(filePath, audioTempDir)
    if (config.windowsTempMount) {
      deleteGeneratedAudioFile(filePath, config.windowsTempMount)
    }
  }

  function cleanupTempFiles(): void {
    cleanupTempDirectory(audioTempDir)
    if (config.windowsTempMount) {
      cleanupTempDirectory(config.windowsTempMount)
    }
  }

  function cleanupInMemoryAudio(): void {
    const expiresBefore = Date.now() - config.cleanupTtlMs
    for (const [audioId, audio] of inMemoryAudio) {
      if (audio.createdAt < expiresBefore) {
        inMemoryAudio.delete(audioId)
      }
    }
  }

  function cleanupTempDirectory(directoryPath: string): void {
    if (!existsSync(directoryPath)) return

    const now = Date.now()
    const files = listGeneratedAudioFiles(directoryPath)

    for (const file of files) {
      if (now - file.mtimeMs > config.cleanupTtlMs) {
        deleteGeneratedAudioFile(file.path, directoryPath)
      }
    }

    const remainingFiles = listGeneratedAudioFiles(directoryPath).sort((left, right) => left.mtimeMs - right.mtimeMs)
    let totalBytes = remainingFiles.reduce((total, file) => total + file.size, 0)

    for (const file of remainingFiles) {
      if (totalBytes <= config.cleanupMaxBytes) break
      deleteGeneratedAudioFile(file.path, directoryPath)
      totalBytes -= file.size
    }
  }

  return { speak, cleanupAudio, cleanupTempFiles, registerProtocol }
}

function parseMemoryAudioId(pathname: string): string | null {
  const match = /^\/memory\/([^/]+)$/.exec(pathname)
  return match ? match[1] : null
}

function parseMemoryAudioPath(filePath: string): string | null {
  return filePath.startsWith('memory:') ? filePath.slice('memory:'.length) : null
}

function listGeneratedAudioFiles(directoryPath: string): TempAudioFile[] {
  try {
    return readdirSync(directoryPath)
      .map((entry) => join(directoryPath, entry))
      .filter((filePath) => isGeneratedAudioFile(filePath))
      .map((filePath) => {
        const stats = statSync(filePath)
        return { path: filePath, size: stats.size, mtimeMs: stats.mtimeMs }
      })
      .filter((file) => file.size > 0)
  } catch {
    return []
  }
}

function deleteGeneratedAudioFile(filePath: string, parentPath: string): void {
  if (!isPathInside(filePath, parentPath) || !isGeneratedAudioFile(filePath)) return

  try {
    unlinkSync(filePath)
  } catch {
    // Best-effort temp cleanup only.
  }
}

function isGeneratedAudioFile(filePath: string): boolean {
  const fileName = basename(filePath)
  const extension = extname(fileName).toLowerCase()
  return fileName.startsWith('speak_') && (extension === '.mp3' || extension === '.wav')
}

function resolveVoice(avatarId: HermesAvatarId | undefined): string {
  if (runtimeConfig.tts.provider === 'elevenlabs') {
    return runtimeConfig.tts.elevenLabsVoiceId ?? ''
  }

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
