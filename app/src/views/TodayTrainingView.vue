<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  BadgeCheck,
  Bot,
  Boxes,
  Eye,
  Handshake,
  Lightbulb,
  LoaderCircle,
  PackageSearch,
  PlugZap,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Sprout,
  Target,
  Truck,
  UserCheck,
  Users,
  WandSparkles,
} from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/appStore'
import { formatDisplayDateWithWeekday } from '../utils/date'
import { businessSceneLabels } from '../models/domain'
import type {
  AiSceneDraft,
  AiTrainingDraft,
  BusinessScene,
  RelationLevel,
  TrainingOutcome,
  TrainingResult,
} from '../models/domain'
import {
  generateViewpoint,
  getTrainingDraftJob,
  getAiConfig,
  saveAiConfig,
  startTrainingDraftJob,
  testAiConfig,
  type PublicAiConfig,
  type TrainingDraftJob,
} from '../services/aiTraining'

interface SceneItem {
  key: BusinessScene
  title: string
  prompt: string
  icon: Component
}

interface RelationOption {
  value: RelationLevel
  label: string
  hint: string
}

type TextFieldKey = 'viewpoint' | 'understanding' | 'causalChain' | 'oldModel' | 'boundary' | 'variablesText'

const store = useAppStore()
const route = useRoute()
const businessSceneKeys = Object.keys(businessSceneLabels) as BusinessScene[]

const viewpointInput = ref<HTMLTextAreaElement>()
const sourceViewpointId = ref('')
const sourceSupportText = ref('')
const viewpoint = ref('真正的数字化，是让真实被看见。')
const understanding = ref('不是有系统、有报表就算数字化，而是企业里的客户、库存、品质、销售动作和供应链状态能被真实显化。')
const causalChain = ref('真实被看见，差距才会被命名；差距被命名，动作才可能进入流程。')
const oldModel = ref('以前更关注有没有 ERP、CRM、大屏和 AI 工具，现在要看系统有没有暴露真实差距。')
const boundary = ref('不能把所有信息一次性压给一线，真实显化需要治理节奏和字段取舍。')
const variablesText = ref('真实数据、流程字段、推进证据、客户资产、库存可售性、AI 判断质量')
const saved = ref(false)
const aiDraft = ref<AiTrainingDraft | undefined>()
const savedAiScenes = ref<Partial<Record<BusinessScene, AiSceneDraft>>>({})
const aiConfig = ref<PublicAiConfig | undefined>()
const aiConfigOpen = ref(false)
const aiViewpointBusy = ref(false)
const aiDraftBusy = ref(false)
const aiSaving = ref(false)
const aiTesting = ref(false)
const aiMessage = ref('')
const aiJob = ref<TrainingDraftJob | undefined>()
const aiJobPoller = ref<number | undefined>()
const autoSaveTimer = ref<number | undefined>()
const aiSettings = reactive({
  model: '',
  apiKey: '',
  baseURL: '',
})

const aiTextFields = reactive<Record<TextFieldKey, boolean>>({
  viewpoint: false,
  understanding: false,
  causalChain: false,
  oldModel: false,
  boundary: false,
  variablesText: false,
})

const scenes: SceneItem[] = [
  { key: 'sales', title: '销售', prompt: 'CRM 记录是否真实，推进动作有没有证据？', icon: Handshake },
  { key: 'customer', title: '客户', prompt: '客户画像、复购潜力和沉默风险是否被系统看见？', icon: Users },
  { key: 'product', title: '产品', prompt: '新品开发是否基于真实需求和交付能力？', icon: PackageSearch },
  { key: 'quality', title: '品质', prompt: '每批产品的真实质量状态是否可追溯？', icon: BadgeCheck },
  { key: 'inventory', title: '库存', prompt: '理论库存、可售库存和滞销压力是否一致？', icon: Boxes },
  { key: 'supply-chain', title: '供应链', prompt: '供应商稳定性、延期风险和质量波动是否显化？', icon: Truck },
  { key: 'employee', title: '员工', prompt: '执行靠提醒，还是关键动作已经进入流程？', icon: UserCheck },
  { key: 'digital-ai', title: '数字化和 AI', prompt: 'AI 是否基于真实数据判断，而不是生成更多文本？', icon: Bot },
]

const relationOptions: RelationOption[] = [
  { value: 'strong', label: '强关联', hint: '今天就能落到一个真实问题' },
  { value: 'weak', label: '弱关联', hint: '先观察，等证据更清晰' },
  { value: 'temporary', label: '暂不相关', hint: '保留为未来可触发的认知种子' },
]

const sceneRelations = reactive<Record<BusinessScene, RelationLevel>>({
  sales: 'temporary',
  customer: 'temporary',
  product: 'temporary',
  quality: 'temporary',
  inventory: 'temporary',
  'supply-chain': 'temporary',
  employee: 'temporary',
  'digital-ai': 'temporary',
})

const defaultSceneRelations: Record<BusinessScene, RelationLevel> = {
  sales: 'temporary',
  customer: 'temporary',
  product: 'temporary',
  quality: 'temporary',
  inventory: 'temporary',
  'supply-chain': 'temporary',
  employee: 'temporary',
  'digital-ai': 'temporary',
}

const coreVariables = computed(() =>
  variablesText.value
    .split(/[、，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean),
)

const activeScenes = computed(() =>
  scenes.filter((scene) => ['strong', 'weak'].includes(sceneRelations[scene.key])),
)

const finalRelation = computed<RelationLevel>(() => {
  const values = scenes.map((scene) => sceneRelations[scene.key])
  if (values.includes('strong')) return 'strong'
  if (values.includes('weak')) return 'weak'
  return 'temporary'
})

function relationLabel(value?: RelationLevel) {
  return relationOptions.find((option) => option.value === value)?.label || '未生成'
}

const sceneJudgments = computed(() =>
  scenes.map((scene) => {
    const aiScene = aiDraft.value?.scenes?.[scene.key] || savedAiScenes.value[scene.key]
    const aiRelation = aiScene?.relation
    const aiReason = aiScene?.reason
    return {
      ...scene,
      aiRelation,
      aiReason,
      aiLabel: relationLabel(aiRelation),
      differsFromAi: Boolean(aiRelation && aiRelation !== sceneRelations[scene.key]),
    }
  }),
)

const outcome = computed<TrainingOutcome>(() => {
  if (finalRelation.value === 'strong') return 'problem-grounding'
  if (finalRelation.value === 'weak') return 'observation-task'
  return 'cognitive-seed'
})

const savedResultLink = computed(() =>
  store.lastSavedResultId ? `/results/${store.lastSavedResultId}` : '/pools',
)

const trainingDateLabel = computed(() => formatDisplayDateWithWeekday(store.todaySession.createdAt))

const canDecomposeWithAi = computed(() => viewpoint.value.trim().length > 0)

const outcomeCopy = computed(() => {
  if (outcome.value === 'problem-grounding') {
    return {
      icon: Target,
      title: '进入问题落地',
      text: '已经发现强关联，下一步做问题重构、证据校准和最小行动实验。',
      tag: '强关联',
    }
  }

  if (outcome.value === 'observation-task') {
    return {
      icon: Eye,
      title: '生成观察任务',
      text: '观点有启发但证据还不够，先带着它观察企业现场。',
      tag: '弱关联',
    }
  }

  if (outcome.value === 'cognitive-seed') {
    return {
      icon: Sprout,
      title: '沉淀认知种子',
      text: '暂不硬落地，保存未来触发条件，等真实问题出现时再匹配。',
      tag: '暂不相关',
    }
  }

  return {
    icon: Sprout,
    title: '沉淀认知种子',
    text: '暂不硬落地，保存未来触发条件，等真实问题出现时再匹配。',
    tag: '暂不相关',
  }
})

function setAiFields(fields: TextFieldKey[]) {
  fields.forEach((field) => {
    aiTextFields[field] = true
  })
}

function markHumanField(field: TextFieldKey) {
  aiTextFields[field] = false
  if (store.lastSavedResultId) {
    saved.value = false
    scheduleSavedRecordRefresh()
  } else {
    saved.value = false
  }
}

function handleViewpointInput() {
  markHumanField('viewpoint')
  autoResizeViewpointInput()
}

function autoResizeViewpointInput() {
  const el = viewpointInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function scheduleSavedRecordRefresh() {
  if (!store.lastSavedResultId) return
  if (autoSaveTimer.value) window.clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = window.setTimeout(() => {
    saveTraining({ silent: true })
  }, 650)
}

function clearTextField(field: TextFieldKey) {
  if (field === 'viewpoint') {
    viewpoint.value = ''
    sourceViewpointId.value = ''
    sourceSupportText.value = ''
    aiDraft.value = undefined
    savedAiScenes.value = {}
  }
  if (field === 'understanding') understanding.value = ''
  if (field === 'causalChain') causalChain.value = ''
  if (field === 'oldModel') oldModel.value = ''
  if (field === 'boundary') boundary.value = ''
  if (field === 'variablesText') variablesText.value = ''
  aiTextFields[field] = false
  saved.value = false
}

function clearDraftFields() {
  understanding.value = ''
  causalChain.value = ''
  oldModel.value = ''
  boundary.value = ''
  variablesText.value = ''
  Object.assign(sceneRelations, defaultSceneRelations)
  Object.keys(aiTextFields).forEach((field) => {
    aiTextFields[field as TextFieldKey] = false
  })
  aiDraft.value = undefined
  savedAiScenes.value = {}
  saved.value = false
}

function relationForLoadedScene(result: TrainingResult): RelationLevel {
  if (result.relationLevel === 'strong' || result.relationLevel === 'weak') return result.relationLevel
  return 'temporary'
}

function fallbackScenesFromTarget(result: TrainingResult): BusinessScene[] {
  if (result.targetKind === 'problem') {
    const problem = store.problems.find((item) => item.id === result.targetId)
    return problem?.scene ? [problem.scene] : []
  }

  if (result.targetKind === 'cognitive-seed') {
    return store.cognitiveSeeds.find((item) => item.id === result.targetId)?.possibleScenes || []
  }

  if (result.targetKind === 'observation-task') {
    const task = store.observationTasks.find((item) => item.id === result.targetId)
    return businessSceneKeys.filter((scene) => task?.target.includes(businessSceneLabels[scene]))
  }

  return []
}

function applyTrainingResultToForm(result: TrainingResult) {
  const source = store.viewpoints.find((item) => item.id === result.viewpointId)
  sourceViewpointId.value = source?.id || result.viewpointId
  sourceSupportText.value = source?.supportText || source?.myUnderstanding || ''
  viewpoint.value = source?.originalText || result.title
  understanding.value = source?.myUnderstanding || ''
  causalChain.value = source?.causalChain || ''
  oldModel.value = source?.challengedOldModel || ''
  boundary.value = source?.boundary || ''
  variablesText.value = source?.coreVariables?.join('、') || ''
  Object.assign(sceneRelations, defaultSceneRelations)
  const loadedScenes = result.scenes?.length ? result.scenes : fallbackScenesFromTarget(result)
  loadedScenes.forEach((scene) => {
    sceneRelations[scene] = relationForLoadedScene(result)
  })
  Object.keys(aiTextFields).forEach((field) => {
    aiTextFields[field as TextFieldKey] = false
  })
  aiDraft.value = undefined
  savedAiScenes.value = result.aiScenes || {}
  store.lastSavedResultId = result.id
  saved.value = true
  aiMessage.value = `已载入最近训练：${result.title}`
  nextTick(autoResizeViewpointInput)
}

function loadLatestTrainingResult() {
  const currentResult = store.lastSavedResultId
    ? store.trainingResults.find((item) => item.id === store.lastSavedResultId)
    : undefined
  const latestResult = currentResult || store.trainingResults[0]
  if (latestResult) applyTrainingResultToForm(latestResult)
}

function loadViewpointFromRoute() {
  const id = Array.isArray(route.query.viewpointId) ? route.query.viewpointId[0] : route.query.viewpointId
  if (!id) {
    loadLatestTrainingResult()
    return
  }
  if (id === sourceViewpointId.value) return
  const source = store.viewpoints.find((item) => item.id === id)
  if (!source) return

  sourceViewpointId.value = source.id
  sourceSupportText.value = source.supportText || source.myUnderstanding || ''
  viewpoint.value = source.originalText || source.title
  store.lastSavedResultId = undefined
  clearDraftFields()
  aiMessage.value = `已从观点列表带入：${source.title}`
  nextTick(() => {
    viewpointInput.value?.focus()
    autoResizeViewpointInput()
  })
}

function resetTodayTraining() {
  store.lastSavedResultId = undefined
  sourceViewpointId.value = ''
  sourceSupportText.value = ''
  viewpoint.value = ''
  understanding.value = ''
  causalChain.value = ''
  oldModel.value = ''
  boundary.value = ''
  variablesText.value = ''
  Object.assign(sceneRelations, defaultSceneRelations)
  Object.keys(aiTextFields).forEach((field) => {
    aiTextFields[field as TextFieldKey] = false
  })
  aiDraft.value = undefined
  savedAiScenes.value = {}
  aiMessage.value = ''
  saved.value = false
  nextTick(() => {
    viewpointInput.value?.focus()
    autoResizeViewpointInput()
  })
}

function syncAiForm(config: PublicAiConfig | undefined) {
  aiSettings.model = config?.activeModel || 'claude-sonnet-4-6'
  const active = config?.savedModels.find((item) => item.name === config.activeModel)
  aiSettings.baseURL = active?.baseURL || 'https://api.anthropic.com'
  aiSettings.apiKey = ''
}

async function loadAiConfig() {
  try {
    aiConfig.value = await getAiConfig()
    syncAiForm(aiConfig.value)
    aiMessage.value = ''
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 配置读取失败'
  }
}

async function saveCurrentAiConfig() {
  aiSaving.value = true
  aiMessage.value = ''
  try {
    aiConfig.value = await saveAiConfig({
      model: aiSettings.model,
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseURL,
    })
    syncAiForm(aiConfig.value)
    aiMessage.value = 'AI 配置已保存'
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 配置保存失败'
  } finally {
    aiSaving.value = false
  }
}

async function testCurrentAiConfig() {
  aiTesting.value = true
  aiMessage.value = ''
  try {
    const result = await testAiConfig({
      model: aiSettings.model,
      apiKey: aiSettings.apiKey,
      baseURL: aiSettings.baseURL,
    })
    aiMessage.value = `连接正常：${result.model}`
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 连接失败'
  } finally {
    aiTesting.value = false
  }
}

function applyAiDraft(draft: AiTrainingDraft) {
  understanding.value = draft.understanding || understanding.value
  causalChain.value = draft.causalChain || causalChain.value
  oldModel.value = draft.oldModel || oldModel.value
  boundary.value = draft.boundary || boundary.value
  variablesText.value = draft.coreVariables.length ? draft.coreVariables.join('、') : variablesText.value
  scenes.forEach((scene) => {
    const relation = draft.scenes?.[scene.key]?.relation
    if (relation) sceneRelations[scene.key] = relation
  })
  setAiFields(['understanding', 'causalChain', 'oldModel', 'boundary', 'variablesText'])
  aiDraft.value = draft
  savedAiScenes.value = draft.scenes
  saved.value = false
}

async function generateViewpointWithAi() {
  aiViewpointBusy.value = true
  aiMessage.value = ''
  try {
    const result = await generateViewpoint()
    store.lastSavedResultId = undefined
    sourceViewpointId.value = ''
    sourceSupportText.value = ''
    viewpoint.value = result.viewpoint
    clearDraftFields()
    aiTextFields.viewpoint = true
    saved.value = false
    aiMessage.value = 'AI 已生成观点，可直接修改或继续拆解'
    nextTick(() => {
      viewpointInput.value?.focus()
      autoResizeViewpointInput()
    })
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 生成观点失败'
  } finally {
    aiViewpointBusy.value = false
  }
}

function stopAiJobPolling() {
  if (!aiJobPoller.value) return
  window.clearInterval(aiJobPoller.value)
  aiJobPoller.value = undefined
}

async function pollAiDraftJob(jobId: string) {
  const job = await getTrainingDraftJob(jobId)
  aiJob.value = job

  if (job.status === 'done' && job.draft) {
    stopAiJobPolling()
    applyAiDraft(job.draft)
    saveTraining({ silent: true })
    aiDraftBusy.value = false
    aiMessage.value = 'AI 后台拆解完成，已自动保存今日训练；后续人工修改会刷新同一条记录'
  }

  if (job.status === 'failed') {
    stopAiJobPolling()
    aiDraftBusy.value = false
    aiMessage.value = job.error || 'AI 后台拆解失败'
  }
}

async function decomposeWithAi() {
  if (!viewpoint.value.trim()) {
    aiMessage.value = '先输入一句观点'
    nextTick(() => viewpointInput.value?.focus())
    return
  }

  aiDraftBusy.value = true
  aiMessage.value = 'AI 拆解已转入后台任务'
  stopAiJobPolling()
  try {
    aiJob.value = await startTrainingDraftJob(viewpoint.value.trim())
    aiJobPoller.value = window.setInterval(() => {
      if (!aiJob.value) return
      pollAiDraftJob(aiJob.value.id).catch((error) => {
        stopAiJobPolling()
        aiDraftBusy.value = false
        aiMessage.value = error instanceof Error ? error.message : 'AI 后台任务轮询失败'
      })
    }, 1200)
    await pollAiDraftJob(aiJob.value.id)
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 拆解失败'
    aiDraftBusy.value = false
    stopAiJobPolling()
  }
}

function saveTraining(options: { silent?: boolean } = {}) {
  if (!viewpoint.value.trim()) return undefined

  const resultId = store.completeTodayTraining({
    resultId: store.lastSavedResultId || undefined,
    sourceViewpointId: sourceViewpointId.value || undefined,
    viewpoint: viewpoint.value.trim(),
    supportText: sourceSupportText.value,
    understanding: understanding.value.trim(),
    causalChain: causalChain.value.trim(),
    oldModel: oldModel.value.trim(),
    boundary: boundary.value.trim(),
    coreVariables: coreVariables.value,
    scenes: activeScenes.value.map((scene) => scene.key),
    relationLevel: finalRelation.value,
    outcome: outcome.value,
    aiScenes: aiDraft.value?.scenes || savedAiScenes.value,
    aiDraft: aiDraft.value,
  })
  saved.value = true
  if (!options.silent) aiMessage.value = '今日训练已保存'
  return resultId
}

function handleSceneChange() {
  if (store.lastSavedResultId) {
    saved.value = false
    scheduleSavedRecordRefresh()
  } else {
    saved.value = false
  }
}

onMounted(() => {
  loadAiConfig()
  nextTick(autoResizeViewpointInput)
})
onBeforeUnmount(() => {
  stopAiJobPolling()
  if (autoSaveTimer.value) window.clearTimeout(autoSaveTimer.value)
})
watch(() => route.query.viewpointId, loadViewpointFromRoute, { immediate: true })
watch(viewpoint, () => nextTick(autoResizeViewpointInput))
</script>

<template>
  <section class="screen training-screen">
    <div class="training-page-head">
      <PageHeader
        :eyebrow="`今日训练 · ${trainingDateLabel}`"
        title="做完一次观点判断"
        summary="先理解观点，再看见旧模型，最后扫描企业场景并选择强关联、弱关联或暂不相关。"
      />
      <div class="training-header-actions" aria-label="训练工具">
        <button
          class="icon-action header-icon-action"
          type="button"
          title="AI 设置"
          aria-label="AI 设置"
          @click="aiConfigOpen = !aiConfigOpen"
        >
          <Settings :size="20" />
        </button>
        <button
          class="icon-action header-icon-action header-icon-action--reset"
          type="button"
          title="清空重置"
          aria-label="清空重置"
          @click="resetTodayTraining"
        >
          <RotateCcw :size="20" />
        </button>
        <button
          class="icon-action header-icon-action header-icon-action--generate"
          type="button"
          title="AI 生成观点"
          aria-label="AI 生成观点"
          :disabled="aiViewpointBusy"
          @click="generateViewpointWithAi"
        >
          <LoaderCircle v-if="aiViewpointBusy" :size="20" class="spin-icon" />
          <Sparkles v-else :size="20" />
        </button>
        <button
          class="icon-action header-icon-action header-icon-action--ai"
          type="button"
          :title="canDecomposeWithAi ? 'AI 拆解观点' : '先输入观点后再拆解'"
          :aria-label="canDecomposeWithAi ? 'AI 拆解观点' : '先输入观点后再拆解'"
          :disabled="aiDraftBusy || !canDecomposeWithAi"
          @click="decomposeWithAi"
        >
          <LoaderCircle v-if="aiDraftBusy" :size="20" class="spin-icon" />
          <WandSparkles v-else :size="20" />
        </button>
      </div>
    </div>

    <section v-if="aiConfigOpen" class="training-card ai-config-panel">
      <div class="ai-config-grid">
        <label>
          <span>模型</span>
          <input v-model="aiSettings.model" type="text" placeholder="claude-sonnet-4-6" />
        </label>
        <label>
          <span>Base URL</span>
          <input v-model="aiSettings.baseURL" type="text" placeholder="https://api.anthropic.com" />
        </label>
        <label class="ai-config-grid__wide">
          <span>API Key</span>
          <input v-model="aiSettings.apiKey" type="password" :placeholder="aiConfig?.savedModels.find((item) => item.name === aiSettings.model)?.maskedKey || '留空则保留已保存密钥'" />
        </label>
        <div class="ai-actions ai-config-grid__wide">
          <button type="button" class="secondary-link" :disabled="aiSaving" @click="saveCurrentAiConfig">
            <PlugZap :size="17" />
            <span>{{ aiSaving ? '保存中' : '保存配置' }}</span>
          </button>
          <button type="button" class="secondary-link" :disabled="aiTesting" @click="testCurrentAiConfig">
            <PlugZap :size="17" />
            <span>{{ aiTesting ? '测试中' : '测试连接' }}</span>
          </button>
        </div>
      </div>
    </section>

    <p v-if="aiMessage" class="ai-message">{{ aiMessage }}</p>

    <section v-if="aiJob && aiDraftBusy" class="ai-job-panel">
      <div>
        <span>{{ aiJob.message }}</span>
        <strong>{{ aiJob.progress }}%</strong>
      </div>
      <div class="ai-job-progress" aria-label="AI 后台拆解进度">
        <i :style="{ width: `${aiJob.progress}%` }"></i>
      </div>
      <p>心跳 {{ new Date(aiJob.heartbeatAt).toLocaleTimeString() }} · {{ aiJob.status }}</p>
    </section>

    <section class="form-shell training-card">
      <div class="section-title">
        <Lightbulb :size="20" />
        <h2>观点输入</h2>
      </div>
      <label for="viewpoint-input">今天只训练一个观点</label>
      <textarea
        id="viewpoint-input"
        ref="viewpointInput"
        v-model="viewpoint"
        class="training-viewpoint-input"
        :class="{ 'textarea--ai-draft': aiTextFields.viewpoint }"
        rows="1"
        placeholder="输入一句观点、一段摘录、课程片段或会议记录..."
        @input="handleViewpointInput"
        @dblclick="clearTextField('viewpoint')"
      />
      <div v-if="sourceSupportText" class="training-source-card">
        <b>文字支撑</b>
        <p>{{ sourceSupportText }}</p>
      </div>
    </section>

    <section class="training-grid">
      <article class="form-shell training-card">
        <h2>观点理解</h2>
        <label for="understanding">用自己的话讲清楚</label>
        <textarea
          id="understanding"
          v-model="understanding"
          :class="{ 'textarea--ai-draft': aiTextFields.understanding }"
          rows="4"
          @input="markHumanField('understanding')"
          @dblclick="clearTextField('understanding')"
        />
        <label for="causal-chain">因果链</label>
        <textarea
          id="causal-chain"
          v-model="causalChain"
          :class="{ 'textarea--ai-draft': aiTextFields.causalChain }"
          rows="3"
          @input="markHumanField('causalChain')"
          @dblclick="clearTextField('causalChain')"
        />
      </article>

      <article class="form-shell training-card">
        <h2>旧模型觉察</h2>
        <label for="old-model">它反对我过去哪种默认假设</label>
        <textarea
          id="old-model"
          v-model="oldModel"
          :class="{ 'textarea--ai-draft': aiTextFields.oldModel }"
          rows="4"
          @input="markHumanField('oldModel')"
          @dblclick="clearTextField('oldModel')"
        />
        <label for="boundary">边界和反例</label>
        <textarea
          id="boundary"
          v-model="boundary"
          :class="{ 'textarea--ai-draft': aiTextFields.boundary }"
          rows="3"
          @input="markHumanField('boundary')"
          @dblclick="clearTextField('boundary')"
        />
      </article>
    </section>

    <section class="form-shell training-card">
      <h2>核心变量</h2>
      <label for="variables">把观点拆成可观察变量</label>
      <textarea
        id="variables"
        v-model="variablesText"
        :class="{ 'textarea--ai-draft': aiTextFields.variablesText }"
        rows="3"
        @input="markHumanField('variablesText')"
        @dblclick="clearTextField('variablesText')"
      />
      <div class="chip-row" aria-label="核心变量">
        <span v-for="variable in coreVariables" :key="variable" class="chip">{{ variable }}</span>
      </div>
    </section>

    <section class="training-card">
      <div class="training-card__head">
        <div>
          <h2>企业场景判断</h2>
          <p>先做人工判断，再参考 AI 建议；最终结果以人工判断为准。</p>
        </div>
      </div>

      <div class="scene-list">
        <article v-for="scene in sceneJudgments" :key="scene.key" class="scene-row">
          <div class="scene-row__main">
            <component :is="scene.icon" :size="22" />
            <div>
              <h3>{{ scene.title }}</h3>
              <p>{{ scene.prompt }}</p>
            </div>
          </div>
          <label class="scene-row__control">
            <span>人工判断</span>
            <select v-model="sceneRelations[scene.key]" :aria-label="`${scene.title}人工判断`" @change="handleSceneChange">
              <option
                v-for="option in relationOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <div class="scene-row__ai">
            <span>AI建议</span>
            <b class="ai-pill" :class="{ 'ai-pill--empty': !scene.aiRelation }">{{ scene.aiLabel }}</b>
            <em v-if="scene.differsFromAi">与 AI 不同</em>
          </div>
          <div class="scene-row__reason">
            <span>AI理由</span>
            <p>{{ scene.aiReason || 'AI拆解后显示建议理由' }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="result-panel" :class="`result-panel--${finalRelation}`">
      <div class="result-panel__icon">
        <component :is="outcomeCopy.icon" :size="24" />
      </div>
      <div>
        <div class="result-panel__title">
          <h2>{{ outcomeCopy.title }}</h2>
          <span>{{ outcomeCopy.tag }}</span>
        </div>
        <p>{{ outcomeCopy.text }}</p>
        <p class="result-panel__source">由人工场景判断自动汇总</p>
        <div class="result-fields">
          <div>
            <b>观点</b>
            <p>{{ viewpoint }}</p>
          </div>
          <div>
            <b>理解</b>
            <p>{{ understanding }}</p>
          </div>
          <div>
            <b>旧模型</b>
            <p>{{ oldModel }}</p>
          </div>
          <div>
            <b>关联场景</b>
            <p>{{ activeScenes.map((scene) => scene.title).join('、') || '暂无强弱关联场景' }}</p>
          </div>
        </div>
      </div>
    </section>

    <button class="primary-link training-save" type="button" @click="saveTraining()">
      <Save :size="20" />
      <span>{{ saved ? '今日训练已沉淀' : '保存今日训练' }}</span>
    </button>

    <p v-if="saved" class="ai-message">已保存到 {{ store.todaySession.createdAt }} 的训练记录</p>

    <RouterLink v-if="saved" class="secondary-link" :to="savedResultLink">
      查看沉淀详情
    </RouterLink>
  </section>
</template>
