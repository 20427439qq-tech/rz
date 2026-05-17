<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  ChartColumn,
  Database,
  GitCompareArrows,
  House,
  NotebookPen,
} from '@lucide/vue'

interface NavItem {
  label: string
  to: string
  icon: Component
}

const route = useRoute()

const items: NavItem[] = [
  { label: '首页', to: '/', icon: House },
  { label: '训练', to: '/training', icon: NotebookPen },
  { label: '三个池', to: '/pools', icon: Database },
  { label: '匹配', to: '/match', icon: GitCompareArrows },
  { label: '沉淀', to: '/score', icon: ChartColumn },
]

const activePath = computed(() => (route.path.startsWith('/results') ? '/pools' : route.path))
</script>

<template>
  <nav class="bottom-nav" aria-label="底部导航">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': activePath === item.to }"
      :to="item.to"
    >
      <component :is="item.icon" :size="21" stroke-width="2" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
