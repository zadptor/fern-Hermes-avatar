import { contextBridge, ipcRenderer } from 'electron'
import type { HermesAudioPayload, HermesAvatarId, HermesOverlayEvent, HermesSpeakResult, HermesStatus } from '../shared/hermesProtocol.js'

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
  speak(text: string, avatarId?: HermesAvatarId): Promise<HermesSpeakResult> {
    return ipcRenderer.invoke('hermes-speak', text, avatarId)
  },
  /** Notification from main process to play a local audio file. */
  onAudioPlay(callback: (payload: HermesAudioPayload) => void) {
    const listener = (_: Electron.IpcRendererEvent, payload: HermesAudioPayload): void => callback(payload)
    ipcRenderer.on('hermes-audio-play', listener)
    return () => ipcRenderer.removeListener('hermes-audio-play', listener)
  }
})
