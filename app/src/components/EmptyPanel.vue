<script setup lang="ts">
defineProps<{
  title: string
  text: string
}>()
</script>

<template>
  <section class="empty-panel">
    <h2>{{ title }}</h2>
    <p>{{ text }}</p>
  </section>
</template>
