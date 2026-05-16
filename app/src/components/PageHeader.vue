<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  summary: string
}>()
</script>

<template>
  <header class="page-header">
    <p class="eyebrow">{{ eyebrow }}</p>
    <h1>{{ title }}</h1>
    <p>{{ summary }}</p>
  </header>
</template>
