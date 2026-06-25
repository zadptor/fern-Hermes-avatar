<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'

const store = useAvatarStore()
const { currentMessage, completedAt, isThinking } = storeToRefs(store)
const isVisible = ref(false)
let hideTimer = 0

const displayText = computed(() => {
  if (currentMessage.value) return currentMessage.value
  return isThinking.value ? 'Thinking...' : ''
})

watch(displayText, (text) => {
  window.clearTimeout(hideTimer)
  isVisible.value = Boolean(text)
})

watch(completedAt, () => {
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    isVisible.value = false
  }, 5000)
})
</script>

<template>
  <Transition name="bubble">
    <aside v-if="isVisible" class="chat-bubble" aria-live="polite">
      {{ displayText }}
    </aside>
  </Transition>
</template>

<style scoped>
.chat-bubble {
  position: absolute;
  left: 24px;
  right: 24px;
  top: 22px;
  min-height: 72px;
  max-height: 160px;
  padding: 16px 18px;
  color: #1f2933;
  overflow: hidden auto;
  font-size: 15px;
  line-height: 1.45;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 12px 30px rgba(31, 41, 51, 0.16);
  backdrop-filter: blur(16px) saturate(140%);
}

.chat-bubble::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -10px;
  width: 22px;
  height: 22px;
  background: rgba(255, 255, 255, 0.7);
  border-right: 1px solid rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.72);
  transform: translateX(-50%) rotate(45deg);
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
