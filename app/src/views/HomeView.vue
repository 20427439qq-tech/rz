<script setup lang="ts">
import { ArrowRight, Bell, CircleDot, GitCompareArrows, Sprout } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/appStore'

const store = useAppStore()
const review = store.weeklyReview
const topReminder = store.triggerReminders[0]
</script>

<template>
  <section class="screen">
    <PageHeader
      eyebrow="长期认知系统"
      title="每天训练一个观点，长期激活企业问题"
      summary="不把观点当天硬落地。先理解、扫描、分流、沉淀，等真实经营问题出现时，再让系统自动匹配和提醒。"
    />

    <div class="metric-grid">
      <article class="metric-card">
        <span>{{ store.poolCounts.viewpoint }}</span>
        <p>观点池</p>
      </article>
      <article class="metric-card">
        <span>{{ store.poolCounts.problem }}</span>
        <p>问题池</p>
      </article>
      <article class="metric-card">
        <span>{{ store.poolCounts.seeds }}</span>
        <p>认知种子</p>
      </article>
    </div>

    <RouterLink class="primary-link" to="/training">
      <CircleDot :size="20" />
      <span>进入今日训练</span>
      <ArrowRight :size="18" />
    </RouterLink>

    <section class="system-map" aria-label="长期认知系统主线">
      <article>
        <strong>观点训练</strong>
        <span>输入 → 理解 → 旧模型 → 场景扫描</span>
      </article>
      <article>
        <strong>分流结果</strong>
        <span>强关联落地，弱关联观察，暂不相关入种子</span>
      </article>
      <article>
        <strong>未来触发</strong>
        <span>问题出现时重新匹配观点和证据</span>
      </article>
    </section>

    <section class="content-stack">
      <RouterLink class="list-card list-card--action" to="/match">
        <GitCompareArrows :size="22" />
        <div>
          <h2>观点和问题自动匹配</h2>
          <p>{{ store.matchCandidates[0]?.reason }}</p>
        </div>
      </RouterLink>
      <article class="list-card">
        <Bell :size="22" />
        <div>
          <h2>未来触发提醒</h2>
          <p>{{ topReminder?.trigger ?? '暂无触发提醒' }}</p>
        </div>
      </article>
      <article class="list-card">
        <Sprout :size="22" />
        <div>
          <h2>本周复盘</h2>
          <p>{{ review.reviewText }}</p>
        </div>
      </article>
    </section>
  </section>
</template>
