import { defineStore } from 'pinia'
import { businessSceneLabels } from '../models/domain'
import type {
  AiTrainingDraft,
  ArchivedTrainingResult,
  BusinessScene,
  CognitiveSeed,
  Confusion,
  MatchCandidate,
  ObservationTask,
  Problem,
  RelationLevel,
  ScoreSnapshot,
  ScoreSummary,
  TrainingOutcome,
  TrainingResult,
  TrainingSession,
  TriggerReminder,
  Viewpoint,
  WeeklyReview,
} from '../models/domain'

interface TrainingCompletionInput {
  viewpoint: string
  understanding: string
  causalChain: string
  oldModel: string
  boundary: string
  coreVariables: string[]
  scenes: BusinessScene[]
  relationLevel: RelationLevel
  outcome: TrainingOutcome
  aiDraft?: AiTrainingDraft
}

const today = '2026-05-16'
const validScenes = Object.keys(businessSceneLabels) as BusinessScene[]

function firstValidScene(scene: BusinessScene | string | undefined, fallback: BusinessScene): BusinessScene {
  return validScenes.includes(scene as BusinessScene) ? (scene as BusinessScene) : fallback
}

function clamp(value: number, max = 5) {
  return Math.max(0, Math.min(max, value))
}

function textScore(text: string, targetLength: number) {
  const lengthScore = Math.min(text.trim().length / targetLength, 1) * 3
  const evidenceScore = /因为|导致|如果|所以|证据|边界|变量|动作/.test(text) ? 1 : 0
  const concreteScore = /客户|销售|库存|品质|供应链|员工|AI|系统|流程/.test(text) ? 1 : 0
  return clamp(Math.round(lengthScore + evidenceScore + concreteScore))
}

function scoreFromInput(input: TrainingCompletionInput): ScoreSnapshot {
  return {
    id: `score-${Date.now()}`,
    date: today,
    understanding: textScore(input.understanding, 80),
    oldModelAwareness: textScore(input.oldModel, 60),
    sceneScan: clamp(input.scenes.length >= 3 ? 5 : input.scenes.length + 2),
    problemReframe: input.outcome === 'problem-grounding' ? textScore(input.aiDraft?.problemCard?.description || input.viewpoint, 50) : 0,
    abstraction: clamp(input.coreVariables.length >= 4 ? 5 : input.coreVariables.length),
    systemSettlement: input.outcome === 'archive' ? 1 : input.outcome === 'cognitive-seed' ? 3 : input.outcome === 'observation-task' ? 4 : 5,
  }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    todaySession: {
      id: 'session-today',
      title: '今日训练',
      createdAt: today,
      steps: [
        { key: 'input', title: '观点输入', status: 'active' },
        { key: 'understanding', title: '观点理解', status: 'empty' },
        { key: 'old-model', title: '旧模型觉察', status: 'empty' },
        { key: 'scene-scan', title: '企业场景扫描', status: 'empty' },
        { key: 'relation', title: '关联判断', status: 'empty' },
        { key: 'settle', title: '结果沉淀', status: 'empty' },
      ],
    } as TrainingSession,
    viewpoints: [
      {
        id: 'vp-1',
        title: '真正的数字化，是让真实被看见',
        originalText: '真正的数字化，是让真实被看见。',
        myUnderstanding:
          '不是有系统、有报表就算数字化，而是客户、库存、品质、销售动作和供应链状态能被真实显化。',
        causalChain: '真实被看见，差距才会被命名；差距被命名，动作才可能进入流程。',
        challengedOldModel: '以前更关注有没有 ERP、CRM、大屏和 AI 工具。',
        boundary: '真实显化需要治理节奏和字段取舍，不能把所有信息一次性压给一线。',
        createdAt: today,
        coreVariables: ['真实数据', '过程透明', '经营判断'],
        status: 'matched',
      },
      {
        id: 'vp-2',
        title: 'AI 不是替代思考，而是暴露不理解',
        originalText: 'AI 不是替代思考，而是暴露不理解。',
        myUnderstanding: 'AI 会放大组织对问题的理解水平，流程没想清楚时，自动化只会更快暴露混乱。',
        causalChain: '问题定义越粗，提示词越虚；提示词越虚，AI 产出越像热闹的空话。',
        challengedOldModel: '过去容易把 AI 当成直接生成答案的工具。',
        boundary: 'AI 可以辅助拆解、比较和提醒，但不能代替业务责任人做取舍。',
        createdAt: '2026-05-15',
        coreVariables: ['理解深度', '提示质量', '业务场景'],
        status: 'seeded',
      },
      {
        id: 'vp-3',
        title: '客户不是订单，而是长期资产',
        originalText: '客户不是订单，而是长期资产。',
        myUnderstanding: '订单只代表一次成交，资产视角要求看复购、沉默、关系维护和未来价值。',
        causalChain: '只看订单会忽略沉默客户；沉默没有预警，长期价值就会慢慢流失。',
        challengedOldModel: '过去把成交当作销售动作的终点。',
        boundary: '不是所有客户都值得高成本维护，必须分层。',
        createdAt: '2026-05-13',
        coreVariables: ['复购潜力', '沉默风险', '维护动作'],
        status: 'trained',
      },
    ] as Viewpoint[],
    problems: [
      {
        id: 'pb-1',
        title: '销售日报很多，但看不出客户是否推进',
        source: '销售管理',
        scene: 'sales',
        description: '过程记录有数量，缺少下一步动作、推进证据和风险信号。',
        urgency: 'medium',
        linkedViewpointIds: ['vp-1'],
        status: 'grounding',
        evidenceFocus: ['客户下一步动作', '推进证据', 'CRM 字段真实性'],
        nextAction: '抽一组客户跟进记录，检查是否有下一步动作和可验证证据。',
        createdAt: today,
      },
      {
        id: 'pb-2',
        title: 'AI 工具开了很多，但团队仍然不知道怎么落地',
        source: '数字化推进',
        scene: 'digital-ai',
        description: '工具被频繁试用，业务问题和流程边界没有被同步拆清楚。',
        urgency: 'high',
        linkedViewpointIds: ['vp-2'],
        status: 'grounding',
        evidenceFocus: ['真实业务问题', '流程责任人', 'AI 介入边界'],
        nextAction: '选择一个高频流程，把目标、输入、判断规则和人工确认点写清楚。',
        createdAt: '2026-05-15',
      },
    ] as Problem[],
    confusions: [
      {
        id: 'cf-1',
        title: '系统数据很多，但经营判断没有变快',
        feeling: '数字化投入不少，但数据没有真正进入每日判断。',
        possibleScenes: ['digital-ai', 'sales'],
        createdAt: today,
      },
      {
        id: 'cf-2',
        title: '客户维护到底靠人盯，还是靠系统提醒',
        feeling: '老客户沉默时，经常要等销售想起来才会处理。',
        possibleScenes: ['customer', 'sales'],
        createdAt: '2026-05-14',
      },
    ] as Confusion[],
    cognitiveSeeds: [
      {
        id: 'seed-1',
        title: 'AI 使用前先看理解是否足够',
        viewpointId: 'vp-2',
        understanding: 'AI 会放大组织对问题的理解水平。',
        challengedOldModel: '过去容易把 AI 当作直接生成答案的工具。',
        coreVariables: ['理解深度', '提示质量', '业务场景'],
        possibleScenes: ['digital-ai', 'employee'],
        risks: ['流程未清楚时直接自动化，会把混乱规模化'],
        boundaries: ['不替代业务判断，只辅助拆解和提醒'],
        futureTriggers: ['准备让团队用 AI 写制度时提醒', '总结变多但判断变浅时提醒'],
        status: 'waiting',
        createdAt: '2026-05-15',
      },
    ] as CognitiveSeed[],
    observationTasks: [
      {
        id: 'task-1',
        title: '观察客户是否被当作长期资产',
        viewpointId: 'vp-3',
        topic: '客户资产意识',
        period: '未来 3 天',
        target: '销售和客户跟进记录',
        questions: ['哪些客户只有订单记录', '哪些老客户沉默但没有提醒'],
        status: 'open',
        createdAt: today,
      },
    ] as ObservationTask[],
    matchCandidates: [
      {
        id: 'match-1',
        viewpointId: 'vp-1',
        targetId: 'pb-1',
        targetKind: 'problem',
        reason: '问题核心是过程真实不可见，和“真实被看见”的观点高度相关。',
        evidence: ['日报数量多但缺少推进证据', 'CRM 字段无法支撑判断', '下一步动作没有形成流程'],
        suggestedPath: '进入问题落地：重构销售跟进字段，并设置 AI 风险评分。',
        score: 88,
      },
      {
        id: 'match-2',
        viewpointId: 'vp-2',
        targetId: 'pb-2',
        targetKind: 'problem',
        reason: 'AI 落地卡住不是工具问题，而是问题理解和流程边界不清。',
        evidence: ['工具很多但业务目标模糊', '提示词难稳定复用', '没有人工确认点'],
        suggestedPath: '进入企业落地评分：先评估理解深度，再做最小流程实验。',
        score: 84,
      },
    ] as MatchCandidate[],
    triggerReminders: [
      {
        id: 'reminder-1',
        title: 'AI 制度生成前置检查',
        sourceKind: 'cognitive-seed',
        sourceId: 'seed-1',
        trigger: '准备让团队用 AI 写制度时提醒：先确认流程、责任人和例外边界。',
        nextCheckAt: '2026-05-20',
        status: 'waiting',
        createdAt: today,
      },
      {
        id: 'reminder-2',
        title: '客户沉默观察到期',
        sourceKind: 'observation-task',
        sourceId: 'task-1',
        trigger: '如果 3 天内发现 5 个以上客户缺少维护标签，转入问题池。',
        nextCheckAt: '2026-05-19',
        status: 'due',
        createdAt: today,
      },
    ] as TriggerReminder[],
    trainingResults: [
      {
        id: 'result-1',
        title: '真正的数字化，是让真实被看见',
        viewpointId: 'vp-1',
        relationLevel: 'strong',
        outcome: 'problem-grounding',
        targetKind: 'problem',
        targetId: 'pb-1',
        status: 'problem-grounding',
        statusLabel: '问题落地中',
        createdAt: today,
      },
      {
        id: 'result-2',
        title: 'AI 不是替代思考，而是暴露不理解',
        viewpointId: 'vp-2',
        relationLevel: 'temporary',
        outcome: 'cognitive-seed',
        targetKind: 'cognitive-seed',
        targetId: 'seed-1',
        status: 'waiting-trigger',
        statusLabel: '待未来触发',
        createdAt: '2026-05-15',
      },
      {
        id: 'result-3',
        title: '客户不是订单，而是长期资产',
        viewpointId: 'vp-3',
        relationLevel: 'weak',
        outcome: 'observation-task',
        targetKind: 'observation-task',
        targetId: 'task-1',
        status: 'observing',
        statusLabel: '观察中',
        createdAt: today,
      },
    ] as TrainingResult[],
    archivedTrainingResults: [
      {
        id: 'archive-1',
        title: '把所有会议纪要都自动总结就能提升管理',
        viewpointId: 'vp-archive-1',
        originalText: '把所有会议纪要都自动总结就能提升管理。',
        understanding: '表达过于粗糙，暂时看不出对企业判断的有效帮助。',
        reason: '没有可观察变量，也没有清晰企业问题，先归档避免污染训练池。',
        status: 'archived',
        createdAt: '2026-05-14',
      },
    ] as ArchivedTrainingResult[],
    lastSavedResultId: undefined as string | undefined,
    latestScore: {
      id: 'score-1',
      date: today,
      understanding: 4,
      oldModelAwareness: 4,
      sceneScan: 4,
      problemReframe: 3,
      abstraction: 4,
      systemSettlement: 4,
    } as ScoreSnapshot,
  }),
  getters: {
    poolCounts: (state) => ({
      viewpoint: state.viewpoints.length,
      problem: state.problems.length,
      confusion: state.confusions.length,
      seeds: state.cognitiveSeeds.length,
      tasks: state.observationTasks.length,
      results: state.trainingResults.length,
      archives: state.archivedTrainingResults.length,
      reminders: state.triggerReminders.length,
    }),
    viewpointUnderstandingScore: (state): ScoreSummary => {
      const dimensions = [
        { label: '能否复述观点', value: state.latestScore.understanding, note: '用自己的话讲清楚，不照搬原句' },
        { label: '能否看见旧模型', value: state.latestScore.oldModelAwareness, note: '知道它反对了什么默认假设' },
        { label: '能否抽出变量', value: state.latestScore.abstraction, note: '拆成可观察、可验证的经营变量' },
      ]
      const score = dimensions.reduce((sum, item) => sum + item.value, 0)
      return {
        title: '观点理解评分',
        score,
        max: 15,
        level: score >= 12 ? '稳定理解' : score >= 8 ? '可继续训练' : '需要重拆观点',
        dimensions,
      }
    },
    enterpriseLandingScore: (state): ScoreSummary => {
      const dimensions = [
        { label: '场景匹配', value: state.latestScore.sceneScan, note: '能否定位到真实企业场景' },
        { label: '问题重构', value: state.latestScore.problemReframe, note: '能否把观点转成可处理的问题' },
        { label: '系统沉淀', value: state.latestScore.systemSettlement, note: '能否形成字段、动作、提醒或实验' },
      ]
      const score = dimensions.reduce((sum, item) => sum + item.value, 0)
      return {
        title: '企业落地评分',
        score,
        max: 15,
        level: score >= 12 ? '可进入落地' : score >= 8 ? '先观察验证' : '只做认知沉淀',
        dimensions,
      }
    },
    weeklyReview: (state): WeeklyReview => {
      const matchedCount = state.matchCandidates.filter((item) => item.score >= 80).length
      const seededCount = state.trainingResults.filter((item) => item.targetKind === 'cognitive-seed').length
      const observationCount = state.trainingResults.filter((item) => item.targetKind === 'observation-task').length
      const enterpriseLandingCount = state.trainingResults.filter((item) => item.targetKind === 'problem').length
      return {
        trainedCount: state.trainingResults.length,
        matchedCount,
        seededCount,
        observationCount,
        enterpriseLandingCount,
        reviewText: '本周已经从“每天练一个观点”进入“观点反复被企业问题激活”的节奏。强关联负责落地，弱关联负责观察，暂不相关负责未来触发。',
        nextFocus: ['补齐每条观点的触发条件', '把高分匹配转成最小行动实验', '每周复盘一次低分维度'],
      }
    },
  },
  actions: {
    completeTodayTraining(input: TrainingCompletionInput) {
      const now = Date.now()
      const viewpointId = `vp-${now}`
      const resultId = `result-${now}`
      const title = input.viewpoint.replace(/[。！？]$/, '').slice(0, 34)
      const coreVariables = input.coreVariables.length > 0 ? input.coreVariables : ['待继续提炼']

      this.viewpoints.unshift({
        id: viewpointId,
        title,
        originalText: input.viewpoint,
        myUnderstanding: input.understanding,
        causalChain: input.causalChain,
        challengedOldModel: input.oldModel,
        boundary: input.boundary,
        coreVariables,
        status:
          input.outcome === 'archive'
            ? 'archived'
            : input.outcome === 'cognitive-seed'
              ? 'seeded'
              : 'trained',
        createdAt: today,
      })

      if (input.outcome === 'problem-grounding') {
        const problemId = `pb-${now}`
        const draft = input.aiDraft?.problemCard
        const scene = firstValidScene(draft?.scene, input.scenes[0] ?? 'digital-ai')
        this.problems.unshift({
          id: problemId,
          title: draft?.title || `${title} 的强关联落地问题`,
          source: '今日观点训练',
          scene,
          description: draft?.description || '已发现清晰企业场景，下一步进入问题重构、证据校准和最小行动实验。',
          urgency: 'medium',
          linkedViewpointIds: [viewpointId],
          status: 'grounding',
          evidenceFocus: draft?.evidenceFocus?.length ? draft.evidenceFocus : coreVariables.slice(0, 3),
          nextAction: draft?.nextAction || '先补一条最小行动实验：找一个真实场景，校准证据，再决定是否推进。',
          createdAt: today,
        })
        this.trainingResults.unshift({
          id: resultId,
          title,
          viewpointId,
          relationLevel: input.relationLevel,
          outcome: input.outcome,
          targetKind: 'problem',
          targetId: problemId,
          status: 'problem-grounding',
          statusLabel: '问题落地中',
          createdAt: today,
        })
      }

      if (input.outcome === 'observation-task') {
        const taskId = `task-${now}`
        const draft = input.aiDraft?.observationTaskCard
        this.observationTasks.unshift({
          id: taskId,
          title: draft?.title || `观察：${title}`,
          viewpointId,
          topic: draft?.topic || title,
          period: draft?.period || '未来 7 天',
          target:
            draft?.target ||
            (input.scenes.length > 0 ? input.scenes.map((scene) => businessSceneLabels[scene]).join('、') : '相关经营现场'),
          questions: draft?.questions?.length ? draft.questions : ['哪些现象支持这个观点', '哪些反例说明它还不能落地'],
          status: 'open',
          createdAt: today,
        })
        this.trainingResults.unshift({
          id: resultId,
          title,
          viewpointId,
          relationLevel: input.relationLevel,
          outcome: input.outcome,
          targetKind: 'observation-task',
          targetId: taskId,
          status: 'observing',
          statusLabel: '观察中',
          createdAt: today,
        })
      }

      if (input.outcome === 'cognitive-seed') {
        const seedId = `seed-${now}`
        const draft = input.aiDraft?.cognitiveSeedCard
        const futureTriggers = draft?.futureTriggers?.length
          ? draft.futureTriggers
          : ['出现相似企业现象时重新匹配', '相关场景出现明确证据时重新判断']
        this.cognitiveSeeds.unshift({
          id: seedId,
          title: draft?.title || title,
          viewpointId,
          understanding: input.understanding,
          challengedOldModel: input.oldModel,
          coreVariables,
          possibleScenes: input.scenes,
          risks: draft?.risks?.length ? draft.risks : ['暂不强行动，避免为了落地而落地'],
          boundaries: draft?.boundaries?.length ? draft.boundaries : ['只在真实企业问题出现时再激活'],
          futureTriggers,
          status: 'waiting',
          createdAt: today,
        })
        this.triggerReminders.unshift({
          id: `reminder-${now}`,
          title: `${title} 触发提醒`,
          sourceKind: 'cognitive-seed',
          sourceId: seedId,
          trigger: futureTriggers[0],
          nextCheckAt: '2026-05-23',
          status: 'waiting',
          createdAt: today,
        })
        this.trainingResults.unshift({
          id: resultId,
          title,
          viewpointId,
          relationLevel: input.relationLevel,
          outcome: input.outcome,
          targetKind: 'cognitive-seed',
          targetId: seedId,
          status: 'waiting-trigger',
          statusLabel: '待未来触发',
          createdAt: today,
        })
      }

      if (input.outcome === 'archive') {
        const archiveId = `archive-${now}`
        this.archivedTrainingResults.unshift({
          id: archiveId,
          title,
          viewpointId,
          originalText: input.viewpoint,
          understanding: input.understanding,
          reason: input.aiDraft?.archiveReason || '表达不成立、证据不足，或对企业判断暂时没有帮助。',
          status: 'archived',
          createdAt: today,
        })
        this.trainingResults.unshift({
          id: resultId,
          title,
          viewpointId,
          relationLevel: input.relationLevel,
          outcome: input.outcome,
          targetKind: 'archive',
          targetId: archiveId,
          status: 'archived',
          statusLabel: '已归档',
          createdAt: today,
        })
      }

      this.todaySession.viewpointId = viewpointId
      this.todaySession.resultId = resultId
      this.todaySession.relationLevel = input.relationLevel
      this.todaySession.outcome = input.outcome
      this.todaySession.steps = this.todaySession.steps.map((step) => ({ ...step, status: 'done' }))
      this.lastSavedResultId = resultId
      this.latestScore = scoreFromInput(input)
    },
  },
})
