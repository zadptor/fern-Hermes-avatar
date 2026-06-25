/// <reference types="vite/client" />

export type HermesStatus = {
  isListening: boolean
  clients: number
  port: number
  lastError?: string
}

export type HermesOverlayEvent =
  | { type: 'assistant_message_started'; mode: 'text' | 'voice' }
  | { type: 'assistant_message_delta'; text: string }
  | { type: 'assistant_message_completed'; text: string; audioUrl?: string; emotion?: 'neutral' | 'happy' | 'thinking' | 'annoyed' | 'sad' }
  | { type: 'assistant_speaking'; volume: number; phoneme?: string }
  | { type: 'assistant_idle' }

declare global {
  interface Window {
    hermes: {
      onEvent: (callback: (event: HermesOverlayEvent) => void) => () => void
      onStatus: (callback: (status: HermesStatus) => void) => () => void
      getStatus: () => Promise<HermesStatus>
      speak: (text: string) => Promise<{ ok: boolean; path?: string; url?: string; error?: string }>
      onAudioPlay: (callback: (payload: { url: string; path: string }) => void) => () => void
    }
  }
}
