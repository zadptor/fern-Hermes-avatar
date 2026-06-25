<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const audioRef = ref<HTMLAudioElement | null>(null)
let cleanupPlay: (() => void) | null = null
let cleanupCompleted: (() => void) | null = null

// Play an audio file through the hidden <audio> element using the protocol URL
function playAudio(payload: { url: string; path: string }) {
  if (!audioRef.value) return
  console.log('[audio] playing:', payload.url)
  audioRef.value.src = payload.url
  audioRef.value.currentTime = 0
  audioRef.value.play().catch((err) => {
    console.warn('[audio] play failed:', err)
  })
}

// Watch for assistant_message_completed and generate TTS
function handleEvent(event: any) {
  if (event.type === 'assistant_message_completed') {
    const text = event.text || ''
    if (text.length > 0 && text.length <= 5000 && window.hermes?.speak) {
      // Fire-and-forget TTS generation — plays automatically via hermes-audio-play
      window.hermes.speak(text).then((result) => {
        console.log('[tts] generation result:', result)
      }).catch((err: any) => {
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
