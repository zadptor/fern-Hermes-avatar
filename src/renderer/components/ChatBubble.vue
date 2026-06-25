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
      <!-- thinking bubble: manga-style cloud + bubble trail -->
      <template v-if="bubbleKind === 'thinking'">
        <!-- Bubble trail: three progressively smaller circles floating up to the cloud -->
        <svg class="thought-trail" viewBox="0 0 90 60" aria-hidden="true">
          <circle cx="45" cy="50" r="10" class="trail-circle" />
          <circle cx="45" cy="30" r="7" class="trail-circle" />
          <circle cx="45" cy="14" r="4" class="trail-circle" />
        </svg>

        <svg class="cloud-shape" viewBox="0 0 240 120" preserveAspectRatio="none" aria-hidden="true">
          <!-- Main cloud path (solid fill + thick stroke) -->
          <path
            d="M 36 102
               Q 22 102 17 89
               Q 7 86 10 72
               Q 0 62 10 50
               Q 5 36 19 34
               Q 22 17 38 17
               Q 46 5 65 7
               Q 74 0 94 7
               Q 106 0 122 7
               Q 134 2 149 12
               Q 161 5 175 14
               Q 192 10 204 22
               Q 214 17 226 29
               Q 236 26 238 41
               Q 242 53 232 65
               Q 240 74 230 86
               Q 236 96 223 98
               Q 216 108 202 103
               Q 188 113 170 106
               Q 156 113 138 106
               Q 122 113 108 106
               Q 94 113 80 106
               Q 66 113 52 106
               Q 40 113 36 102 Z"
            class="cloud-fill"
          />
          <!-- Second offset path for sketchy doubled-line manga effect -->
          <path
            d="M 38 104
               Q 20 104 15 91
               Q 5 88 8 74
               Q -2 64 8 52
               Q 3 38 17 36
               Q 24 19 40 19
               Q 48 7 67 9
               Q 76 2 96 9
               Q 108 2 124 9
               Q 136 4 151 14
               Q 163 7 177 16
               Q 194 12 206 24
               Q 216 19 228 31
               Q 238 28 240 43
               Q 244 55 234 67
               Q 242 76 232 88
               Q 238 98 225 100
               Q 218 110 204 105
               Q 190 115 172 108
               Q 158 115 140 108
               Q 124 115 110 108
               Q 96 115 82 108
               Q 68 115 54 108
               Q 42 115 38 104 Z"
            class="cloud-sketch"
          />
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
  min-height: 80px;
  padding: 24px 32px;
  font-size: 14px;
  line-height: 1.5;
}

/* Thought trail — three circles floating up from the character's head */
.thought-trail {
  position: absolute;
  bottom: -50px;
  left: 20%;
  width: 60px;
  height: 44px;
  z-index: 0;
}

.trail-circle {
  fill: white;
  stroke: #1a1a1a;
  stroke-width: 2.5;
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
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12));
}

/* Solid white fill, thick manga stroke */
.cloud-fill {
  fill: #ffffff;
  stroke: #1a1a1a;
  stroke-width: 3;
  stroke-linejoin: round;
  stroke-linecap: round;
  paint-order: stroke fill;
}

/* Sketchy doubled-line overlay — slightly offset for hand-drawn feel */
.cloud-sketch {
  fill: none;
  stroke: #1a1a1a;
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.55;
}

/* Text inside the thinking bubble */
.think-text {
  position: relative;
  z-index: 1;
  color: #1a1a1a;
  font-weight: 700;
  font-size: 16px;
  font-style: normal;
  text-align: center;
  letter-spacing: 0.5px;
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
