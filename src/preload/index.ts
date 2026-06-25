import { contextBridge, ipcRenderer } from 'electron'

type HermesEmotion = 'neutral' | 'happy' | 'thinking' | 'annoyed' | 'sad'

type HermesOverlayEvent =
  | { type: 'assistant_message_started'; mode: 'text' | 'voice' }
  | { type: 'assistant_message_delta'; text: string }
  | { type: 'assistant_message_completed'; text: string; audioUrl?: string; emotion?: HermesEmotion }
  | { type: 'assistant_speaking'; volume: number; phoneme?: string }
  | { type: 'assistant_idle' }

interface HermesStatus {
  isListening: boolean
  clients: number
  port: number
  lastError?: string
}

contextBridge.exposeInMainWorld('hermes', {
  onEvent(callback: (event: HermesOverlayEvent) => void) {
    const listener = (_: Electron.IpcRendererEvent, event: HermesOverlayEvent): void => callback(event)
    ipcRenderer.on('hermes-event', listener)
    return () => ipcRenderer.removeListener('hermes-event', listener)
  },
  onStatus(callback: (status: HermesStatus) => void) {
    const listener = (_: Electron.IpcRendererEvent, status: HermesStatus): void => callback(status)
    ipcRenderer.on('hermes-status', listener)
    return () => ipcRenderer.removeListener('hermes-status', listener)
  },
  getStatus(): Promise<HermesStatus> {
    return ipcRenderer.invoke('hermes-get-status')
  },
  /** Request the main process to generate TTS audio for text and play it. */
  speak(text: string): Promise<{ ok: boolean; path?: string; error?: string }> {
    return ipcRenderer.invoke('hermes-speak', text)
  },
  /** Notification from main process to play a local audio file. */
  onAudioPlay(callback: (payload: { url: string; path: string }) => void) {
    const listener = (_: Electron.IpcRendererEvent, payload: { url: string; path: string }): void => callback(payload)
    ipcRenderer.on('hermes-audio-play', listener)
    return () => ipcRenderer.removeListener('hermes-audio-play', listener)
  }
})
