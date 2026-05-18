<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Archive, ArrowLeft, Eye, Sprout, Target } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import EmptyPanel from '../components/EmptyPanel.vue'
import { useAppStore } from '../stores/appStore'
import { businessSceneLabels, relationLabels } from '../models/domain'
import type { BusinessScene } from '../models/domain'
import { formatDisplayDate, formatDueStatus } from '../utils/date'

const route = useRoute()
const store = useAppStore()

const result = computed(() =>
  store.trainingResults.find((item) => item.id === String(route.params.id)),
)

const viewpoint = computed(() =>
  result.value ? store.viewpoints.find((item) => item.id === result.value?.viewpointId) : undefined,
)

const target = computed<Record<string, any> | undefined>(() => {
  if (!result.value) return undefined

  if (result.value.targetKind === 'problem') {
    return store.problems.find((item) => item.id === result.value?.targetId)
  }

  if (result.value.targetKind === 'observation-task') {
    return store.observationTasks.find((item) => item.id === result.value?.targetId)
  }

  if (result.value.targetKind === 'cognitive-seed') {
    return store.cognitiveSeeds.find((item) => item.id === result.value?.targetId)
  }

  return store.archivedTrainingResults.find((item) => item.id === result.value?.targetId)
})

const resultCopy = computed(() => {
  if (!result.value) {
    return {
      eyebrow: '详情',
      title: '结果不存在',
      summary: '这个训练结果可能已经被清空或还没有保存。',
      icon: Archive,
    }
  }

  if (result.value.targetKind === 'problem') {
    return {
      eyebrow: '问题落地卡',
      title: result.value.title,
      summary: '强关联结果已经进入问题落地状态，下一步聚焦真实证据和最小行动实验。',
      icon: Target,
    }
  }

  if (result.value.targetKind === 'observation-task') {
    return {
      eyebrow: '观察任务卡',
      title: result.value.title,
      summary: '弱关联结果先进入观察状态，用企业现场现象继续校准判断。',
      icon: Eye,
    }
  }

  if (result.value.targetKind === 'cognitive-seed') {
    return {
      eyebrow: '认知种子卡',
      title: result.value.title,
      summary: '暂不相关结果已经沉淀为认知种子，等待未来真实问题触发。',
      icon: Sprout,
    }
  }

  return {
    eyebrow: '归档',
    title: result.value.title,
    summary: '无价值结果已归档，不进入行动或未来匹配池。',
    icon: Archive,
  }
})

const relationLabel = computed(() => {
  if (!result.value) return '未保存'
  return relationLabels[result.value.relationLevel]
})

const sceneLabel = computed(() => {
  if (result.value?.targetKind !== 'problem' || !target.value?.scene) return ''
  return businessSceneLabels[target.value.scene as BusinessScene]
})

const statusRows = computed(() => {
  if (!result.value || !target.value) return []

  if (result.value.targetKind === 'problem') {
    return [
      { label: '卡片类型', value: '问题落地卡' },
      { label: '当前状态', value: result.value.statusLabel },
      { label: '场景', value: sceneLabel.value || '待补充' },
      { label: '下一步', value: target.value.nextAction ?? '补一条最小行动实验' },
    ]
  }

  if (result.value.targetKind === 'observation-task') {
    return [
      { label: '卡片类型', value: '观察任务卡' },
      { label: '当前状态', value: result.value.statusLabel },
      { label: '观察周期', value: target.value.period },
      { label: '观察对象', value: target.value.target },
    ]
  }

  if (result.value.targetKind === 'cognitive-seed') {
    return [
      { label: '卡片类型', value: '认知种子卡' },
      { label: '当前状态', value: result.value.statusLabel },
      { label: '变量数量', value: `${target.value.coreVariables?.length ?? 0} 个` },
      { label: '触发条件', value: target.value.futureTriggers?.[0] ?? '等待未来问题出现' },
    ]
  }

  return [
    { label: '卡片类型', value: '归档记录' },
    { label: '当前状态', value: result.value.statusLabel },
    { label: '处理方式', value: '不进入三个池' },
    { label: '归档原因', value: target.value.reason },
  ]
})

const timelineRows = computed(() => {
  if (!result.value || !target.value) return []

  const rows = [
    { label: '训练日期', value: formatDisplayDate(result.value.createdAt) },
    { label: '生成日期', value: formatDisplayDate(target.value.createdAt ?? result.value.createdAt) },
  ]

  if (result.value.targetKind === 'observation-task') {
    const startDate = target.value.startDate || target.value.createdAt || result.value.createdAt
    const dueDate = target.value.dueDate
    rows.push(
      { label: '观察期', value: dueDate ? `${formatDisplayDate(startDate)} 至 ${formatDisplayDate(dueDate)}` : '日期待补充' },
      { label: '截止状态', value: formatDueStatus(dueDate) },
    )
  }

  if (result.value.targetKind === 'cognitive-seed') {
    const reminder = store.triggerReminders.find((item) => item.sourceId === result.value?.targetId)
    if (reminder) {
      rows.push(
        { label: '下次检查', value: formatDisplayDate(reminder.nextCheckAt) },
        { label: '到期状态', value: formatDueStatus(reminder.nextCheckAt) },
      )
    }
  }

  if (result.value.targetKind === 'archive') {
    rows[1] = { label: '归档日期', value: formatDisplayDate(target.value.createdAt ?? result.value.createdAt) }
  }

  return rows
})

const aiSceneRows = computed(() => {
  if (!result.value?.aiScenes) return []
  return Object.entries(result.value.aiScenes)
    .map(([scene, draft]) => ({
      scene: businessSceneLabels[scene as BusinessScene],
      relation: draft ? relationLabels[draft.relation] : '未生成',
      reason: draft?.reason || '暂无理由',
    }))
    .filter((item) => item.scene)
})
</script>

<template>
  <section class="screen">
    <RouterLink class="ghost-link" to="/pools">
      <ArrowLeft :size="18" />
      <span>返回分流结果</span>
    </RouterLink>

    <PageHeader
      :eyebrow="resultCopy.eyebrow"
      :title="resultCopy.title"
      :summary="resultCopy.summary"
    />

    <EmptyPanel v-if="!result || !target" title="没有找到详情" text="请先完成并保存一次观点训练。" />

    <template v-else>
      <section class="detail-hero">
        <div class="detail-hero__icon">
          <component :is="resultCopy.icon" :size="24" />
        </div>
        <div>
          <div class="detail-hero__meta">
            <span>{{ relationLabel }}</span>
            <span>{{ result.statusLabel }}</span>
            <span>训练于 {{ formatDisplayDate(result.createdAt) }}</span>
          </div>
          <h2>{{ target.title }}</h2>
        </div>
      </section>

      <section class="status-grid" aria-label="结果状态摘要">
        <article v-for="row in statusRows" :key="row.label" class="status-card">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </article>
      </section>

      <section class="status-grid" aria-label="时间线">
        <article v-for="row in timelineRows" :key="row.label" class="status-card">
          <span>{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
        </article>
      </section>

      <section class="detail-grid">
        <article class="detail-block">
          <h2>观点原文</h2>
          <p>{{ viewpoint?.originalText ?? target.originalText }}</p>
        </article>
        <article class="detail-block">
          <h2>我的理解</h2>
          <p>{{ viewpoint?.myUnderstanding ?? target.understanding }}</p>
        </article>
        <article v-if="viewpoint?.causalChain" class="detail-block">
          <h2>因果链</h2>
          <p>{{ viewpoint.causalChain }}</p>
        </article>
        <article v-if="viewpoint?.challengedOldModel" class="detail-block">
          <h2>旧模型</h2>
          <p>{{ viewpoint.challengedOldModel }}</p>
        </article>
        <article v-if="viewpoint?.boundary" class="detail-block">
          <h2>边界</h2>
          <p>{{ viewpoint.boundary }}</p>
        </article>
      </section>

      <section v-if="aiSceneRows.length" class="detail-block">
        <h2>AI 企业场景建议</h2>
        <ul class="detail-list">
          <li v-for="item in aiSceneRows" :key="item.scene">
            {{ item.scene }} · {{ item.relation }}：{{ item.reason }}
          </li>
        </ul>
      </section>

      <section v-if="result.targetKind === 'problem'" class="detail-block">
        <h2>问题落地</h2>
        <p>{{ target.description }}</p>
        <div class="detail-row">
          <span>场景</span>
          <strong>{{ sceneLabel }}</strong>
        </div>
        <div class="detail-row">
          <span>状态</span>
          <strong>问题落地中</strong>
        </div>
        <div class="chip-row">
          <span v-for="item in target.evidenceFocus ?? []" :key="item" class="chip">{{ item }}</span>
        </div>
        <p>{{ target.nextAction }}</p>
      </section>

      <section v-if="result.targetKind === 'observation-task'" class="detail-block">
        <h2>观察任务</h2>
        <div class="detail-row">
          <span>周期</span>
          <strong>{{ target.period }}</strong>
        </div>
        <div class="detail-row">
          <span>观察期</span>
          <strong>
            {{
              target.dueDate
                ? `${formatDisplayDate(target.startDate || target.createdAt || result.createdAt)} 至 ${formatDisplayDate(target.dueDate)}`
                : '日期待补充'
            }}
          </strong>
        </div>
        <div class="detail-row">
          <span>对象</span>
          <strong>{{ target.target }}</strong>
        </div>
        <ul class="detail-list">
          <li v-for="question in target.questions" :key="question">{{ question }}</li>
        </ul>
      </section>

      <section v-if="result.targetKind === 'cognitive-seed'" class="detail-block">
        <h2>认知种子</h2>
        <p>{{ target.understanding }}</p>
        <div class="chip-row">
          <span v-for="item in target.coreVariables" :key="item" class="chip">{{ item }}</span>
        </div>
        <h2>误用风险</h2>
        <ul class="detail-list">
          <li v-for="risk in target.risks" :key="risk">{{ risk }}</li>
        </ul>
        <h2>使用边界</h2>
        <ul class="detail-list">
          <li v-for="boundary in target.boundaries" :key="boundary">{{ boundary }}</li>
        </ul>
        <h2>未来触发</h2>
        <ul class="detail-list">
          <li v-for="trigger in target.futureTriggers" :key="trigger">{{ trigger }}</li>
        </ul>
      </section>

      <section v-if="result.targetKind === 'archive'" class="detail-block">
        <h2>归档原因</h2>
        <p>{{ target.reason }}</p>
      </section>
    </template>
  </section>
</template>
