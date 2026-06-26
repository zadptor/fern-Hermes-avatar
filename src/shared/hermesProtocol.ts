export type HermesEmotion = 'neutral' | 'happy' | 'thinking' | 'annoyed' | 'sad'
export type HermesAvatarId = 'hiyori' | 'chitose' | 'haru' | 'mao' | 'mark' | 'natori' | 'ren' | 'rice' | 'wanko'

export type HermesOverlayEvent =
  | { type: 'assistant_message_started'; mode: 'text' | 'voice' }
  | { type: 'assistant_message_delta'; text: string }
  | { type: 'assistant_message_completed'; text: string; audioUrl?: string; emotion?: HermesEmotion }
  | { type: 'assistant_speaking'; volume: number; phoneme?: string }
  | { type: 'assistant_idle' }

export interface HermesStatus {
  isListening: boolean
  clients: number
  port: number
  lastError?: string
}

export interface HermesSpeakResult {
  ok: boolean
  path?: string
  url?: string
  voice?: string
  error?: string
}

export interface HermesAudioPayload {
  url: string
  path: string
}

export function isHermesOverlayEvent(value: unknown): value is HermesOverlayEvent {
  if (!value || typeof value !== 'object' || !('type' in value)) return false

  const event = value as Record<string, unknown>
  switch (event.type) {
    case 'assistant_message_started':
      return event.mode === 'text' || event.mode === 'voice'
    case 'assistant_message_delta':
      return typeof event.text === 'string'
    case 'assistant_message_completed':
      return typeof event.text === 'string' && isOptionalEmotion(event.emotion)
    case 'assistant_speaking':
      return typeof event.volume === 'number' && Number.isFinite(event.volume)
    case 'assistant_idle':
      return true
    default:
      return false
  }
}

function isOptionalEmotion(value: unknown): value is HermesEmotion | undefined {
  return (
    value === undefined ||
    value === 'neutral' ||
    value === 'happy' ||
    value === 'thinking' ||
    value === 'annoyed' ||
    value === 'sad'
  )
}
