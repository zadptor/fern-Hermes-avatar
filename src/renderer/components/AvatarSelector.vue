<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { avatarCatalog } from '../live2d/avatarCatalog'
import { useAvatarStore } from '../stores/avatarStore'
import type { AvatarId } from '../live2d/avatarCatalog'

const store = useAvatarStore()
const { currentAvatarId } = storeToRefs(store)

function handleChange(event: Event): void {
  store.setAvatar((event.target as HTMLSelectElement).value as AvatarId)
}
</script>

<template>
  <label class="avatar-selector">
    <span>Avatar</span>
    <select :value="currentAvatarId" @change="handleChange">
      <option v-for="avatar in avatarCatalog" :key="avatar.id" :value="avatar.id">
        {{ avatar.name }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.avatar-selector {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid rgba(58, 45, 76, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  color: rgba(35, 31, 48, 0.82);
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(14px);
  -webkit-app-region: no-drag;
}

.avatar-selector select {
  max-width: 128px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  font: inherit;
  outline: 0;
}
</style>
