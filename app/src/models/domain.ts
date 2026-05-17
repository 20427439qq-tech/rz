export type PoolKind = 'viewpoint' | 'problem' | 'confusion'

export type ResultTargetKind = 'problem' | 'observation-task' | 'cognitive-seed' | 'archive'

export type RelationLevel = 'strong' | 'weak' | 'temporary' | 'no-value'

export type TrainingOutcome =
  | 'problem-grounding'
  | 'observation-task'
  | 'cognitive-seed'
  | 'archive'

export type BusinessScene =
  | 'sales'
  | 'customer'
  | 'product'
  | 'quality'
  | 'inventory'
  | 'supply-chain'
  | 'employee'
  | 'digital-ai'

export interface AiSceneDraft {
  relation: RelationLevel
  reason: string
}

export interface AiProblemCardDraft {
  title: string
  description: string
  scene: BusinessScene
  evidenceFocus: string[]
  nextAction: string
}

export interface AiObservationTaskCardDraft {
  title: string
  topic: string
  period: string
  target: string
  questions: string[]
}

export interface AiCognitiveSeedCardDraft {
  title: string
  risks: string[]
  boundaries: string[]
  futureTriggers: string[]
}

export interface AiTrainingDraft {
  understanding: string
  causalChain: string
  oldModel: string
  boundary: string
  coreVariables: string[]
  scenes: Record<BusinessScene, AiSceneDraft>
  finalRelation: RelationLevel
  problemCard?: AiProblemCardDraft
  observationTaskCard?: AiObservationTaskCardDraft
  cognitiveSeedCard?: AiCognitiveSeedCardDraft
  archiveReason?: string
}

export interface BaseRecord {
  id: string
  title: string
  createdAt: string
  updatedAt?: string
}

export interface Viewpoint extends BaseRecord {
  originalText: string
  supportText?: string
  sourceType?: 'manual' | 'web' | 'article' | 'course' | 'meeting' | 'chat' | 'ai-extract'
  sourceTitle?: string
  sourceUrl?: string
  myUnderstanding?: string
  causalChain?: string
  challengedOldModel?: string
  boundary?: string
  coreVariables: string[]
  tags?: string[]
  status: 'draft' | 'trained' | 'seeded' | 'matched' | 'archived'
}

export interface Problem extends BaseRecord {
  source: string
  scene: BusinessScene
  description: string
  urgency: 'low' | 'medium' | 'high'
  linkedViewpointIds: string[]
  status?: 'grounding' | 'experimenting' | 'resolved' | 'archived'
  evidenceFocus?: string[]
  nextAction?: string
}

export interface Confusion extends BaseRecord {
  feeling: string
  possibleScenes: BusinessScene[]
  clarifiedProblemId?: string
}

export interface CognitiveSeed extends BaseRecord {
  viewpointId: string
  understanding: string
  challengedOldModel: string
  coreVariables: string[]
  possibleScenes: BusinessScene[]
  risks: string[]
  boundaries: string[]
  futureTriggers: string[]
  status: 'waiting' | 'triggered' | 'matched' | 'archived'
}

export interface ObservationTask extends BaseRecord {
  viewpointId: string
  topic: string
  period: string
  startDate: string
  dueDate: string
  target: string
  questions: string[]
  status: 'open' | 'converted' | 'closed'
}

export interface ArchivedTrainingResult extends BaseRecord {
  viewpointId: string
  originalText: string
  understanding: string
  reason: string
  status: 'archived'
}

export interface TrainingResult extends BaseRecord {
  viewpointId: string
  relationLevel: RelationLevel
  scenes?: BusinessScene[]
  aiScenes?: Partial<Record<BusinessScene, AiSceneDraft>>
  outcome: TrainingOutcome
  targetKind: ResultTargetKind
  targetId: string
  status: 'problem-grounding' | 'observing' | 'waiting-trigger' | 'archived'
  statusLabel: string
}

export interface TrainingSession extends BaseRecord {
  viewpointId?: string
  resultId?: string
  steps: TrainingStep[]
  relationLevel?: RelationLevel
  outcome?: TrainingOutcome
}

export interface TrainingStep {
  key: 'input' | 'understanding' | 'old-model' | 'scene-scan' | 'relation' | 'settle'
  title: string
  status: 'empty' | 'active' | 'done'
}

export interface MatchCandidate {
  id: string
  viewpointId: string
  targetId: string
  targetKind: Exclude<PoolKind, 'viewpoint'>
  reason: string
  evidence: string[]
  suggestedPath: string
  score: number
}

export interface ScoreSnapshot {
  id: string
  viewpointId: string
  resultId: string
  date: string
  understanding: number
  oldModelAwareness: number
  sceneScan: number
  problemReframe: number
  abstraction: number
  systemSettlement: number
}

export interface ScoreSummary {
  title: string
  score: number
  max: number
  level: string
  dimensions: Array<{
    label: string
    value: number
    note: string
    reason: string
    deduction: string
  }>
}

export interface WeeklyReview {
  trainedCount: number
  matchedCount: number
  seededCount: number
  observationCount: number
  enterpriseLandingCount: number
  reviewText: string
  nextFocus: string[]
}

export interface TriggerReminder extends BaseRecord {
  sourceKind: 'cognitive-seed' | 'observation-task' | 'problem'
  sourceId: string
  trigger: string
  nextCheckAt: string
  status: 'waiting' | 'due' | 'done'
}

export const businessSceneLabels: Record<BusinessScene, string> = {
  sales: '销售',
  customer: '客户',
  product: '产品',
  quality: '品质',
  inventory: '库存',
  'supply-chain': '供应链',
  employee: '员工',
  'digital-ai': '数字化和 AI',
}

export const relationLabels: Record<RelationLevel, string> = {
  strong: '强关联',
  weak: '弱关联',
  temporary: '暂不相关',
  'no-value': '无价值',
}
