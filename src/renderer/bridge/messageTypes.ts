export type HermesEmotion = 'neutral' | 'happy' | 'thinking' | 'annoyed' | 'sad'

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
