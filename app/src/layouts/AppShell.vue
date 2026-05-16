<script setup lang="ts">
import BottomNav from '../components/BottomNav.vue'
</script>

<template>
  <div class="app-frame">
    <main class="app-main">
      <RouterView />
    </main>
    <BottomNav />
  </div>
</template>
