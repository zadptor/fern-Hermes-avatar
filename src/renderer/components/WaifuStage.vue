<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'
import { Live2DRenderer } from '../live2d/Live2DRenderer'
import { LipSyncController } from '../live2d/lipSync'

const stage = ref<HTMLElement | null>(null)
const store = useAvatarStore()
const { emotion, volume, isSpeaking } = storeToRefs(store)

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
  renderer.setCharacterState(emotion.value, isSpeaking.value)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  lipSync?.destroy()
  renderer?.destroy()
})

watch(emotion, (next) => {
  renderer?.setExpression(next)
  renderer?.setCharacterState(next, isSpeaking.value)
})
watchEffect(() => {
  const v = volume.value
  const p = store.phoneme
  lipSync?.setInput(v, p ?? undefined)
})
watch(isSpeaking, (speaking) => {
  renderer?.setCharacterState(emotion.value, speaking)
  if (!speaking) lipSync?.stop()
})
</script>

<template>
  <section ref="stage" class="waifu-stage" aria-label="Hermes avatar stage" />
</template>

<style scoped>
.waifu-stage {
  position: absolute;
  inset: 36px 0 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

:deep(.live2d-canvas) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
