<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { ArrowRight, Eye, Sprout, Target } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import EmptyPanel from '../components/EmptyPanel.vue'
import { useAppStore } from '../stores/appStore'
import type { ResultTargetKind, TrainingResult } from '../models/domain'
import { formatDisplayDate } from '../utils/date'

interface ResultGroup {
  key: ResultTargetKind
  title: string
  desc: string
  rule: string
  state: string
  icon: Component
  items: TrainingResult[]
}

const store = useAppStore()

const groups = computed<ResultGroup[]>(() => [
  {
    key: 'problem',
    title: '问题落地卡',
    desc: '强关联结果，继续做问题重构、证据校准和最小行动实验。',
    rule: '强关联',
    state: '问题落地中',
    icon: Target,
    items: store.trainingResults.filter((item) => item.targetKind === 'problem'),
  },
  {
    key: 'observation-task',
    title: '观察任务卡',
    desc: '弱关联结果，先观察企业现象，再判断是否转成真实问题。',
    rule: '弱关联',
    state: '观察中',
    icon: Eye,
    items: store.trainingResults.filter((item) => item.targetKind === 'observation-task'),
  },
  {
    key: 'cognitive-seed',
    title: '认知种子卡',
    desc: '暂不相关结果，保存触发条件，等待未来问题出现时再匹配。',
    rule: '暂不相关',
    state: '等待触发',
    icon: Sprout,
    items: store.trainingResults.filter((item) => item.targetKind === 'cognitive-seed'),
  },
])

const totalSaved = computed(() => store.trainingResults.length)
</script>

<template>
  <section class="screen">
    <PageHeader
      eyebrow="分流结果"
      title="训练结果进入不同状态"
      summary="强关联进问题落地，弱关联进观察任务，暂不相关进认知种子。三个池保持可追溯，未来匹配从这里发生。"
    />

    <section class="flow-strip" aria-label="分流规则">
      <article v-for="group in groups" :key="group.key" class="flow-step">
        <div class="flow-step__main">
          <component :is="group.icon" :size="22" />
          <div>
            <span>{{ group.rule }}</span>
            <strong>{{ group.title }}</strong>
          </div>
        </div>
        <b>{{ group.items.length }}</b>
      </article>
    </section>

    <section class="status-strip" aria-label="保存状态">
      <article>
        <span>训练结果</span>
        <strong>{{ totalSaved }}</strong>
      </article>
      <article>
        <span>有效流转</span>
        <strong>{{ groups.reduce((sum, group) => sum + group.items.length, 0) }}</strong>
      </article>
      <article>
        <span>触发提醒</span>
        <strong>{{ store.poolCounts.reminders }}</strong>
      </article>
    </section>

    <section v-for="group in groups" :key="group.key" class="result-section">
      <div class="section-title">
        <component :is="group.icon" :size="20" />
        <h2>{{ group.title }}</h2>
      </div>

      <div v-if="group.items.length" class="result-list">
        <RouterLink
          v-for="item in group.items"
          :key="item.id"
          class="result-card"
          :class="`result-card--${item.targetKind}`"
          :to="`/results/${item.id}`"
        >
          <div>
            <div class="result-card__meta">
              <span>{{ item.statusLabel }}</span>
              <span>{{ group.rule }}</span>
              <span>生成于 {{ formatDisplayDate(item.createdAt) }}</span>
            </div>
            <h3>{{ item.title }}</h3>
          </div>
          <ArrowRight :size="18" />
        </RouterLink>
      </div>

      <EmptyPanel
        v-else
        title="暂无结果"
        text="完成一次对应关联判断后，这里会出现可进入详情的训练卡。"
      />
    </section>
  </section>
</template>
