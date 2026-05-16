<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { Component } from 'vue'
import {
  BadgeCheck,
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Eye,
  Handshake,
  Lightbulb,
  LoaderCircle,
  PackageSearch,
  PlugZap,
  PlayCircle,
  Save,
  Settings,
  Sprout,
  Target,
  Truck,
  UserCheck,
  Users,
  WandSparkles,
  XCircle,
} from '@lucide/vue'
import PageHeader from '../components/PageHeader.vue'
import { useAppStore } from '../stores/appStore'
import type { AiTrainingDraft, BusinessScene, RelationLevel, TrainingOutcome, TrainingStep } from '../models/domain'
import {
  generateTrainingDraft,
  getAiConfig,
  saveAiConfig,
  testAiConfig,
  type PublicAiConfig,
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

const store = useAppStore()

const viewpoint = ref('真正的数字化，是让真实被看见。')
const understanding = ref('不是有系统、有报表就算数字化，而是企业里的客户、库存、品质、销售动作和供应链状态能被真实显化。')
const causalChain = ref('真实被看见，差距才会被命名；差距被命名，动作才可能进入流程。')
const oldModel = ref('以前更关注有没有 ERP、CRM、大屏和 AI 工具，现在要看系统有没有暴露真实差距。')
const boundary = ref('不能把所有信息一次性压给一线，真实显化需要治理节奏和字段取舍。')
const variablesText = ref('真实数据、流程字段、推进证据、客户资产、库存可售性、AI 判断质量')
const finalRelation = ref<RelationLevel>('temporary')
const saved = ref(false)
const aiDraft = ref<AiTrainingDraft | undefined>()
const aiConfig = ref<PublicAiConfig | undefined>()
const aiConfigOpen = ref(false)
const aiBusy = ref(false)
const aiSaving = ref(false)
const aiTesting = ref(false)
const aiMessage = ref('')
const aiSettings = reactive({
  model: '',
  apiKey: '',
  baseURL: '',
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
  { value: 'no-value', label: '无价值', hint: '表达不成立或对企业判断没有帮助' },
]

const sceneRelations = reactive<Record<BusinessScene, RelationLevel>>({
  sales: 'strong',
  customer: 'weak',
  product: 'temporary',
  quality: 'strong',
  inventory: 'weak',
  'supply-chain': 'temporary',
  employee: 'temporary',
  'digital-ai': 'weak',
})

const coreVariables = computed(() =>
  variablesText.value
    .split(/[、，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean),
)

const activeScenes = computed(() =>
  scenes.filter((scene) => ['strong', 'weak'].includes(sceneRelations[scene.key])),
)

const aiSceneReasons = computed(() =>
  scenes
    .map((scene) => ({
      title: scene.title,
      relation: aiDraft.value?.scenes?.[scene.key]?.relation,
      reason: aiDraft.value?.scenes?.[scene.key]?.reason,
    }))
    .filter((scene) => scene.reason),
)

const outcome = computed<TrainingOutcome>(() => {
  if (finalRelation.value === 'strong') return 'problem-grounding'
  if (finalRelation.value === 'weak') return 'observation-task'
  if (finalRelation.value === 'temporary') return 'cognitive-seed'
  return 'archive'
})

const savedResultLink = computed(() =>
  store.lastSavedResultId ? `/results/${store.lastSavedResultId}` : '/pools',
)

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
    icon: XCircle,
    title: '归档为无价值',
    text: '这条观点暂时不进入认知资产，避免污染判断系统。',
    tag: '无价值',
  }
})

const trainingSteps = computed<TrainingStep[]>(() => {
  const hasInput = viewpoint.value.trim().length > 0
  const hasUnderstanding = understanding.value.trim().length > 0 && causalChain.value.trim().length > 0
  const hasOldModel = oldModel.value.trim().length > 0
  const hasSceneScan = Object.values(sceneRelations).some((value) => value !== 'temporary')
  const hasRelation = Boolean(finalRelation.value)

  return store.todaySession.steps.map((step) => {
    const done =
      (step.key === 'input' && hasInput) ||
      (step.key === 'understanding' && hasUnderstanding) ||
      (step.key === 'old-model' && hasOldModel) ||
      (step.key === 'scene-scan' && hasSceneScan) ||
      (step.key === 'relation' && hasRelation) ||
      (step.key === 'settle' && saved.value)

    const active =
      !done &&
      ((step.key === 'input' && !hasInput) ||
        (step.key === 'understanding' && hasInput && !hasUnderstanding) ||
        (step.key === 'old-model' && hasUnderstanding && !hasOldModel) ||
        (step.key === 'scene-scan' && hasOldModel && !hasSceneScan) ||
        (step.key === 'relation' && hasSceneScan && !hasRelation) ||
        (step.key === 'settle' && hasRelation && !saved.value))

    const status: TrainingStep['status'] = done ? 'done' : active ? 'active' : 'empty'

    return {
      ...step,
      status,
    }
  })
})

const iconByStatus: Record<TrainingStep['status'], Component> = {
  done: CheckCircle2,
  active: PlayCircle,
  empty: Circle,
}

function chooseSceneRelation(scene: BusinessScene, relation: RelationLevel) {
  sceneRelations[scene] = relation
  finalRelation.value = relation
  saved.value = false
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
    aiMessage.value = aiConfig.value.savedModels.length ? `已读取 AI 配置：${aiConfig.value.activeModel}` : '还没有保存 AI 配置'
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
    const result = await testAiConfig()
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
    sceneRelations[scene.key] = draft.scenes?.[scene.key]?.relation || 'temporary'
  })
  finalRelation.value = draft.finalRelation
  aiDraft.value = draft
  saved.value = false
}

async function generateWithAi() {
  if (!viewpoint.value.trim()) {
    aiMessage.value = '先输入一句观点'
    return
  }

  aiBusy.value = true
  aiMessage.value = ''
  try {
    const draft = await generateTrainingDraft(viewpoint.value.trim())
    applyAiDraft(draft)
    aiMessage.value = 'AI 已生成训练内容，已回填到观点理解、旧模型和场景扫描'
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 生成失败'
  } finally {
    aiBusy.value = false
  }
}

function saveTraining() {
  if (!viewpoint.value.trim()) return

  store.completeTodayTraining({
    viewpoint: viewpoint.value.trim(),
    understanding: understanding.value.trim(),
    causalChain: causalChain.value.trim(),
    oldModel: oldModel.value.trim(),
    boundary: boundary.value.trim(),
    coreVariables: coreVariables.value,
    scenes: activeScenes.value.map((scene) => scene.key),
    relationLevel: finalRelation.value,
    outcome: outcome.value,
    aiDraft: aiDraft.value,
  })
  saved.value = true
}

onMounted(loadAiConfig)
</script>

<template>
  <section class="screen training-screen">
    <PageHeader
      eyebrow="今日训练"
      title="做完一次观点判断"
      summary="先理解观点，再看见旧模型，最后扫描企业场景并选择强关联、弱关联、暂不相关或无价值。"
    />

    <section class="ai-panel">
      <div class="training-card__head">
        <div class="section-title">
          <BrainCircuit :size="20" />
          <div>
            <h2>AI 辅助生成</h2>
            <p>AI 只负责拆解草稿，仍然必须遵守观点输入、理解训练、企业扫描和分流结果的脚手架。</p>
          </div>
        </div>
        <button class="icon-action" type="button" title="AI 配置" @click="aiConfigOpen = !aiConfigOpen">
          <Settings :size="18" />
        </button>
      </div>

      <div v-if="aiConfigOpen" class="ai-config-grid">
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

      <button class="primary-link ai-generate" type="button" :disabled="aiBusy" @click="generateWithAi">
        <LoaderCircle v-if="aiBusy" :size="19" class="spin-icon" />
        <WandSparkles v-else :size="19" />
        <span>{{ aiBusy ? 'AI 生成中' : '用 AI 生成训练内容' }}</span>
      </button>
      <p v-if="aiMessage" class="ai-message">{{ aiMessage }}</p>
    </section>

    <section class="step-list" aria-label="今日训练步骤">
      <article
        v-for="step in trainingSteps"
        :key="step.key"
        class="step-item"
        :class="`step-item--${step.status}`"
      >
        <component :is="iconByStatus[step.status]" :size="22" />
        <span>{{ step.title }}</span>
      </article>
    </section>

    <section class="form-shell training-card">
      <div class="section-title">
        <Lightbulb :size="20" />
        <h2>观点输入</h2>
      </div>
      <label for="viewpoint-input">今天只训练一个观点</label>
      <textarea
        id="viewpoint-input"
        v-model="viewpoint"
        rows="4"
        placeholder="输入一句观点、一段摘录、课程片段或会议记录..."
      />
    </section>

    <section class="training-grid">
      <article class="form-shell training-card">
        <h2>观点理解</h2>
        <label for="understanding">用自己的话讲清楚</label>
        <textarea id="understanding" v-model="understanding" rows="4" />
        <label for="causal-chain">因果链</label>
        <textarea id="causal-chain" v-model="causalChain" rows="3" />
      </article>

      <article class="form-shell training-card">
        <h2>旧模型觉察</h2>
        <label for="old-model">它反对我过去哪种默认假设</label>
        <textarea id="old-model" v-model="oldModel" rows="4" />
        <label for="boundary">边界和反例</label>
        <textarea id="boundary" v-model="boundary" rows="3" />
      </article>
    </section>

    <section class="form-shell training-card">
      <h2>核心变量</h2>
      <label for="variables">把观点拆成可观察变量</label>
      <textarea id="variables" v-model="variablesText" rows="3" />
      <div class="chip-row" aria-label="核心变量">
        <span v-for="variable in coreVariables" :key="variable" class="chip">{{ variable }}</span>
      </div>
    </section>

    <section class="training-card">
      <div class="training-card__head">
        <div>
          <h2>企业场景扫描</h2>
          <p>每个场景只做关联判断，不急着证明自己正确。</p>
        </div>
      </div>

      <div v-if="aiSceneReasons.length" class="ai-scan-notes" aria-label="AI 场景扫描理由">
        <article v-for="scene in aiSceneReasons" :key="scene.title">
          <span>{{ scene.title }} · {{ relationOptions.find((option) => option.value === scene.relation)?.label }}</span>
          <p>{{ scene.reason }}</p>
        </article>
      </div>

      <div class="scene-list">
        <article v-for="scene in scenes" :key="scene.key" class="scene-row">
          <div class="scene-row__main">
            <component :is="scene.icon" :size="22" />
            <div>
              <h3>{{ scene.title }}</h3>
              <p>{{ scene.prompt }}</p>
            </div>
          </div>
          <div class="segmented" :aria-label="`${scene.title}关联判断`">
            <button
              v-for="option in relationOptions"
              :key="option.value"
              type="button"
              :class="{ active: sceneRelations[scene.key] === option.value }"
              @click="chooseSceneRelation(scene.key, option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="training-card">
      <div class="training-card__head">
        <div>
          <h2>关联判断</h2>
          <p>把今天的训练收束成一个明确去向。</p>
        </div>
      </div>

      <div class="relation-grid">
        <button
          v-for="option in relationOptions"
          :key="option.value"
          type="button"
          class="relation-card"
          :class="{ active: finalRelation === option.value }"
          @click="finalRelation = option.value; saved = false"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.hint }}</span>
        </button>
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

    <button class="primary-link training-save" type="button" @click="saveTraining">
      <Save :size="20" />
      <span>{{ saved ? '今日训练已沉淀' : '保存今日训练' }}</span>
    </button>

    <RouterLink v-if="saved" class="secondary-link" :to="savedResultLink">
      查看沉淀详情
    </RouterLink>
  </section>
</template>
