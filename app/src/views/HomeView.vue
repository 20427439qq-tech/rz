<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  BookOpenText,
  CalendarCheck,
  ChevronsDown,
  ChevronsUp,
  LineChart,
  Link,
  LoaderCircle,
  Pencil,
  Save,
  Sprout,
  Trash2,
  WandSparkles,
  X,
} from '@lucide/vue'
import ReviewCards from '../components/ReviewCards.vue'
import { useAppStore } from '../stores/appStore'
import { parseCognitionText, parseCognitionUrl } from '../services/aiTraining'
import { formatDisplayDate, todayInChina } from '../utils/date'
import type { Viewpoint } from '../models/domain'

const store = useAppStore()
const today = todayInChina()
const importOpen = ref(false)
const viewpointPoolExpanded = ref(false)
const selectedViewpoint = ref<Viewpoint | undefined>()
const importBusy = ref(false)
const organizeBusy = ref(false)
const importMessage = ref('')
const detailEditing = ref(false)
const goldQuoteSeed = ref(Math.floor(Math.random() * 1000000))
const importForm = reactive({
  viewpoint: '',
  supportText: '',
  sourceUrl: '',
  sourceTitle: '',
  tagsText: '',
})
const editForm = reactive({
  viewpoint: '',
  supportText: '',
  sourceTitle: '',
  sourceUrl: '',
  tagsText: '',
})

const latestResult = computed(() => store.trainingResults[0])
const latestViewpoint = computed(() =>
  latestResult.value ? store.viewpoints.find((item) => item.id === latestResult.value?.viewpointId) : undefined,
)

const todayScores = computed(() => store.scoreSnapshots.filter((score) => score.date === today))
const todayDone = computed(() => todayScores.value.length > 0)
const trainingSummary = computed(() =>
  todayDone.value ? `今天已保存 ${todayScores.value.length} 条训练。` : '今天还没有训练记录。',
)

const latestUnderstandingScore = computed(
  () => store.latestScore.understanding + store.latestScore.oldModelAwareness + store.latestScore.abstraction,
)
const latestLandingScore = computed(
  () => store.latestScore.sceneScan + store.latestScore.problemReframe + store.latestScore.systemSettlement,
)

const untrainedViewpoints = computed(() => store.viewpoints.filter((viewpoint) => viewpoint.status === 'draft'))
const visibleViewpoints = computed(() =>
  viewpointPoolExpanded.value ? untrainedViewpoints.value : untrainedViewpoints.value.slice(0, 3),
)
const showViewpointToggle = computed(() => untrainedViewpoints.value.length > 3)

const importTags = computed(() =>
  importForm.tagsText
    .split(/[、，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean),
)

function cleanQuoteText(value: string) {
  return value
    .replace(/[“”"「」]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimGoldQuote(value: string) {
  const text = cleanQuoteText(value).replace(/[。！？.!?]$/, '')
  if (text.length <= 46) return text
  return `${text.slice(0, 44)}…`
}

function quoteScore(value: string) {
  const text = cleanQuoteText(value)
  let score = 0
  if (text.length >= 14 && text.length <= 46) score += 2
  if (/不是.+而是|如果.+就|真正|要|必须|只有|才能|先.+再/.test(text)) score += 2
  if (/[。！？.!?]$/.test(text)) score += 1
  return score
}

function sentenceFromSupport(value = '') {
  const sentences = cleanQuoteText(value)
    .split(/(?<=[。！？.!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
  const preferred = sentences.find((item) => item.length >= 14 && item.length <= 46)
  return preferred || sentences.find((item) => item.length >= 10) || ''
}

function goldQuoteFromViewpoint(viewpoint: Viewpoint) {
  const original = cleanQuoteText(viewpoint.originalText || viewpoint.title || '')
  const support = sentenceFromSupport(viewpoint.supportText || viewpoint.myUnderstanding || '')
  const candidate = original.length >= 10 ? original : support
  return candidate ? trimGoldQuote(candidate) : ''
}

const goldQuoteCandidates = computed(() => {
  const candidates = store.viewpoints
    .filter((viewpoint) => viewpoint.status !== 'archived')
    .map(goldQuoteFromViewpoint)
    .filter(Boolean)
    .map((quote) => ({ quote, score: quoteScore(quote) }))
  const preferred = candidates.filter((item) => item.score >= 2)
  return (preferred.length ? preferred : candidates).map((item) => item.quote)
})

const goldQuote = computed(() => {
  const candidates = goldQuoteCandidates.value
  if (!candidates.length) return '先保存一条观点，让今天有一个可训练的判断。'
  return candidates[goldQuoteSeed.value % candidates.length]
})

function resetImportForm() {
  importForm.viewpoint = ''
  importForm.supportText = ''
  importForm.sourceUrl = ''
  importForm.sourceTitle = ''
  importForm.tagsText = ''
}

function viewpointSupport(viewpoint: Viewpoint) {
  const text = viewpoint.supportText || viewpoint.myUnderstanding || '暂无文字支撑'
  return text.length > 128 ? `${text.slice(0, 128)}...` : text
}

function viewpointTags(viewpoint: Viewpoint) {
  return (viewpoint.tags || []).slice(0, 3)
}

function viewpointStatusLabel(status: Viewpoint['status']) {
  const labels: Record<Viewpoint['status'], string> = {
    draft: '草稿',
    trained: '已训练',
    seeded: '种子',
    matched: '已匹配',
    archived: '已归档',
  }
  return labels[status]
}

function openViewpointDetail(viewpoint: Viewpoint) {
  selectedViewpoint.value = viewpoint
  detailEditing.value = false
  syncEditForm(viewpoint)
}

function syncEditForm(viewpoint: Viewpoint) {
  editForm.viewpoint = viewpoint.originalText || viewpoint.title
  editForm.supportText = viewpoint.supportText || viewpoint.myUnderstanding || ''
  editForm.sourceTitle = viewpoint.sourceTitle || ''
  editForm.sourceUrl = viewpoint.sourceUrl || ''
  editForm.tagsText = (viewpoint.tags || []).join('、')
}

function editTags() {
  return editForm.tagsText
    .split(/[、，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function startEditViewpoint() {
  if (!selectedViewpoint.value) return
  syncEditForm(selectedViewpoint.value)
  detailEditing.value = true
}

function cancelEditViewpoint() {
  if (selectedViewpoint.value) syncEditForm(selectedViewpoint.value)
  detailEditing.value = false
}

function saveEditedViewpoint() {
  if (!selectedViewpoint.value) return
  try {
    const updated = store.updateViewpointDraft(selectedViewpoint.value.id, {
      viewpoint: editForm.viewpoint,
      supportText: editForm.supportText,
      sourceType: editForm.sourceUrl ? 'web' : selectedViewpoint.value.sourceType || 'manual',
      sourceTitle: editForm.sourceTitle,
      sourceUrl: editForm.sourceUrl,
      tags: editTags(),
    })
    selectedViewpoint.value = updated
    detailEditing.value = false
    importMessage.value = `已更新观点卡：${updated.title}`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : '观点修改失败'
  }
}

function deleteSelectedViewpoint() {
  if (!selectedViewpoint.value) return
  try {
    const removed = store.deleteViewpointDraft(selectedViewpoint.value.id)
    selectedViewpoint.value = undefined
    detailEditing.value = false
    importMessage.value = `已删除观点卡：${removed.title}`
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : '观点删除失败'
  }
}

function saveCognition() {
  importMessage.value = ''
  try {
    const item = store.importCognition({
      viewpoint: importForm.viewpoint,
      supportText: importForm.supportText,
      sourceType: importForm.sourceUrl ? 'web' : 'manual',
      sourceTitle: importForm.sourceTitle,
      sourceUrl: importForm.sourceUrl,
      tags: importTags.value,
    })
    importMessage.value = `已存入观点列表：${item.title}`
    resetImportForm()
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : '认知导入失败'
  }
}

async function organizeText() {
  const rawText = importForm.supportText.trim()
  if (rawText.length < 20) {
    importMessage.value = '先在原料文字里粘贴一段内容'
    return
  }

  organizeBusy.value = true
  importMessage.value = ''
  try {
    const draft = await parseCognitionText(rawText)
    const cards = draft.cards?.length ? draft.cards : [draft]
    const created = store.importCognitionBatch(
      cards.map((card) => ({
        viewpoint: card.viewpoint,
        supportText: card.supportText,
        sourceType: 'manual',
        sourceTitle: card.sourceTitle || '手动粘贴原料',
        sourceUrl: '',
        tags: card.tags,
      })),
    )
    viewpointPoolExpanded.value = true
    importMessage.value = draft.usedFallback
      ? `AI 不可用，已按原文切分生成 ${created.length} 张观点卡`
      : `AI 已整理出 ${created.length} 张观点训练卡片，并存入观点列表`
    importForm.viewpoint = ''
    importForm.tagsText = ''
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : 'AI 整理失败'
  } finally {
    organizeBusy.value = false
  }
}

async function parseUrl() {
  if (!importForm.sourceUrl.trim()) {
    importMessage.value = '先输入网页地址'
    return
  }

  importBusy.value = true
  importMessage.value = ''
  try {
    const draft = await parseCognitionUrl(importForm.sourceUrl.trim())
    importForm.viewpoint = draft.viewpoint
    importForm.supportText = draft.supportText
    importForm.sourceTitle = draft.sourceTitle || ''
    importForm.sourceUrl = draft.sourceUrl || importForm.sourceUrl.trim()
    importForm.tagsText = draft.tags.join('、')
    importMessage.value = draft.usedFallback ? '网页已解析，AI 不可用时已生成摘要草稿' : '网页已解析，请确认后存入观点列表'
  } catch (error) {
    importMessage.value = error instanceof Error ? error.message : '网页解析失败'
  } finally {
    importBusy.value = false
  }
}
</script>

<template>
  <section class="screen">
    <div class="home-page-head">
      <header class="home-quote-head">
        <div class="home-quote-head__meta">
          <span>今日工作台 · {{ formatDisplayDate(today) }}</span>
          <p>{{ trainingSummary }}</p>
        </div>
        <h1>“{{ goldQuote }}”</h1>
      </header>
      <button
        class="icon-action header-icon-action home-import-toggle"
        :class="{ 'home-import-toggle--active': importOpen }"
        type="button"
        :title="importOpen ? '收起认知导入' : '打开认知导入'"
        :aria-label="importOpen ? '收起认知导入' : '打开认知导入'"
        :aria-expanded="importOpen"
        @click="importOpen = !importOpen"
      >
        <BookOpenText :size="20" />
      </button>
    </div>

    <section v-if="importOpen" class="cognition-import home-section">
      <div class="section-title">
        <BookOpenText :size="20" />
        <h2>认知导入</h2>
      </div>
      <div class="cognition-import__url">
        <label>
          <span>网页地址</span>
          <input v-model="importForm.sourceUrl" type="url" placeholder="粘贴文章、课程或网页地址..." />
        </label>
        <button class="secondary-link" type="button" :disabled="importBusy" @click="parseUrl">
          <LoaderCircle v-if="importBusy" :size="18" class="spin-icon" />
          <Link v-else :size="18" />
          <span>{{ importBusy ? '解析中' : '解析网页' }}</span>
        </button>
      </div>
      <label>
        <span>一句话观点</span>
        <input v-model="importForm.viewpoint" type="text" placeholder="例如：因无所住，而生其心。" />
      </label>
      <div class="cognition-import__field">
        <div class="cognition-import__field-head">
          <label for="cognition-support">原料/支撑文字</label>
          <button class="secondary-link cognition-import__ai" type="button" :disabled="organizeBusy" @click="organizeText">
            <LoaderCircle v-if="organizeBusy" :size="17" class="spin-icon" />
            <WandSparkles v-else :size="17" />
            <span>{{ organizeBusy ? '整理中' : 'AI整理' }}</span>
          </button>
        </div>
        <textarea
          id="cognition-support"
          v-model="importForm.supportText"
          rows="4"
          placeholder="粘贴一大段认知原料，或直接写支撑/解释文字..."
        />
      </div>
      <label>
        <span>标签</span>
        <input v-model="importForm.tagsText" type="text" placeholder="客户、系统、AI，用顿号或逗号分隔" />
      </label>
      <div class="cognition-import__actions">
        <button class="primary-link" type="button" @click="saveCognition">
          <Save :size="18" />
          <span>存入观点列表</span>
        </button>
      </div>
      <p v-if="importMessage" class="ai-message">{{ importMessage }}</p>
    </section>

    <section class="home-section viewpoint-pool">
      <div class="viewpoint-pool__head">
        <div class="section-title">
          <BookOpenText :size="20" />
          <div>
            <h2>观点列表</h2>
            <p>先保存认知原料，后续再决定是否进入训练。</p>
          </div>
        </div>
        <div class="viewpoint-pool__tools">
          <span>{{ untrainedViewpoints.length }} 张</span>
          <button
            v-if="showViewpointToggle"
            class="icon-action viewpoint-pool__toggle"
            type="button"
            :title="viewpointPoolExpanded ? '收起更多观点' : '展开更多观点'"
            :aria-label="viewpointPoolExpanded ? '收起更多观点' : '展开更多观点'"
            @click="viewpointPoolExpanded = !viewpointPoolExpanded"
          >
            <ChevronsUp v-if="viewpointPoolExpanded" :size="20" />
            <ChevronsDown v-else :size="20" />
          </button>
        </div>
      </div>

      <p v-if="importMessage && !importOpen" class="ai-message">{{ importMessage }}</p>

      <div v-if="visibleViewpoints.length" class="viewpoint-card-list">
        <article
          v-for="viewpoint in visibleViewpoints"
          :key="viewpoint.id"
          class="viewpoint-card"
          role="button"
          tabindex="0"
          @click="openViewpointDetail(viewpoint)"
          @keydown.enter.prevent="openViewpointDetail(viewpoint)"
          @keydown.space.prevent="openViewpointDetail(viewpoint)"
        >
          <div class="viewpoint-card__body">
            <h3>{{ viewpoint.originalText || viewpoint.title }}</h3>
            <p>{{ viewpointSupport(viewpoint) }}</p>
          </div>
          <footer>
            <span>{{ formatDisplayDate(viewpoint.createdAt) }}</span>
            <span>{{ viewpointStatusLabel(viewpoint.status) }}</span>
            <span v-for="tag in viewpointTags(viewpoint)" :key="tag">{{ tag }}</span>
          </footer>
        </article>
      </div>
      <p v-else class="empty-copy">还没有未训练观点卡，点右上角图标先导入一条认知原料。</p>
    </section>

    <div v-if="selectedViewpoint" class="viewpoint-detail-backdrop" @click.self="selectedViewpoint = undefined">
      <article class="viewpoint-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="viewpoint-detail-title">
        <button class="icon-action viewpoint-detail__close" type="button" title="关闭" aria-label="关闭" @click="selectedViewpoint = undefined">
          <X :size="18" />
        </button>
        <header>
          <span>观点详情</span>
          <h2 v-if="!detailEditing" id="viewpoint-detail-title">{{ selectedViewpoint.originalText || selectedViewpoint.title }}</h2>
          <label v-else class="viewpoint-detail__edit-field" for="viewpoint-edit-text">
            <span>观点</span>
            <textarea id="viewpoint-edit-text" v-model="editForm.viewpoint" rows="2" />
          </label>
        </header>
        <div v-if="!detailEditing" class="viewpoint-detail__support">
          <b>文字支撑</b>
          <p>{{ selectedViewpoint.supportText || selectedViewpoint.myUnderstanding || '暂无文字支撑' }}</p>
        </div>
        <div v-else class="viewpoint-detail__edit-grid">
          <label class="viewpoint-detail__edit-field" for="viewpoint-edit-support">
            <span>文字支撑</span>
            <textarea id="viewpoint-edit-support" v-model="editForm.supportText" rows="6" />
          </label>
          <label class="viewpoint-detail__edit-field" for="viewpoint-edit-title">
            <span>来源标题</span>
            <input id="viewpoint-edit-title" v-model="editForm.sourceTitle" type="text" />
          </label>
          <label class="viewpoint-detail__edit-field" for="viewpoint-edit-url">
            <span>来源链接</span>
            <input id="viewpoint-edit-url" v-model="editForm.sourceUrl" type="url" />
          </label>
          <label class="viewpoint-detail__edit-field" for="viewpoint-edit-tags">
            <span>标签</span>
            <input id="viewpoint-edit-tags" v-model="editForm.tagsText" type="text" />
          </label>
        </div>
        <footer v-if="!detailEditing">
          <span>{{ formatDisplayDate(selectedViewpoint.createdAt) }}</span>
          <span>{{ viewpointStatusLabel(selectedViewpoint.status) }}</span>
          <span v-for="tag in viewpointTags(selectedViewpoint)" :key="tag">{{ tag }}</span>
        </footer>
        <div class="viewpoint-detail__actions">
          <template v-if="detailEditing">
            <button class="secondary-link" type="button" @click="cancelEditViewpoint">
              <X :size="17" />
              <span>取消</span>
            </button>
            <button class="primary-link" type="button" @click="saveEditedViewpoint">
              <Save :size="18" />
              <span>保存修改</span>
            </button>
          </template>
          <template v-else>
            <button class="secondary-link" type="button" @click="startEditViewpoint">
              <Pencil :size="17" />
              <span>修改</span>
            </button>
            <button class="secondary-link secondary-link--danger" type="button" @click="deleteSelectedViewpoint">
              <Trash2 :size="17" />
              <span>删除</span>
            </button>
            <RouterLink
              class="primary-link viewpoint-detail__train"
              :to="{ path: '/training', query: { viewpointId: selectedViewpoint.id } }"
            >
              <CalendarCheck :size="18" />
              <span>现在训练</span>
            </RouterLink>
          </template>
        </div>
      </article>
    </div>

    <section class="home-section latest-training">
      <div class="section-title">
        <LineChart :size="20" />
        <h2>最近一次训练</h2>
      </div>
      <div v-if="latestResult" class="latest-training__body">
        <div>
          <span>{{ formatDisplayDate(latestResult.createdAt) }} · {{ latestResult.statusLabel }}</span>
          <h2>{{ latestResult.title }}</h2>
          <p>{{ latestViewpoint?.myUnderstanding || latestViewpoint?.originalText }}</p>
        </div>
        <div class="score-mini-grid">
          <RouterLink to="/score">
            <span>观点理解</span>
            <strong>{{ latestUnderstandingScore }} / 15</strong>
          </RouterLink>
          <RouterLink to="/score">
            <span>企业落地</span>
            <strong>{{ latestLandingScore }} / 15</strong>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="home-section">
      <div class="section-title">
        <Sprout :size="20" />
        <h2>回顾</h2>
      </div>
      <ReviewCards />
    </section>
  </section>
</template>
