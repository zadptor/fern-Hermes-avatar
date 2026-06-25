<script setup lang="ts">
import WaifuStage from './components/WaifuStage.vue'
import ChatBubble from './components/ChatBubble.vue'
import VoiceIndicator from './components/VoiceIndicator.vue'
import AvatarSelector from './components/AvatarSelector.vue'
import AudioPlayer from './components/AudioPlayer.vue'
</script>

<template>
  <main class="overlay-shell">
    <ChatBubble />
    <WaifuStage />
    <AvatarSelector />
    <VoiceIndicator />
    <AudioPlayer />
  </main>
</template>
