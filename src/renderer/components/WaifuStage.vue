<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'
import { Live2DRenderer } from '../live2d/Live2DRenderer'
import { LipSyncController } from '../live2d/lipSync'

const stage = ref<HTMLElement | null>(null)
const store = useAvatarStore()
const { emotion, volume, phoneme, isSpeaking } = storeToRefs(store)

let renderer: Live2DRenderer | null = null
let lipSync: LipSyncController | null = null

function handleResize(): void {
  renderer?.resize()
}

onMounted(async () => {
  if (!stage.value) return

  renderer = new Live2DRenderer(stage.value)
  lipSync = new LipSyncController(renderer)
  await renderer.load()
  renderer.setExpression(emotion.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  lipSync?.destroy()
  renderer?.destroy()
})

watch(emotion, (next) => renderer?.setExpression(next))
watch([volume, phoneme], ([nextVolume, nextPhoneme]) => lipSync?.setInput(nextVolume, nextPhoneme))
watch(isSpeaking, (speaking) => {
  if (!speaking) lipSync?.stop()
})
</script>

<template>
  <section ref="stage" class="waifu-stage" aria-label="Hermes avatar stage" />
</template>

<style scoped>
.waifu-stage {
  position: absolute;
  inset: 100px 0 34px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

:deep(.live2d-canvas) {
  width: 100%;
  height: 100%;
  display: block;
}

:deep(.fallback-avatar) {
  position: absolute;
  width: 230px;
  height: 300px;
  border-radius: 50% 50% 44% 44%;
  display: grid;
  place-items: center;
  color: #264653;
  font-size: 104px;
  line-height: 1;
  background:
    radial-gradient(circle at 36% 28%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.08) 25%),
    linear-gradient(160deg, rgba(117, 202, 166, 0.94), rgba(245, 180, 97, 0.92));
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: 0 18px 42px rgba(38, 70, 83, 0.28);
  animation: float 3.4s ease-in-out infinite;
}

:deep(.fallback-avatar)::before,
:deep(.fallback-avatar)::after {
  content: "";
  position: absolute;
  top: 112px;
  width: 22px;
  height: 28px;
  border-radius: 50%;
  background: #264653;
  transform-origin: center;
  animation: blink 5s infinite;
}

:deep(.fallback-avatar)::before {
  left: 76px;
}

:deep(.fallback-avatar)::after {
  right: 76px;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

@keyframes blink {
  0%,
  92%,
  100% {
    transform: scaleY(1);
  }
  95% {
    transform: scaleY(0.12);
  }
}
</style>
