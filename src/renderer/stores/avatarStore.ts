import { defineStore } from 'pinia'
import type { HermesEmotion, HermesOverlayEvent } from '../bridge/messageTypes'

type HermesMode = 'text' | 'voice'

interface AvatarState {
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
  actions: {
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
