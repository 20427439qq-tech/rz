<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, CircleGauge, GitCompareArrows, Sparkles } from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/appStore'
import type { MatchCandidate } from '../models/domain'

const store = useAppStore()
const problemText = ref('销售日报很多，但看不出客户是否真正推进。')
const matchedCandidates = ref<MatchCandidate[] | undefined>()

const matchKeywords = [
  '销售',
  '客户',
  '日报',
  'CRM',
  '推进',
  '订单',
  '复购',
  '沉默',
  '维护',
  '库存',
  '可售',
  '品质',
  '质量',
  '供应商',
  '供应链',
  '延期',
  '风险',
  'AI',
  '数字化',
  '流程',
  '字段',
  '证据',
  '数据',
  '责任人',
]

function candidateText(candidate: MatchCandidate) {
  const viewpoint = store.viewpoints.find((item) => item.id === candidate.viewpointId)
  const problem = store.problems.find((item) => item.id === candidate.targetId)

  return [
    viewpoint?.title,
    viewpoint?.originalText,
    viewpoint?.myUnderstanding,
    problem?.title,
    problem?.description,
    candidate.reason,
    candidate.suggestedPath,
    ...(candidate.evidence ?? []),
  ]
    .filter(Boolean)
    .join(' ')
}

function scoreCandidate(candidate: MatchCandidate, query: string) {
  const searchable = candidateText(candidate)
  const overlap = matchKeywords.filter((keyword) => query.includes(keyword) && searchable.includes(keyword)).length
  const sceneBoost = store.problems.find((item) => item.id === candidate.targetId && query.includes(item.source)) ? 4 : 0
  return Math.max(0, Math.min(99, candidate.score - 12 + overlap * 5 + sceneBoost))
}

function runMatching() {
  const query = problemText.value.trim()

  if (!query) {
    matchedCandidates.value = undefined
    return
  }

  matchedCandidates.value = store.matchCandidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, query),
      evidence: candidate.evidence ?? [],
    }))
    .filter((candidate) => candidate.score >= 45)
    .sort((a, b) => b.score - a.score)
}

const rankedCandidates = computed(() =>
  [...(matchedCandidates.value ?? store.matchCandidates)].sort((a, b) => b.score - a.score),
)

const activeProblem = computed(() => store.problems.find((item) => item.id === rankedCandidates.value[0]?.targetId))

function resultIdForCandidate(candidate: MatchCandidate) {
  return (
    store.trainingResults.find((item) => item.targetId === candidate.targetId)?.id ??
    store.trainingResults.find((item) => item.viewpointId === candidate.viewpointId)?.id
  )
}

const candidateRows = computed(() =>
  rankedCandidates.value.map((candidate) => {
    const resultId = resultIdForCandidate(candidate)

    return {
      candidate,
      detailUrl: resultId ? `/results/${resultId}` : undefined,
    }
  }),
)
</script>

<template>
  <section class="screen">
    <PageHeader
      eyebrow="匹配中心"
      title="让真实问题重新激活观点"
      summary="把问题池、困惑池、观点池和认知种子拉到一起，输出匹配分、匹配理由和下一步处理路径。"
    />

    <section class="form-shell">
      <h2>输入一个真实问题</h2>
      <textarea v-model="problemText" rows="4" />
      <button class="primary-link training-save" type="button" @click="runMatching">
        <Sparkles :size="19" />
        <span>自动匹配观点</span>
      </button>
    </section>

    <article v-if="activeProblem" class="match-problem">
      <span>当前问题</span>
      <h2>{{ activeProblem.title }}</h2>
      <p>{{ activeProblem.description }}</p>
    </article>

    <section class="content-stack">
      <component
        :is="row.detailUrl ? 'RouterLink' : 'article'"
        v-for="row in candidateRows"
        :key="row.candidate.id"
        class="match-result-card"
        :class="{ 'match-result-card--static': !row.detailUrl }"
        v-bind="row.detailUrl ? { to: row.detailUrl } : {}"
      >
        <div class="match-card__score">
          <CircleGauge :size="22" />
          <strong>{{ row.candidate.score }}</strong>
        </div>
        <div>
          <div class="result-card__meta">
            <span>观点匹配</span>
            <span>{{ row.candidate.score >= 85 ? '强推荐' : '可验证' }}</span>
            <span v-if="!row.detailUrl">暂无详情</span>
          </div>
          <h2>{{ store.viewpoints.find((item) => item.id === row.candidate.viewpointId)?.title }}</h2>
          <p>{{ row.candidate.reason }}</p>
          <ul class="detail-list">
            <li v-for="item in row.candidate.evidence" :key="item">{{ item }}</li>
          </ul>
          <p class="suggested-path">{{ row.candidate.suggestedPath }}</p>
        </div>
        <ArrowRight v-if="row.detailUrl" :size="18" />
      </component>
    </section>

    <RouterLink class="secondary-link" to="/pools">
      <GitCompareArrows :size="18" />
      <span>查看三个池</span>
    </RouterLink>
  </section>
</template>
