<script setup lang="ts">
import { computed, ref, watch, watchEffect, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const { currentMessage, completedAt, isThinking, isSpeaking, mode, volume, emotion } = storeToRefs(store)
const isVisible = ref(false)
const revealed = ref(0)

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

// ── Thinking dots animation ────────────────────────────────────────────

const thinkerPhase = ref(0)
let thinkerTimer = 0

watch(isThinking, (v) => {
  if (v) startThinkerDots()
  else stopThinkerDots()
})

function startThinkerDots(): void {
  stopThinkerDots()
  thinkerPhase.value = 0
  thinkerTimer = window.setInterval(() => {
    thinkerPhase.value = (thinkerPhase.value + 1) % 4
  }, 420)
}

function stopThinkerDots(): void {
  window.clearInterval(thinkerTimer)
  thinkerPhase.value = 0
}

const thinkerLabel = computed(() => {
  return 'Thinking' + '.'.repeat(thinkerPhase.value)
})

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
      <!-- thinking bubble: sketch-style cloud + bubble trail -->
      <template v-if="bubbleKind === 'thinking'">
        <svg class="thought-trail" viewBox="0 0 72 78" aria-hidden="true">
          <circle cx="16" cy="62" r="9" class="trail-circle" />
          <circle cx="36" cy="39" r="13" class="trail-circle" />
        </svg>

        <svg class="cloud-shape" viewBox="0 0 260 150" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M 34 112
               C 8 102 10 66 34 56
               C 35 29 66 18 88 28
               C 104 4 145 8 160 32
               C 184 17 222 26 226 56
               C 253 61 259 96 236 113
               C 225 143 181 140 164 119
               C 149 145 104 145 91 119
               C 70 134 43 130 34 112 Z"
            class="cloud-fill"
          />
          <path
            d="M 37 109
               C 11 97 16 67 39 57
               M 45 53
               C 43 27 71 18 91 29
               M 156 31
               C 180 19 215 28 220 59
               M 231 61
               C 255 69 253 99 233 113
               M 163 121
               C 146 143 111 143 94 120
               M 91 120
               C 72 131 48 128 36 110"
            class="cloud-sketch"
          />
          <path d="M 79 25 C 101 1 143 7 162 32" class="cloud-accent" />
          <path d="M 180 24 C 207 18 231 35 226 59" class="cloud-accent" />
          <path d="M 31 65 C 4 76 11 106 36 112" class="cloud-accent" />
          <path d="M 232 109 C 217 139 183 138 164 119" class="cloud-accent" />
          <path d="M 92 121 C 112 143 145 141 164 120" class="cloud-accent" />
        </svg>

        <span class="think-text">
          <span class="text-content">{{ thinkerLabel }}</span>
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
  display: flex;
  align-items: center;
  justify-content: center;
  left: auto;
  right: 18px;
  top: 16px;
  width: 248px;
  height: 138px;
  min-height: 0;
  padding: 0 34px 8px;
  font-size: 13px;
  line-height: 1.5;
}

.thought-trail {
  position: absolute;
  bottom: -38px;
  left: 18px;
  width: 54px;
  height: 58px;
  z-index: 0;
}

.trail-circle {
  fill: white;
  stroke: #2b1c14;
  stroke-width: 3.6;
  paint-order: stroke fill;
}

/* Cloud shape SVG */
.cloud-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.cloud-fill {
  fill: #ffffff;
  stroke: #2b1c14;
  stroke-width: 4.8;
  stroke-linejoin: round;
  stroke-linecap: round;
  paint-order: stroke fill;
}

.cloud-sketch {
  fill: none;
  stroke: #2b1c14;
  stroke-width: 3.1;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.82;
}

.cloud-accent {
  fill: none;
  stroke: #2b1c14;
  stroke-width: 3.4;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.9;
}

.think-text {
  position: relative;
  z-index: 1;
  color: #2b1c14;
  font-weight: 700;
  font-size: 13px;
  font-style: normal;
  text-align: center;
  letter-spacing: 0;
  font-family: 'Hiragino Sans', 'Noto Sans', 'Segoe UI', sans-serif;
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
