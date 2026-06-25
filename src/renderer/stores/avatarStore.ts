import { defineStore } from 'pinia'
import type { HermesEmotion, HermesOverlayEvent } from '../bridge/messageTypes'
import { defaultAvatarId, getAvatarDefinition } from '../live2d/avatarCatalog'
import type { AvatarId } from '../live2d/avatarCatalog'

type HermesMode = 'text' | 'voice'
const AVATAR_STORAGE_KEY = 'hermes-avatar-id'

interface AvatarState {
  currentAvatarId: AvatarId
  currentMessage: string
  emotion: HermesEmotion
  isSpeaking: boolean
  isThinking: boolean
  mode: HermesMode
  volume: number
  phoneme?: string
  isConnected: boolean
  completedAt: number
}

export const useAvatarStore = defineStore('avatar', {
  state: (): AvatarState => ({
    currentAvatarId: readStoredAvatarId(),
    currentMessage: '',
    emotion: 'neutral',
    isSpeaking: false,
    isThinking: false,
    mode: 'text',
    volume: 0,
    phoneme: undefined,
    isConnected: false,
    completedAt: 0
  }),
  getters: {
    currentAvatar: (state) => getAvatarDefinition(state.currentAvatarId)
  },
  actions: {
    setAvatar(id: AvatarId) {
      this.currentAvatarId = id
      window.localStorage.setItem(AVATAR_STORAGE_KEY, id)
    },
    setConnection(isConnected: boolean) {
      this.isConnected = isConnected
    },
    handleEvent(event: HermesOverlayEvent) {
      switch (event.type) {
        case 'assistant_message_started':
          this.currentMessage = ''
          this.mode = event.mode
          this.isThinking = true
          this.isSpeaking = false
          this.volume = 0
          break
        case 'assistant_message_delta':
          this.currentMessage += event.text
          this.isThinking = false
          break
        case 'assistant_message_completed':
          this.currentMessage = event.text
          this.emotion = event.emotion ?? 'neutral'
          this.isThinking = false
          this.isSpeaking = Boolean(event.audioUrl) || this.mode === 'voice'
          this.completedAt = Date.now()
          break
        case 'assistant_speaking':
          this.isThinking = false
          this.isSpeaking = true
          this.volume = Math.max(0, Math.min(1, event.volume))
          this.phoneme = event.phoneme
          break
        case 'assistant_idle':
          this.isSpeaking = false
          this.isThinking = false
          this.volume = 0
          this.phoneme = undefined
          this.emotion = 'neutral'
          break
      }
    }
  }
})

function readStoredAvatarId(): AvatarId {
  const stored = window.localStorage.getItem(AVATAR_STORAGE_KEY)
  if (stored === 'hiyori' || stored === 'chitose') return stored
  if (stored === 'ren_foster') {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, 'chitose')
    return 'chitose'
  }
  return defaultAvatarId
}
