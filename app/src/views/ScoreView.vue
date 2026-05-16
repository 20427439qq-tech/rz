<script setup lang="ts">
import { Bell, ChartColumn, CheckCircle2, Target } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/appStore'

const store = useAppStore()
const understanding = store.viewpointUnderstandingScore
const landing = store.enterpriseLandingScore
const review = store.weeklyReview
</script>

<template>
  <section class="screen">
    <PageHeader
      eyebrow="评分与复盘"
      title="评价训练质量，也评价企业落地可能性"
      summary="观点理解每天都评分；企业落地只在强关联或可验证路径上评分；周复盘负责看趋势和触发提醒。"
    />

    <section class="score-summary-grid">
      <article class="score-summary">
        <ChartColumn :size="22" />
        <span>{{ understanding.title }}</span>
        <strong>{{ understanding.score }} / {{ understanding.max }}</strong>
        <p>{{ understanding.level }}</p>
      </article>
      <article class="score-summary">
        <Target :size="22" />
        <span>{{ landing.title }}</span>
        <strong>{{ landing.score }} / {{ landing.max }}</strong>
        <p>{{ landing.level }}</p>
      </article>
    </section>

    <section class="score-list">
      <article v-for="item in understanding.dimensions" :key="item.label" class="score-row score-row--tall">
        <div>
          <span>{{ item.label }}</span>
          <p>{{ item.note }}</p>
        </div>
        <strong>{{ item.value }}</strong>
      </article>
      <article v-for="item in landing.dimensions" :key="item.label" class="score-row score-row--tall">
        <div>
          <span>{{ item.label }}</span>
          <p>{{ item.note }}</p>
        </div>
        <strong>{{ item.value }}</strong>
      </article>
    </section>

    <section class="weekly-panel">
      <div class="section-title">
        <CheckCircle2 :size="20" />
        <h2>本周复盘</h2>
      </div>
      <p>{{ review.reviewText }}</p>
      <div class="status-strip">
        <article>
          <span>训练</span>
          <strong>{{ review.trainedCount }}</strong>
        </article>
        <article>
          <span>高分匹配</span>
          <strong>{{ review.matchedCount }}</strong>
        </article>
        <article>
          <span>落地问题</span>
          <strong>{{ review.enterpriseLandingCount }}</strong>
        </article>
      </div>
      <ul class="detail-list">
        <li v-for="item in review.nextFocus" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section class="weekly-panel">
      <div class="section-title">
        <Bell :size="20" />
        <h2>未来触发提醒雏形</h2>
      </div>
      <article v-for="item in store.triggerReminders" :key="item.id" class="reminder-row">
        <div>
          <h2>{{ item.title }}</h2>
          <p>{{ item.trigger }}</p>
        </div>
        <span>{{ item.nextCheckAt }}</span>
      </article>
    </section>
  </section>
</template>
