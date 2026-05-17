<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell, ChartColumn, CheckCircle2, Target } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import ReviewCards from '../components/ReviewCards.vue'
import { useAppStore } from '../stores/appStore'
import { formatDisplayDate, formatDueStatus } from '../utils/date'
import { businessSceneLabels, relationLabels } from '../models/domain'
import type { ScoreSnapshot, ScoreSummary } from '../models/domain'

const allValue = '__all__'
const store = useAppStore()

const selectedViewpointId = ref(store.latestScore.viewpointId || allValue)
const selectedStartDate = ref(store.latestScore.date)
const selectedEndDate = ref(store.latestScore.date)

const viewpointOptions = computed(() => store.viewpoints)

const dateBounds = computed(() => {
  const dates = store.scoreSnapshots.map((score) => score.date).sort((a, b) => a.localeCompare(b))
  return {
    min: dates[0] || store.latestScore.date,
    max: dates[dates.length - 1] || store.latestScore.date,
  }
})

const normalizedDateRange = computed(() => {
  const start = selectedStartDate.value || dateBounds.value.min
  const end = selectedEndDate.value || dateBounds.value.max
  if (start > end) {
    return { start: end, end: start }
  }
  return { start, end }
})

const filteredScores = computed(() =>
  store.scoreSnapshots.filter((score) => {
    const matchViewpoint = selectedViewpointId.value === allValue || score.viewpointId === selectedViewpointId.value
    const matchDate = score.date >= normalizedDateRange.value.start && score.date <= normalizedDateRange.value.end
    return matchViewpoint && matchDate
  }),
)

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function aggregateScores(scores: ScoreSnapshot[]): ScoreSnapshot | undefined {
  if (!scores.length) return undefined
  if (scores.length === 1) return scores[0]
  return {
    id: 'score-aggregate',
    viewpointId: selectedViewpointId.value,
    resultId: '',
    date: normalizedDateRange.value.end,
    understanding: average(scores.map((score) => score.understanding)),
    oldModelAwareness: average(scores.map((score) => score.oldModelAwareness)),
    sceneScan: average(scores.map((score) => score.sceneScan)),
    problemReframe: average(scores.map((score) => score.problemReframe)),
    abstraction: average(scores.map((score) => score.abstraction)),
    systemSettlement: average(scores.map((score) => score.systemSettlement)),
  }
}

const selectedScore = computed(() => aggregateScores(filteredScores.value))

const focusedScore = computed(() => {
  if (!filteredScores.value.length) return undefined
  if (filteredScores.value.length === 1) return filteredScores.value[0]
  return [...filteredScores.value].sort((a, b) => b.date.localeCompare(a.date))[0]
})

const focusedResult = computed(() => {
  const score = focusedScore.value
  if (!score) return undefined
  return (
    store.trainingResults.find((result) => result.id === score.resultId) ||
    store.trainingResults.find((result) => result.viewpointId === score.viewpointId)
  )
})

const focusedViewpoint = computed(() => {
  const score = focusedScore.value
  const result = focusedResult.value
  return store.viewpoints.find((viewpoint) => viewpoint.id === (score?.viewpointId || result?.viewpointId))
})

const focusedProblem = computed(() => {
  const result = focusedResult.value
  if (result?.targetKind !== 'problem') return undefined
  return store.problems.find((problem) => problem.id === result.targetId)
})

const focusedTask = computed(() => {
  const result = focusedResult.value
  if (result?.targetKind !== 'observation-task') return undefined
  return store.observationTasks.find((task) => task.id === result.targetId)
})

const focusedSeed = computed(() => {
  const result = focusedResult.value
  if (result?.targetKind !== 'cognitive-seed') return undefined
  return store.cognitiveSeeds.find((seed) => seed.id === result.targetId)
})

const focusedSceneLabels = computed(() => {
  const result = focusedResult.value
  const scenes = result?.scenes?.length
    ? result.scenes
    : focusedProblem.value?.scene
      ? [focusedProblem.value.scene]
      : focusedSeed.value?.possibleScenes ||
        Object.entries(businessSceneLabels)
          .filter(([, label]) => focusedTask.value?.target.includes(label))
          .map(([scene]) => scene as keyof typeof businessSceneLabels)
  return scenes.map((scene) => businessSceneLabels[scene]).filter(Boolean)
})

const focusedSupportText = computed(() => {
  const viewpoint = focusedViewpoint.value
  return viewpoint?.supportText || viewpoint?.myUnderstanding || '这条训练记录暂时没有文字支撑，建议回到训练页补充证据。'
})

const focusedMetaItems = computed(() => {
  const result = focusedResult.value
  if (!result) return []
  const items = [
    result.statusLabel,
    relationLabels[result.relationLevel],
    focusedScore.value ? formatDisplayDate(focusedScore.value.date) : '',
  ]
  if (focusedSceneLabels.value.length) items.push(focusedSceneLabels.value.join('、'))
  return items.filter(Boolean)
})

const selectedViewpointTitle = computed(() => {
  if (selectedViewpointId.value === allValue) return '全部观点'
  return store.viewpoints.find((viewpoint) => viewpoint.id === selectedViewpointId.value)?.title || '未知观点'
})

const selectedDateLabel = computed(() => {
  const start = formatDisplayDate(normalizedDateRange.value.start)
  const end = formatDisplayDate(normalizedDateRange.value.end)
  return start === end ? start : `${start} 至 ${end}`
})

const scoreScopeLabel = computed(() => {
  const count = filteredScores.value.length
  return `${selectedViewpointTitle.value} · ${selectedDateLabel.value} · ${count} 条评分`
})

function deduction(value: number, weakness: string, fullScore = '证据比较完整，暂时不扣分。') {
  const lost = Math.max(0, 5 - value)
  return lost > 0 ? `扣 ${lost} 分：${weakness}` : `不扣分：${fullScore}`
}

function scoreContext(score: ScoreSnapshot | undefined) {
  return score?.id === 'score-aggregate' ? '当前为筛选范围内的平均分，解释按平均短板展示。' : '当前为这次训练记录的单项评分。'
}

function buildUnderstandingSummary(score: ScoreSnapshot | undefined): ScoreSummary {
  const viewpoint = focusedViewpoint.value
  const dimensions = [
    {
      label: '能否复述观点',
      value: score?.understanding || 0,
      note: '用自己的话讲清楚，不照搬原句',
      reason: `${scoreContext(score)}理解文本${viewpoint?.myUnderstanding ? '已经保存' : '还不完整'}，评分看它是否把观点转成自己的业务语言。`,
      deduction: deduction(score?.understanding || 0, '复述还偏短，或者只是换说法，没有说明它对经营判断的含义。'),
    },
    {
      label: '能否看见旧模型',
      value: score?.oldModelAwareness || 0,
      note: '知道它反对了什么默认假设',
      reason: `${scoreContext(score)}旧模型字段${viewpoint?.challengedOldModel ? '已有内容' : '缺少内容'}，高分需要说清这个观点在反对哪种惯性判断。`,
      deduction: deduction(score?.oldModelAwareness || 0, '旧模型没有被点透，还需要写出“过去默认怎么想”和“现在为什么要换”。'),
    },
    {
      label: '能否抽出变量',
      value: score?.abstraction || 0,
      note: '拆成可观察、可验证的经营变量',
      reason: `${scoreContext(score)}当前变量数为 ${viewpoint?.coreVariables.length || 0} 个，满分通常需要 4 个以上可观察变量。`,
      deduction: deduction(score?.abstraction || 0, '变量数量或颗粒度不足，还需要拆到字段、行为、证据或阈值。'),
    },
  ]
  const total = dimensions.reduce((sum, item) => sum + item.value, 0)
  return {
    title: '观点理解评分',
    score: total,
    max: 15,
    level: total >= 12 ? '稳定理解' : total >= 8 ? '可继续训练' : '需要重拆观点',
    dimensions,
  }
}

function buildLandingSummary(score: ScoreSnapshot | undefined): ScoreSummary {
  const result = focusedResult.value
  const dimensions = [
    {
      label: '场景匹配',
      value: score?.sceneScan || 0,
      note: '能否定位到真实企业场景',
      reason: `${scoreContext(score)}当前命中的企业场景为 ${focusedSceneLabels.value.length ? focusedSceneLabels.value.join('、') : '未明确'}。`,
      deduction: deduction(score?.sceneScan || 0, '场景覆盖还少，或者没有把观点落到销售、客户、库存等真实现场。'),
    },
    {
      label: '问题重构',
      value: score?.problemReframe || 0,
      note: '能否把观点转成可处理的问题',
      reason: `${scoreContext(score)}当前沉淀路径是 ${result?.statusLabel || '未保存'}，强关联问题卡会显著拉高这一项。`,
      deduction: deduction(score?.problemReframe || 0, '还没有形成可处理的问题描述、证据焦点或下一步行动。'),
    },
    {
      label: '系统沉淀',
      value: score?.systemSettlement || 0,
      note: '能否形成字段、动作、提醒或实验',
      reason: `${scoreContext(score)}系统根据保存去向计分：问题落地最高，观察任务其次，认知种子保留未来触发。`,
      deduction: deduction(score?.systemSettlement || 0, '沉淀还停在认知或观察层，没有进入字段、动作、提醒或实验。'),
    },
  ]
  const total = dimensions.reduce((sum, item) => sum + item.value, 0)
  return {
    title: '企业落地评分',
    score: total,
    max: 15,
    level: total >= 12 ? '可进入落地' : total >= 8 ? '先观察验证' : '只做认知沉淀',
    dimensions,
  }
}

const understanding = computed(() => buildUnderstandingSummary(selectedScore.value))
const landing = computed(() => buildLandingSummary(selectedScore.value))
</script>

<template>
  <section class="screen">
    <PageHeader
      eyebrow="评分与沉淀"
      title="按观点和日期查看训练分数"
      summary="观点可选，日期可选范围；单个观点看匹配训练，全部观点看范围内平均分。"
    />

    <section class="score-filter-panel">
      <label>
        <span>观点</span>
        <select v-model="selectedViewpointId">
          <option :value="allValue">全部观点</option>
          <option v-for="viewpoint in viewpointOptions" :key="viewpoint.id" :value="viewpoint.id">
            {{ viewpoint.title }}
          </option>
        </select>
      </label>
      <label>
        <span>开始日期</span>
        <input v-model="selectedStartDate" type="date" :min="dateBounds.min" :max="dateBounds.max" />
      </label>
      <label>
        <span>结束日期</span>
        <input v-model="selectedEndDate" type="date" :min="dateBounds.min" :max="dateBounds.max" />
      </label>
      <p>{{ scoreScopeLabel }}</p>
    </section>

    <section v-if="selectedScore" class="score-focus-card">
      <span>当前评分观点</span>
      <h2>{{ focusedViewpoint?.originalText || focusedResult?.title || selectedViewpointTitle }}</h2>
      <p>{{ focusedSupportText }}</p>
      <div v-if="focusedMetaItems.length" class="score-focus-card__meta">
        <small v-for="item in focusedMetaItems" :key="item">{{ item }}</small>
      </div>
    </section>

    <section v-if="selectedScore" class="score-summary-grid">
      <article class="score-summary">
        <ChartColumn :size="22" />
        <span>{{ understanding.title }}</span>
        <strong>{{ understanding.score }} / {{ understanding.max }}</strong>
        <p>{{ selectedDateLabel }} · {{ understanding.level }}</p>
      </article>
      <article class="score-summary">
        <Target :size="22" />
        <span>{{ landing.title }}</span>
        <strong>{{ landing.score }} / {{ landing.max }}</strong>
        <p>{{ selectedDateLabel }} · {{ landing.level }}</p>
      </article>
    </section>

    <section v-if="selectedScore" class="score-list">
      <article
        v-for="item in [...understanding.dimensions, ...landing.dimensions]"
        :key="item.label"
        class="score-detail-card"
      >
        <div class="score-detail-card__score">
          <strong>{{ item.value }}</strong>
          <span>/5</span>
        </div>
        <div class="score-detail-card__body">
          <div class="score-detail-card__head">
            <span>{{ item.label }}</span>
            <small>{{ item.note }}</small>
          </div>
          <p>{{ item.reason }}</p>
          <p class="score-detail-card__deduction">{{ item.deduction }}</p>
        </div>
      </article>
    </section>

    <section v-else class="empty-panel">
      <h2>没有匹配的评分</h2>
      <p>这个观点可能还没有保存过训练评分，换一个日期范围，或者先保存一次训练。</p>
    </section>

    <section class="weekly-panel">
      <div class="section-title">
        <CheckCircle2 :size="20" />
        <h2>回顾</h2>
      </div>
      <ReviewCards />
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
        <span>{{ formatDisplayDate(item.nextCheckAt) }} · {{ formatDueStatus(item.nextCheckAt) }}</span>
      </article>
    </section>
  </section>
</template>
