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

export async function generateTrainingDraft(viewpoint: string) {
  return readResponse<AiTrainingDraft>(
    await fetch('/api/ai/training-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ viewpoint }),
    }),
  )
}
