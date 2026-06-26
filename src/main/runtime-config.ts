import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface RuntimeConfig {
  hermes: {
    port: number
  }
  window: {
    width: number
    height: number
    margin: number
    alwaysOnTopLevel: 'normal' | 'floating' | 'torn-off-menu' | 'modal-panel' | 'main-menu' | 'status' | 'pop-up-menu' | 'screen-saver'
  }
  rendering: {
    disableHardwareAcceleration: boolean
    commandLineSwitches: string[]
  }
  tts: {
    provider: 'edge' | 'elevenlabs'
    audioTempDirName: string
    edgeTtsCommands: string[][]
    elevenLabsApiKey?: string
    elevenLabsVoiceId?: string
    elevenLabsModelId: string
    elevenLabsOutputFormat: string
    elevenLabsBaseUrl: string
    elevenLabsTimeoutMs: number
    ffmpegBin: string
    wslpathBin: string
    powershellBin: string
    voice: string
    maxTextLength: number
    edgeTtsTimeoutMs: number
    ffmpegTimeoutMs: number
    wslpathTimeoutMs: number
    playbackTimeoutMs: number
    cleanupTtlMs: number
    cleanupMaxBytes: number
    playbackMode: 'renderer' | 'windows' | 'both'
    voiceByAvatar: Record<string, string>
    windowsTempMount?: string
  }
}

loadDotEnv()

export const runtimeConfig: RuntimeConfig = {
  hermes: {
    port: readIntegerEnv('HERMES_PORT', 9120)
  },
  window: {
    width: readIntegerEnv('HERMES_WINDOW_WIDTH', 560),
    height: readIntegerEnv('HERMES_WINDOW_HEIGHT', 820),
    margin: readIntegerEnv('HERMES_WINDOW_MARGIN', 24),
    alwaysOnTopLevel: readAlwaysOnTopLevelEnv('HERMES_ALWAYS_ON_TOP_LEVEL', 'screen-saver')
  },
  rendering: {
    disableHardwareAcceleration: readBooleanEnv('HERMES_DISABLE_HARDWARE_ACCELERATION', true),
    commandLineSwitches: readListEnv('HERMES_ELECTRON_SWITCHES', [
      'disable-gpu',
      'ignore-gpu-blocklist',
      'enable-unsafe-swiftshader'
    ])
  },
  tts: {
    provider: readTtsProviderEnv(),
    audioTempDirName: readStringEnv('HERMES_TTS_TEMP_DIR_NAME', 'fern-avatar-tts'),
    edgeTtsCommands: readCommandListEnv('HERMES_EDGE_TTS_COMMANDS', [['edge-tts'], ['py', '-m', 'edge_tts'], ['python', '-m', 'edge_tts']]),
    elevenLabsApiKey: readOptionalStringEnv('HERMES_ELEVENLABS_API_KEY'),
    elevenLabsVoiceId: readOptionalStringEnv('HERMES_ELEVENLABS_VOICE_ID'),
    elevenLabsModelId: readStringEnv('HERMES_ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2'),
    elevenLabsOutputFormat: readStringEnv('HERMES_ELEVENLABS_OUTPUT_FORMAT', 'mp3_44100_128'),
    elevenLabsBaseUrl: readStringEnv('HERMES_ELEVENLABS_BASE_URL', 'https://api.elevenlabs.io'),
    elevenLabsTimeoutMs: readIntegerEnv('HERMES_ELEVENLABS_TIMEOUT_MS', 30_000),
    ffmpegBin: readStringEnv('HERMES_FFMPEG_BIN', 'ffmpeg'),
    wslpathBin: readStringEnv('HERMES_WSLPATH_BIN', 'wslpath'),
    powershellBin: readStringEnv('HERMES_POWERSHELL_BIN', 'powershell.exe'),
    voice: readStringEnv('HERMES_TTS_VOICE', 'en-US-AnaNeural'),
    maxTextLength: readIntegerEnv('HERMES_TTS_MAX_TEXT_LENGTH', 300),
    edgeTtsTimeoutMs: readIntegerEnv('HERMES_EDGE_TTS_TIMEOUT_MS', 30_000),
    ffmpegTimeoutMs: readIntegerEnv('HERMES_FFMPEG_TIMEOUT_MS', 5_000),
    wslpathTimeoutMs: readIntegerEnv('HERMES_WSLPATH_TIMEOUT_MS', 5_000),
    playbackTimeoutMs: readIntegerEnv('HERMES_TTS_PLAYBACK_TIMEOUT_MS', 60_000),
    cleanupTtlMs: readIntegerEnv('HERMES_TTS_CLEANUP_TTL_MS', 86_400_000),
    cleanupMaxBytes: readIntegerEnv('HERMES_TTS_CLEANUP_MAX_BYTES', 104_857_600),
    playbackMode: readPlaybackModeEnv(),
    voiceByAvatar: readRecordEnv('HERMES_TTS_VOICE_BY_AVATAR', {
      hiyori: 'en-US-AriaNeural',
      chitose: 'en-US-GuyNeural'
    }),
    windowsTempMount: readOptionalStringEnv('HERMES_TTS_WINDOWS_TEMP_MOUNT')
  }
}

function loadDotEnv(): void {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key] !== undefined) continue

    process.env[key] = unquoteEnvValue(rawValue)
  }
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function readTtsProviderEnv(): RuntimeConfig['tts']['provider'] {
  const value = process.env.HERMES_TTS_PROVIDER?.trim().toLowerCase()
  return value === 'elevenlabs' ? 'elevenlabs' : 'edge'
}

function readStringEnv(name: string, fallback: string): string {
  return readOptionalStringEnv(name) ?? fallback
}

function readOptionalStringEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function readIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name]
  if (!value) return fallback

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase()
  if (!value) return fallback
  if (['1', 'true', 'yes', 'on'].includes(value)) return true
  if (['0', 'false', 'no', 'off'].includes(value)) return false
  return fallback
}

function readListEnv(name: string, fallback: string[]): string[] {
  const value = process.env[name]
  if (!value) return fallback

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.length > 0 ? entries : fallback
}

function readCommandListEnv(name: string, fallback: string[][]): string[][] {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return fallback

    const commands = parsed.filter((command): command is string[] => {
      return Array.isArray(command) && command.every((part) => typeof part === 'string' && part.trim() !== '')
    })

    return commands.length > 0 ? commands : fallback
  } catch {
    const commands = value
      .split(';')
      .map((command) => command.trim().split(/\s+/).filter(Boolean))
      .filter((command) => command.length > 0)

    return commands.length > 0 ? commands : fallback
  }
}

function readRecordEnv(name: string, fallback: Record<string, string>): Record<string, string> {
  const value = process.env[name]?.trim()
  if (!value) return fallback

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback

    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => {
      return typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[0].trim() !== '' && entry[1].trim() !== ''
    })

    return entries.length > 0 ? Object.fromEntries(entries) : fallback
  } catch {
    const entries = value
      .split(',')
      .map((entry) => entry.split('=').map((part) => part.trim()))
      .filter((entry): entry is [string, string] => entry.length === 2 && Boolean(entry[0]) && Boolean(entry[1]))

    return entries.length > 0 ? Object.fromEntries(entries) : fallback
  }
}

function readPlaybackModeEnv(): RuntimeConfig['tts']['playbackMode'] {
  const mode = process.env.HERMES_TTS_PLAYBACK_MODE?.trim().toLowerCase()
  if (mode === 'renderer' || mode === 'windows' || mode === 'both') return mode

  const legacyWindowsPlayback = process.env.HERMES_TTS_WINDOWS_PLAYBACK_ENABLED
  if (legacyWindowsPlayback !== undefined) {
    return readBooleanEnv('HERMES_TTS_WINDOWS_PLAYBACK_ENABLED', false) ? 'windows' : 'renderer'
  }

  return 'renderer'
}

function readAlwaysOnTopLevelEnv(name: string, fallback: RuntimeConfig['window']['alwaysOnTopLevel']): RuntimeConfig['window']['alwaysOnTopLevel'] {
  const value = readOptionalStringEnv(name)
  const allowed: RuntimeConfig['window']['alwaysOnTopLevel'][] = [
    'normal',
    'floating',
    'torn-off-menu',
    'modal-panel',
    'main-menu',
    'status',
    'pop-up-menu',
    'screen-saver'
  ]

  return allowed.includes(value as RuntimeConfig['window']['alwaysOnTopLevel'])
    ? (value as RuntimeConfig['window']['alwaysOnTopLevel'])
    : fallback
}
