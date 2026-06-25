<script setup lang="ts">
import { computed, ref, watch, watchEffect, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const { currentMessage, completedAt, isThinking, isSpeaking, mode, volume, emotion } = storeToRefs(store)
const isVisible = ref(false)
const revealed = ref(0)
const revealTimer = ref(0)

let hideTimer = 0
let speakPulseCount = 0

const displayText = computed(() => {
  if (currentMessage.value) {
    if (mode.value === 'voice') {
      return currentMessage.value.slice(0, revealed.value)
    }
    return currentMessage.value
  }
  return ''
})

// ── Bubble variant ──────────────────────────────────────────────────────

const bubbleKind = computed<'thinking' | 'speech' | 'shout' | 'whisper'>(() => {
  if (isThinking.value) return 'thinking'
  if (isSpeaking.value) return 'speech'
  if (emotion.value === 'annoyed') return 'shout'
  if (mode.value === 'voice' && isSpeaking.value) return 'speech'
  return 'speech'
})

const thinkerDots = ref(['', '', ''])
let thinkerTimer = 0

watch(isThinking, (v) => {
  if (v) startThinkerDots()
  else stopThinkerDots()
})

function startThinkerDots(): void {
  stopThinkerDots()
  let i = 0
  thinkerTimer = window.setInterval(() => {
    i = (i + 1) % 4
    thinkerDots.value = ['.', '..', '...', '']
    thinkerDots.value = thinkerDots.value.map((_, idx) => (i > idx ? '.' : ' '))
  }, 380)
}

function stopThinkerDots(): void {
  window.clearInterval(thinkerTimer)
  thinkerDots.value = ['', '', '']
}

// ── Typing reveal during speaking ───────────────────────────────────────

watchEffect(() => {
  if (mode.value !== 'voice' || !currentMessage.value) {
    revealed.value = currentMessage.value?.length ?? 0
    return
  }
  if (volume.value > 0.05) {
    speakPulseCount++
    if (speakPulseCount % 2 === 0) {
      revealed.value = Math.min(revealed.value + 4, currentMessage.value.length)
    }
  }
})

// ── Show / hide ─────────────────────────────────────────────────────────

watch(displayText, (text) => {
  window.clearTimeout(hideTimer)
  isVisible.value = Boolean(text) || isThinking.value
  if (!text) revealed.value = 0
})

watch(isSpeaking, (speaking) => {
  if (speaking) {
    window.clearTimeout(hideTimer)
    isVisible.value = true
  } else if (!isThinking.value && completedAt.value > 0) {
    scheduleHide()
  }
})

watch(completedAt, () => {
  window.clearTimeout(hideTimer)
  if (!isSpeaking.value && !isThinking.value) {
    scheduleHide()
  }
})

function scheduleHide(): void {
  window.clearTimeout(hideTimer)
  const base = 4000
  const extra = Math.min(currentMessage.value.length * 40, 12000)
  hideTimer = window.setTimeout(() => {
    isVisible.value = false
  }, base + extra)
}

onBeforeUnmount(() => {
  window.clearTimeout(hideTimer)
  window.clearInterval(thinkerTimer)
})
</script>

<template>
  <Transition name="bubble">
    <aside
      v-if="isVisible"
      class="chat-bubble"
      :class="[bubbleKind, emotion]"
      aria-live="polite"
    >
      <!-- thinking bubble: cloud shape, no tail -->
      <template v-if="bubbleKind === 'thinking'">
        <svg class="cloud-path" viewBox="0 0 200 100" preserveAspectRatio="none">
          <path
            d="M 30 85
               Q 18 85 14 74
               Q 6 72 8 60
               Q 0 52 8 42
               Q 4 30 16 28
               Q 18 14 32 14
               Q 38 4 54 6
               Q 62 0 78 6
               Q 88 0 102 6
               Q 112 2 124 10
               Q 134 4 146 12
               Q 160 8 170 18
               Q 180 14 188 24
               Q 196 22 198 34
               Q 202 44 194 54
               Q 200 62 192 72
               Q 198 80 186 82
               Q 180 90 168 86
               Q 156 94 142 88
               Q 130 94 116 88
               Q 102 94 90 88
               Q 78 94 66 88
               Q 54 94 42 88
               Z"
            class="cloud-fill"
          />
        </svg>
        <span class="think-text">
          <span class="text-content">{{ displayText || 'Thinking' }}</span>
          <span class="thinker-dots"><span v-for="(d, i) in thinkerDots" :key="i">{{ d }}</span></span>
        </span>
      </template>

      <!-- speech/shout/whisper bubble: pointed tail -->
      <template v-else>
        <span class="text-content">{{ displayText }}</span>
        <svg
          v-if="bubbleKind === 'speech'"
          class="tail speech-tail"
          viewBox="0 0 30 16"
          width="30"
          height="16"
        >
          <path d="M 2 0 L 15 16 L 28 0 Z" class="tail-fill" />
        </svg>
        <svg
          v-else-if="bubbleKind === 'shout'"
          class="tail shout-tail"
          viewBox="0 0 30 16"
          width="30"
          height="16"
        >
          <path d="M 0 0 L 15 16 L 30 0 Z" class="tail-fill" />
        </svg>
        <svg
          v-else
          class="tail whisper-tail"
          viewBox="0 0 24 12"
          width="24"
          height="12"
        >
          <path d="M 4 0 L 12 12 L 20 0 Z" class="tail-fill" />
        </svg>

        <span v-if="isSpeaking && mode === 'voice' && revealed < (currentMessage?.length ?? 0)"
              class="cursor" />
      </template>
    </aside>
  </Transition>
</template>

<style scoped>
/* ── Shared container ─────────────────────────────────────────────────── */
.chat-bubble {
  position: absolute;
  left: 24px;
  right: 24px;
  top: 22px;
  overflow: visible;
}

/* ── THINKING bubble ──────────────────────────────────────────────────── */
.chat-bubble.thinking {
  padding: 18px 22px;
  min-height: 64px;
  font-size: 14px;
  line-height: 1.5;
}

.cloud-path {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.cloud-fill {
  fill: rgba(212, 224, 245, 0.78);
  stroke: rgba(185, 200, 230, 0.5);
  stroke-width: 1.5;
  filter: drop-shadow(0 6px 16px rgba(80, 100, 140, 0.12));
}

.think-text {
  position: relative;
  z-index: 1;
  color: #3a4a6a;
  font-style: italic;
}

.thinker-dots {
  display: inline;
  font-weight: 700;
  letter-spacing: 1px;
  color: #5a7aaa;
}

/* ── SPEECH bubble ────────────────────────────────────────────────────── */
.chat-bubble.speech {
  min-height: 56px;
  padding: 16px 18px;
  padding-bottom: 22px;
  color: #1f2933;
  font-size: 15px;
  line-height: 1.45;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 12px 30px rgba(31, 41, 51, 0.14);
  backdrop-filter: blur(16px) saturate(140%);
}

.tail {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.speech-tail {
  bottom: -8px;
}

.shout-tail {
  bottom: -8px;
}

.whisper-tail {
  bottom: -6px;
  opacity: 0.5;
}

.tail-fill {
  fill: rgba(255, 255, 255, 0.72);
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 0.5;
}

/* ── SHOUT variant (annoyed emotion) ──────────────────────────────────── */
.chat-bubble.shout {
  border-radius: 14px;
  border-color: rgba(200, 80, 60, 0.3);
  background: rgba(255, 240, 240, 0.75);
  box-shadow: 0 12px 30px rgba(180, 70, 50, 0.12);
}

.chat-bubble.shout .tail-fill {
  fill: rgba(255, 240, 240, 0.75);
  stroke: rgba(200, 80, 60, 0.3);
}

.chat-bubble.shout .text-content {
  font-weight: 600;
  color: #7a3030;
}

/* ── Context ──────────────────────────────────────────────────────────── */
.text-content {
  position: relative;
  z-index: 1;
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor {
  display: inline-block;
  width: 3px;
  height: 1.1em;
  margin-left: 2px;
  background: #2a9d8f;
  animation: blink 520ms steps(1) infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  50% { opacity: 0; }
}

.bubble-enter-active,
.bubble-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
