import type { AiTrainingDraft } from '../models/domain'

export interface PublicAiModel {
  name: string
  baseURL: string
  apiKeySet: boolean
  maskedKey: string
}

export interface PublicAiConfig {
  activeModel: string
  savedModels: PublicAiModel[]
}

export interface AiConfigInput {
  model: string
  apiKey?: string
  baseURL: string
}

export interface CognitionCardDraft {
  viewpoint: string
  supportText: string
  sourceTitle?: string
  sourceUrl?: string
  tags: string[]
  usedFallback?: boolean
}

export interface CognitionUrlDraft extends CognitionCardDraft {}

export interface CognitionTextDraft extends CognitionCardDraft {
  cards?: CognitionCardDraft[]
}

export interface TrainingDraftJob {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: number
  message: string
  heartbeatAt: string
  createdAt: string
  updatedAt: string
  draft?: AiTrainingDraft
  error?: string
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(String(data.error || data.message || 'AI 请求失败'))
  }
  return data as T
}

export async function getAiConfig() {
  return readResponse<PublicAiConfig>(await fetch('/api/ai/config'))
}

export async function saveAiConfig(input: AiConfigInput) {
  return readResponse<PublicAiConfig>(
    await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function testAiConfig() {
  return readResponse<{ ok: boolean; model: string; text: string }>(await fetch('/api/ai/test'))
}

export async function generateViewpoint() {
  return readResponse<{ viewpoint: string }>(
    await fetch('/api/ai/viewpoint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  )
}

export async function generateTrainingDraft(viewpoint: string) {
  return readResponse<AiTrainingDraft>(
    await fetch('/api/ai/training-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewpoint }),
    }),
  )
}

export async function startTrainingDraftJob(viewpoint: string) {
  return readResponse<TrainingDraftJob>(
    await fetch('/api/ai/training-draft-jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewpoint }),
    }),
  )
}

export async function getTrainingDraftJob(jobId: string) {
  return readResponse<TrainingDraftJob>(await fetch(`/api/ai/training-draft-jobs/${encodeURIComponent(jobId)}`))
}

export async function parseCognitionUrl(url: string) {
  return readResponse<CognitionUrlDraft>(
    await fetch('/api/ai/cognition-from-url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}

export async function parseCognitionText(text: string) {
  return readResponse<CognitionTextDraft>(
    await fetch('/api/ai/cognition-from-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  )
}
