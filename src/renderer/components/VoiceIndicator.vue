<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const { isSpeaking, isThinking, mode, volume, isConnected } = storeToRefs(store)

const label = computed(() => {
  if (!isConnected.value) return 'Waiting...'
  if (isSpeaking.value) return 'Speaking...'
  if (isThinking.value) return 'Thinking...'
  return mode.value === 'voice' ? 'Listening...' : 'Ready'
})

const visible = computed(() => mode.value === 'voice' || isSpeaking.value || isThinking.value || !isConnected.value)
const barScale = computed(() => Math.max(0.18, volume.value))
</script>

<template>
  <Transition name="indicator">
    <section v-if="visible" class="voice-indicator" :class="{ speaking: isSpeaking }" aria-live="polite">
      <div class="bars" :style="{ '--volume': String(barScale) }">
        <span />
        <span />
        <span />
        <span />
      </div>
      <span class="label">{{ label }}</span>
    </section>
  </Transition>
</template>

<style scoped>
.voice-indicator {
  position: absolute;
  left: 50%;
  bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 134px;
  padding: 9px 13px;
  border-radius: 999px;
  color: #20313a;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 24px rgba(32, 49, 58, 0.14);
  backdrop-filter: blur(14px) saturate(140%);
  transform: translateX(-50%);
}

.bars {
  display: grid;
  grid-template-columns: repeat(4, 4px);
  align-items: center;
  gap: 3px;
  height: 18px;
}

.bars span {
  width: 4px;
  height: calc(8px + var(--volume) * 18px);
  max-height: 18px;
  border-radius: 999px;
  background: #2a9d8f;
  transform-origin: bottom;
  animation: pulse 680ms ease-in-out infinite;
}

.bars span:nth-child(2) {
  animation-delay: 90ms;
  background: #e9c46a;
}

.bars span:nth-child(3) {
  animation-delay: 180ms;
  background: #f4a261;
}

.bars span:nth-child(4) {
  animation-delay: 270ms;
  background: #4c6f7b;
}

.label {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0;
  white-space: nowrap;
}

.indicator-enter-active,
.indicator-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.indicator-enter-from,
.indicator-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@keyframes pulse {
  0%,
  100% {
    transform: scaleY(0.56);
  }
  50% {
    transform: scaleY(1);
  }
}
</style>
