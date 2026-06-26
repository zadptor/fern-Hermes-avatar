/// <reference types="vite/client" />

import type { HermesAudioPayload, HermesAvatarId, HermesOverlayEvent, HermesSpeakResult, HermesStatus } from '../shared/hermesProtocol'

declare global {
  interface Window {
    hermes: {
      onEvent: (callback: (event: HermesOverlayEvent) => void) => () => void
      onStatus: (callback: (status: HermesStatus) => void) => () => void
      getStatus: () => Promise<HermesStatus>
      speak: (text: string, avatarId?: HermesAvatarId) => Promise<HermesSpeakResult>
      onAudioPlay: (callback: (payload: HermesAudioPayload) => void) => () => void
    }
  }
}
