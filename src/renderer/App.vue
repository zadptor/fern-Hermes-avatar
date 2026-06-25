<script setup lang="ts">
import WaifuStage from './components/WaifuStage.vue'
import ChatBubble from './components/ChatBubble.vue'
import VoiceIndicator from './components/VoiceIndicator.vue'
</script>

<template>
  <main class="overlay-shell">
    <ChatBubble />
    <WaifuStage />
    <VoiceIndicator />
  </main>
</template>
