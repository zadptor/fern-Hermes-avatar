<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { HermesAudioPayload, HermesOverlayEvent } from '../../shared/hermesProtocol'
import { toAvatarConversationText } from '../../shared/conversationText'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const { currentAvatarId } = storeToRefs(store)
const audioRef = ref<HTMLAudioElement | null>(null)
let cleanupPlay: (() => void) | null = null
let cleanupCompleted: (() => void) | null = null

// Play an audio file through the hidden <audio> element using the protocol URL
function playAudio(payload: HermesAudioPayload): void {
  if (!audioRef.value) return
  console.log('[audio] playing:', payload.url)
  audioRef.value.src = payload.url
  audioRef.value.currentTime = 0
  audioRef.value.play().catch((err) => {
    console.warn('[audio] play failed:', err)
  })
}

// Watch for assistant_message_completed and generate TTS
function handleEvent(event: HermesOverlayEvent): void {
  if (event.type === 'assistant_message_completed') {
    const text = toAvatarConversationText(event.text)
    if (text.length > 0 && text.length <= 5000 && window.hermes?.speak) {
      window.hermes.speak(text, currentAvatarId.value).then((result) => {
        if (result.ok) {
          console.log(`[tts] generated with ${result.voice ?? 'configured voice'}: ${result.url ?? result.path ?? ''}`)
          return
        }

        console.warn(`[tts] generation failed: ${result.error ?? 'Unknown error'}`)
      }).catch((err: unknown) => {
        console.warn('[tts] generation failed:', err)
      })
    }
  }
}

onMounted(() => {
  // Listen for audio play commands from main process
  if (window.hermes && typeof window.hermes.onAudioPlay === 'function') {
    cleanupPlay = window.hermes.onAudioPlay(playAudio)
  }

  // Listen for completed events to trigger TTS
  if (window.hermes && typeof window.hermes.onEvent === 'function') {
    cleanupCompleted = window.hermes.onEvent(handleEvent)
  }
})

onBeforeUnmount(() => {
  cleanupPlay?.()
  cleanupCompleted?.()
})
</script>

<template>
  <!-- Hidden audio element for TTS playback -->
  <audio ref="audioRef" preload="none" hidden />
</template>
