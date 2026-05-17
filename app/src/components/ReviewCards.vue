<script setup lang="ts">
import { computed } from 'vue'
import { relationLabels } from '../models/domain'
import { useAppStore } from '../stores/appStore'
import { formatDisplayDate } from '../utils/date'
import type { Viewpoint } from '../models/domain'

const store = useAppStore()

function seededRandom(seed: number) {
  const next = Math.sin(seed) * 10_000
  return next - Math.floor(next)
}

function statusLabel(status: Viewpoint['status']) {
  const labels: Record<Viewpoint['status'], string> = {
    draft: '草稿',
    trained: '已训练',
    seeded: '种子',
    matched: '已匹配',
    archived: '已归档',
  }
  return labels[status]
}

function supportSummary(viewpoint: Viewpoint) {
  const text = viewpoint.supportText || viewpoint.myUnderstanding || '暂无支撑文字'
  return text.length > 86 ? `${text.slice(0, 86)}...` : text
}

function visibleTags(viewpoint: Viewpoint) {
  return (viewpoint.tags || []).slice(0, 2)
}

const reviewCards = computed(() =>
  store.viewpoints
    .map((viewpoint, index) => ({
      viewpoint,
      result: store.trainingResults.find((item) => item.viewpointId === viewpoint.id),
      order: seededRandom(Date.now() + index * 97),
    }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 6),
)
</script>

<template>
  <div class="review-card-grid">
    <article v-for="item in reviewCards" :key="item.viewpoint.id" class="review-card">
      <header>
        <h2>{{ item.viewpoint.originalText || item.viewpoint.title }}</h2>
        <p>{{ supportSummary(item.viewpoint) }}</p>
      </header>
      <div class="review-card__tags">
        <span v-for="tag in visibleTags(item.viewpoint)" :key="tag">{{ tag }}</span>
        <span>{{ statusLabel(item.viewpoint.status) }}</span>
        <span>{{ item.result ? relationLabels[item.result.relationLevel] : '未分流' }}</span>
      </div>
      <footer>
        <span>{{ formatDisplayDate(item.viewpoint.createdAt) }}</span>
        <span>{{ item.viewpoint.sourceTitle || item.result?.statusLabel || '暂无来源' }}</span>
      </footer>
    </article>
  </div>
</template>
