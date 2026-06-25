<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useAvatarStore } from '../stores/avatarStore'
import { Live2DRenderer } from '../live2d/Live2DRenderer'
import { LipSyncController } from '../live2d/lipSync'

const stage = ref<HTMLElement | null>(null)
const store = useAvatarStore()
const { currentAvatar, emotion, volume, isSpeaking } = storeToRefs(store)
const loadError = ref('')

let renderer: Live2DRenderer | null = null
let lipSync: LipSyncController | null = null
let loadId = 0

function handleResize(): void {
  renderer?.resize()
}

async function loadAvatar(): Promise<void> {
  if (!stage.value) return
  const thisLoadId = ++loadId

  lipSync?.destroy()
  renderer?.destroy()
  loadError.value = ''
  renderer = new Live2DRenderer(stage.value)
  lipSync = new LipSyncController(renderer)
  try {
    await renderer.load(currentAvatar.value)
  } catch (err) {
    if (thisLoadId === loadId) {
      loadError.value = err instanceof Error ? err.message : 'Could not load avatar.'
    }
    return
  }
  if (thisLoadId !== loadId) return
  renderer.setExpression(emotion.value)
  renderer.setCharacterState(emotion.value, isSpeaking.value)
}

onMounted(async () => {
  await loadAvatar()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  loadId++
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
watch(currentAvatar, () => {
  void loadAvatar()
})
</script>

<template>
  <section ref="stage" class="waifu-stage" aria-label="Hermes avatar stage">
    <div v-if="loadError" class="avatar-load-error" role="status">
      {{ loadError }}
    </div>
  </section>
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

.avatar-load-error {
  max-width: min(360px, calc(100vw - 36px));
  padding: 10px 12px;
  border: 1px solid rgba(108, 70, 44, 0.22);
  border-radius: 8px;
  background: rgba(255, 250, 244, 0.86);
  color: rgba(50, 38, 28, 0.88);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
  box-shadow: 0 12px 24px rgba(35, 28, 20, 0.1);
  backdrop-filter: blur(14px);
  -webkit-app-region: no-drag;
}
</style>
