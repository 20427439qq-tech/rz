import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

const appConfigFile = path.resolve(__dirname, 'ai-config.json')
const xuexiConfigFile = 'C:\\Users\\20427\\Documents\\000\\xuexi\\config.json'
const defaultModel = 'claude-sonnet-4-6'
const defaultBaseURL = 'https://api.anthropic.com'
const encPrefix = 'enc:'
const encKey = crypto.scryptSync('xuexi-local-config', 'fangda-silk', 32)
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
const aiProxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

interface SavedModel {
  name: string
  apiKey: string
  baseURL: string
}

interface AiConfigFile {
  activeModel?: string
  savedModels?: SavedModel[]
}

interface ActiveConfig {
  model: string
  apiKey: string
  baseURL: string
}

interface SceneDraft {
  relation: 'strong' | 'weak' | 'temporary'
  reason: string
}

interface AiTrainingDraft {
  understanding: string
  causalChain: string
  oldModel: string
  boundary: string
  coreVariables: string[]
  scenes: Record<string, SceneDraft>
  finalRelation: 'strong' | 'weak' | 'temporary'
  problemCard?: {
    title: string
    description: string
    scene: string
    evidenceFocus: string[]
    nextAction: string
  }
  observationTaskCard?: {
    title: string
    topic: string
    period: string
    target: string
    questions: string[]
  }
  cognitiveSeedCard?: {
    title: string
    risks: string[]
    boundaries: string[]
    futureTriggers: string[]
  }
  archiveReason?: string
}

interface TrainingDraftJob {
  id: string
  viewpoint: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress: number
  message: string
  heartbeatAt: string
  createdAt: string
  updatedAt: string
  draft?: AiTrainingDraft
  error?: string
}

interface CognitionCardDraft {
  viewpoint: string
  supportText: string
  sourceTitle: string
  sourceUrl?: string
  tags: string[]
  usedFallback?: boolean
}

const sceneLabels: Record<string, string> = {
  sales: '销售',
  customer: '客户',
  product: '产品',
  quality: '品质',
  inventory: '库存',
  'supply-chain': '供应链',
  employee: '员工',
  'digital-ai': '数字化和 AI',
}

function encryptKey(plain: string) {
  if (!plain) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  let enc = cipher.update(plain, 'utf8', 'base64')
  enc += cipher.final('base64')
  return `${encPrefix}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc}`
}

function decryptKey(stored = '') {
  if (!stored.startsWith(encPrefix)) return stored
  try {
    const [ivB64, tagB64, encB64] = stored.slice(encPrefix.length).split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    let dec = decipher.update(encB64, 'base64', 'utf8')
    dec += decipher.final('utf8')
    return dec
  } catch {
    return ''
  }
}

function readConfigFile(): AiConfigFile {
  const file = fs.existsSync(appConfigFile) ? appConfigFile : xuexiConfigFile
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return { activeModel: defaultModel, savedModels: [] }
  }
}

function writeConfigFile(config: AiConfigFile) {
  fs.writeFileSync(appConfigFile, JSON.stringify(config, null, 2))
}

function resolveActiveConfig(override: Partial<ActiveConfig> = {}): ActiveConfig {
  const config = readConfigFile()
  const models = config.savedModels || []
  const model = String(override.model || config.activeModel || models[0]?.name || defaultModel).trim()
  const saved = models.find((item) => item.name === model) || (override.model ? undefined : models[0])
  return {
    model,
    apiKey: String(override.apiKey || (saved ? decryptKey(saved.apiKey) : '') || '').trim(),
    baseURL: String(override.baseURL || saved?.baseURL || defaultBaseURL).trim(),
  }
}

function publicConfig() {
  const config = readConfigFile()
  const savedModels = config.savedModels || []
  return {
    activeModel: config.activeModel || savedModels[0]?.name || defaultModel,
    savedModels: savedModels.map((item) => {
      const plain = decryptKey(item.apiKey)
      return {
        name: item.name,
        baseURL: item.baseURL,
        apiKeySet: Boolean(plain),
        maskedKey: plain ? `${plain.slice(0, 4)}...${plain.slice(-4)}` : '',
      }
    }),
  }
}

function normalizeBaseURL(input: string | undefined) {
  let baseURL = String(input || '').trim() || defaultBaseURL
  if (baseURL && !/^https?:\/\//i.test(baseURL)) baseURL = `https://${baseURL}`
  return baseURL
}

function saveModelConfig(input: Partial<ActiveConfig>) {
  const config = readConfigFile()
  const models = config.savedModels || []
  const model = String(input.model || '').trim()
  if (!model) throw new Error('模型名称不能为空')
  const baseURL = normalizeBaseURL(input.baseURL)
  const existingIndex = models.findIndex((item) => item.name === model)
  const existing = existingIndex >= 0 ? models[existingIndex] : undefined
  const apiKey = String(input.apiKey || '').trim()
  const entry: SavedModel = {
    name: model,
    baseURL,
    apiKey: apiKey ? encryptKey(apiKey) : existing?.apiKey || '',
  }
  if (existingIndex >= 0) models[existingIndex] = entry
  else models.push(entry)
  writeConfigFile({ activeModel: model, savedModels: models })
}

function isClaude(model: string) {
  return /^claude/i.test(model)
}

function normalizeOpenAIBaseURL(value: string) {
  let base = value || 'https://api.openai.com'
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  base = base.replace(/\/+$/, '')
  return /\/v1$/i.test(base) ? base : `${base}/v1`
}

function aiFetch(url: string, init: RequestInit) {
  if (!aiProxyAgent) return undiciFetch(url, init as any) as unknown as Promise<Response>
  return undiciFetch(url, {
    ...init,
    dispatcher: aiProxyAgent,
  } as any) as unknown as Promise<Response>
}

function explainFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error && error.cause instanceof Error ? `：${error.cause.message}` : ''
  return `AI 网络请求失败：${message}${cause}。请检查 Base URL、代理/VPN、上游服务是否可访问。`
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function callAi(
  system: string,
  user: string,
  options: { maxTokens?: number; timeoutMs?: number; override?: Partial<ActiveConfig> } = {},
) {
  const cfg = resolveActiveConfig(options.override)
  if (!cfg.apiKey) throw new Error(`API Key 未设置：${cfg.model}`)
  const signal = options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined

  if (isClaude(cfg.model)) {
    const response = await aiFetch(`${cfg.baseURL.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: options.maxTokens || 2600,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    }).catch((error) => {
      throw new Error(explainFetchError(error))
    })
    if (!response.ok) throw new Error(await response.text())
    const json: any = await response.json()
    return String(json.content?.[0]?.text || '')
  }

  if (/anthropic\.com/i.test(cfg.baseURL)) {
    throw new Error(`模型 ${cfg.model} 走 OpenAI 兼容接口，Base URL 不能使用 Anthropic 地址。请改成 OpenAI 兼容网关地址，例如 https://api.aicodewith.com。`)
  }

  const response = await aiFetch(`${normalizeOpenAIBaseURL(cfg.baseURL)}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: options.maxTokens || 2600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  }).catch((error) => {
    throw new Error(explainFetchError(error))
  })
  if (!response.ok) throw new Error(await response.text())
  const json: any = await response.json()
  return String(json.choices?.[0]?.message?.content || '')
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const raw = fenced || text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('AI 没有返回 JSON')
  return JSON.parse(raw.slice(start, end + 1))
}

function normalizeRelation(value: unknown): SceneDraft['relation'] {
  const relation = String(value || '').trim()
  if (relation === 'strong' || relation === 'weak' || relation === 'temporary') {
    return relation
  }
  return 'temporary'
}

function normalizeDraft(raw: any): AiTrainingDraft {
  const scenes: Record<string, SceneDraft> = {}
  for (const key of Object.keys(sceneLabels)) {
    const item = raw.scenes?.[key] || {}
    scenes[key] = {
      relation: normalizeRelation(item.relation),
      reason: String(item.reason || `${sceneLabels[key]}场景待继续观察。`).slice(0, 120),
    }
  }
  const strongCount = Object.values(scenes).filter((item) => item.relation === 'strong').length
  const weakCount = Object.values(scenes).filter((item) => item.relation === 'weak').length
  const finalRelation = normalizeRelation(raw.finalRelation || (strongCount ? 'strong' : weakCount ? 'weak' : 'temporary'))
  return {
    understanding: String(raw.understanding || '').trim(),
    causalChain: String(raw.causalChain || '').trim(),
    oldModel: String(raw.oldModel || '').trim(),
    boundary: String(raw.boundary || '').trim(),
    coreVariables: Array.isArray(raw.coreVariables) ? raw.coreVariables.map(String).filter(Boolean).slice(0, 8) : [],
    scenes,
    finalRelation,
    problemCard: raw.problemCard,
    observationTaskCard: raw.observationTaskCard,
    cognitiveSeedCard: raw.cognitiveSeedCard,
    archiveReason: String(raw.archiveReason || '').trim(),
  }
}

function buildTrainingPrompt(viewpoint: string) {
  return {
    system: [
      '你是企业经营认知训练助手。你的任务不是替用户做决策，而是把一句观点拆成可训练、可观察、可沉淀的内容。',
      '必须遵守产品脚手架：观点输入 -> 观点理解 -> 旧模型觉察 -> 企业场景扫描 -> 分流结果。',
      '分流规则：strong 进入问题落地卡，weak 进入观察任务卡，temporary 进入认知种子卡。',
      '只返回 JSON，不要 Markdown，不要解释。',
    ].join('\n'),
    user: JSON.stringify({
      viewpoint,
      scenes: sceneLabels,
      requiredJsonShape: {
        understanding: '用自己的话解释观点',
        causalChain: 'A 导致 B，B 导致 C 的因果链',
        oldModel: '识别这句话反对的旧模型或默认假设',
        boundary: '边界、反例或不适用条件',
        coreVariables: ['变量1', '变量2'],
        scenes: {
          sales: { relation: 'strong|weak|temporary', reason: '判断理由' },
          customer: { relation: 'strong|weak|temporary', reason: '判断理由' },
          product: { relation: 'strong|weak|temporary', reason: '判断理由' },
          quality: { relation: 'strong|weak|temporary', reason: '判断理由' },
          inventory: { relation: 'strong|weak|temporary', reason: '判断理由' },
          'supply-chain': { relation: 'strong|weak|temporary', reason: '判断理由' },
          employee: { relation: 'strong|weak|temporary', reason: '判断理由' },
          'digital-ai': { relation: 'strong|weak|temporary', reason: '判断理由' },
        },
        finalRelation: 'strong|weak|temporary',
        problemCard: {
          title: '强关联时生成',
          description: '问题描述',
          scene: 'sales',
          evidenceFocus: ['证据1', '证据2'],
          nextAction: '最小行动实验',
        },
        observationTaskCard: {
          title: '弱关联时生成',
          topic: '观察主题',
          period: '未来 7 天',
          target: '观察对象',
          questions: ['问题1', '问题2'],
        },
        cognitiveSeedCard: {
          title: '暂不相关时生成',
          risks: ['误用风险'],
          boundaries: ['使用边界'],
          futureTriggers: ['未来触发条件'],
        },
      },
    }, null, 2),
  }
}

function normalizeViewpoint(text: string) {
  try {
    const json = extractJson(text)
    return String(json.viewpoint || json.text || '').trim()
  } catch {
    return text
      .replace(/```(?:json)?/gi, '')
      .replace(/```/g, '')
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim()
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function pickMeta(html: string, pattern: RegExp) {
  return decodeHtmlEntities(html.match(pattern)?.[1] || '').trim()
}

function parseWebPage(html: string) {
  const title = pickMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
  const description =
    pickMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    pickMeta(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i) ||
    pickMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html
  const text = stripHtml(body).slice(0, 3600)
  return { title, description, text }
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 6)
}

function fallbackCognitionDraft(sourceUrl: string, page: { title: string; description: string; text: string }) {
  const supportText = page.description || page.text.slice(0, 280)
  return {
    viewpoint: (page.title || supportText).replace(/[。！？]$/, '').slice(0, 60) || '待提炼观点',
    supportText: supportText || '网页正文内容较少，需要手动补充支撑文字。',
    sourceTitle: page.title || new URL(sourceUrl).hostname,
    sourceUrl,
    tags: ['网页摘录'],
    usedFallback: true,
  }
}

function cleanSourceText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function fallbackCognitionTextDraft(sourceText: string) {
  const text = cleanSourceText(sourceText)
  const sentence = text.match(/[^。！？.!?]{10,90}[。！？.!?]?/)?.[0] || text.slice(0, 70)
  return {
    viewpoint: sentence.replace(/[。！？.!?]$/, '').slice(0, 90) || '待提炼观点',
    supportText: text.slice(0, 800) || '原料文字较少，需要手动补充支撑文字。',
    sourceTitle: '手动粘贴原料',
    tags: ['文本整理'],
    usedFallback: true,
  }
}

function fallbackCognitionTextCards(sourceText: string): CognitionCardDraft[] {
  const text = cleanSourceText(sourceText)
  const sentences = text
    .split(/(?<=[。！？.!?])\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 18)

  const chunks = sentences.length ? sentences : text.match(/.{40,180}/g) || [text]
  const cards = chunks.slice(0, 6).map((chunk, index) => {
    const viewpoint = chunk.replace(/[。！？.!?]$/, '').slice(0, 90) || `待提炼观点 ${index + 1}`
    const supportStart = Math.max(0, text.indexOf(chunk) - 60)
    const supportText = text.slice(supportStart, supportStart + 420) || chunk
    return {
      viewpoint,
      supportText,
      sourceTitle: '手动粘贴原料',
      tags: ['文本整理'],
      usedFallback: true,
    }
  })

  return cards.length ? cards : [fallbackCognitionTextDraft(sourceText)]
}

function normalizeCognitionDraft(raw: any, sourceUrl: string, page: { title: string; description: string; text: string }) {
  const fallback = fallbackCognitionDraft(sourceUrl, page)
  return {
    viewpoint: String(raw.viewpoint || fallback.viewpoint).trim().slice(0, 90),
    supportText: String(raw.supportText || fallback.supportText).trim().slice(0, 800),
    sourceTitle: String(raw.sourceTitle || page.title || fallback.sourceTitle).trim().slice(0, 80),
    sourceUrl,
    tags: normalizeTags(raw.tags).length ? normalizeTags(raw.tags) : fallback.tags,
    usedFallback: Boolean(raw.usedFallback),
  }
}

function normalizeCognitionCard(raw: any, fallback: CognitionCardDraft, index = 0, usedFallback = false): CognitionCardDraft {
  return {
    viewpoint: String(raw?.viewpoint || fallback.viewpoint || `待提炼观点 ${index + 1}`).trim().slice(0, 90),
    supportText: String(raw?.supportText || fallback.supportText || '').trim().slice(0, 800),
    sourceTitle: String(raw?.sourceTitle || fallback.sourceTitle || '手动粘贴原料').trim().slice(0, 80),
    sourceUrl: raw?.sourceUrl ? String(raw.sourceUrl).trim() : fallback.sourceUrl,
    tags: normalizeTags(raw?.tags).length ? normalizeTags(raw.tags) : fallback.tags,
    usedFallback: Boolean(raw?.usedFallback || usedFallback),
  }
}

function normalizeCognitionTextCards(raw: any, sourceText: string) {
  const fallbackCards = fallbackCognitionTextCards(sourceText)
  const rawCards = Array.isArray(raw?.cards)
    ? raw.cards
    : Array.isArray(raw?.viewpoints)
      ? raw.viewpoints
      : raw?.viewpoint
        ? [raw]
        : []
  const cards = rawCards
    .slice(0, 8)
    .map((item: any, index: number) => normalizeCognitionCard(item, fallbackCards[index] || fallbackCards[0], index, false))
    .filter((item: CognitionCardDraft) => item.viewpoint && item.supportText)

  const normalizedCards = cards.length
    ? cards
    : fallbackCards.map((item, index) => normalizeCognitionCard(undefined, item, index, true))
  const first = normalizedCards[0]
  return {
    ...first,
    cards: normalizedCards,
    usedFallback: normalizedCards.some((item: CognitionCardDraft) => item.usedFallback),
  }
}

function buildCognitionPrompt(page: { title: string; description: string; text: string }, sourceUrl: string) {
  return {
    system: [
      '你是认知原料整理助手。你的任务是从网页内容里提取一张可训练的认知原料卡。',
      '只提取一个最适合训练的中文观点，并保留一段能解释或支撑这个观点的原文语境。',
      '只返回 JSON，不要 Markdown，不要解释。',
    ].join('\n'),
    user: JSON.stringify({
      sourceUrl,
      title: page.title,
      description: page.description,
      text: page.text,
      requiredJsonShape: {
        viewpoint: '一句可训练的中文观点',
        supportText: '一段解释或支撑该观点的文字，120 到 300 字',
        sourceTitle: '来源标题',
        tags: ['标签1', '标签2'],
      },
    }, null, 2),
  }
}

function buildCognitionTextPrompt(sourceText: string) {
  return {
    system: [
      '你是认知原料整理助手。你的任务是从用户粘贴的大段文字里整理多张可训练的观点卡。',
      '每张卡只保留一个可训练的一句话观点，并保留一段能解释或支撑该观点的文字。支撑文字必须来自用户原料的真实含义，不要编造。',
      '通常整理 3 到 6 张，最多 8 张；如果原料只够一个观点，就返回 1 张。',
      '只返回 JSON，不要 Markdown，不要解释。',
    ].join('\n'),
    user: JSON.stringify({
      text: cleanSourceText(sourceText).slice(0, 9000),
      requiredJsonShape: {
        cards: [
          {
            viewpoint: '一句可训练的中文观点，不超过 90 字',
            supportText: '一段解释或支撑该观点的文字，120 到 350 字',
            sourceTitle: '手动粘贴原料',
            tags: ['标签1', '标签2'],
          },
        ],
      },
    }, null, 2),
  }
}

function buildViewpointPrompt() {
  return {
    system: [
      '你是企业经营认知训练助手。不要推理，不要解释。',
      '生成一句适合训练的中文经营观点。',
      '只返回 JSON。'
    ].join('\n'),
    user: JSON.stringify({
      requiredJsonShape: {
        viewpoint: '一句 20 到 35 字的中文经营观点',
      },
      instruction: '/no_think',
      examples: [
        'AI 不是替代思考，而是暴露组织对问题的理解深度。',
        '真正的数字化，是让真实经营状态被看见。',
        '客户不是一次订单，而是需要长期维护的资产。',
      ],
    }, null, 2),
  }
}

function resolveFastViewpointOverride() {
  const config = readConfigFile()
  const active = resolveActiveConfig().model
  const fallback = (config.savedModels || []).find((item) => {
    const name = String(item.name || '')
    return name !== active && /gpt|claude|gemini/i.test(name)
  })
  return fallback ? { model: fallback.name } : undefined
}

const trainingDraftJobs = new Map<string, TrainingDraftJob>()

function publicTrainingDraftJob(job: TrainingDraftJob) {
  const { viewpoint: _viewpoint, ...publicJob } = job
  return publicJob
}

function patchTrainingDraftJob(job: TrainingDraftJob, patch: Partial<TrainingDraftJob>) {
  Object.assign(job, patch, {
    heartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

function cleanupTrainingDraftJobs() {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, job] of trainingDraftJobs) {
    if (new Date(job.updatedAt).getTime() < cutoff) trainingDraftJobs.delete(id)
  }
}

async function runTrainingDraftJob(jobId: string) {
  const job = trainingDraftJobs.get(jobId)
  if (!job) return

  const heartbeat = setInterval(() => {
    const current = trainingDraftJobs.get(jobId)
    if (!current || current.status === 'done' || current.status === 'failed') return
    patchTrainingDraftJob(current, { message: current.message || 'AI 正在后台拆解' })
  }, 1200)

  try {
    patchTrainingDraftJob(job, { status: 'running', progress: 12, message: '后台任务已接管，正在组织提示词' })
    const prompt = buildTrainingPrompt(job.viewpoint)
    let text = ''
    try {
      patchTrainingDraftJob(job, { progress: 32, message: '正在调用当前 AI 模型' })
      text = await callAi(prompt.system, prompt.user, { maxTokens: 3000, timeoutMs: 90_000 })
    } catch (error) {
      const fallback = resolveFastViewpointOverride()
      if (!fallback) throw error
      patchTrainingDraftJob(job, { progress: 58, message: `当前模型未完成，切换 ${fallback.model} 继续后台拆解` })
      text = await callAi(prompt.system, prompt.user, { maxTokens: 3000, timeoutMs: 120_000, override: fallback })
    }
    patchTrainingDraftJob(job, { progress: 86, message: 'AI 已返回，正在校验训练结构' })
    const draft = normalizeDraft(extractJson(text))
    patchTrainingDraftJob(job, { status: 'done', progress: 100, message: 'AI 拆解完成，等待前端自动保存', draft })
  } catch (error) {
    patchTrainingDraftJob(job, {
      status: 'failed',
      progress: 100,
      message: 'AI 拆解失败',
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    clearInterval(heartbeat)
  }
}

function installAiMiddleware(server: { middlewares: { use: Function } }) {
  server.middlewares.use('/api/ai/config', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === 'GET') return sendJson(res, 200, publicConfig())
      if (req.method === 'POST') {
        saveModelConfig(await readJsonBody(req))
        return sendJson(res, 200, publicConfig())
      }
      return sendJson(res, 405, { error: 'method not allowed' })
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/test', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const body = await readJsonBody(req)
      const override = {
        model: String(body.model || '').trim(),
        apiKey: String(body.apiKey || '').trim(),
        baseURL: normalizeBaseURL(body.baseURL),
      }
      const text = await callAi('你是连接测试助手，只回复 OK。', '回复 OK', { maxTokens: 16, override })
      return sendJson(res, 200, { ok: true, text: text.slice(0, 40), model: resolveActiveConfig(override).model })
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/viewpoint', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const prompt = buildViewpointPrompt()
      let text = ''
      try {
        text = await callAi(prompt.system, prompt.user, { maxTokens: 160, timeoutMs: 30_000 })
      } catch (error) {
        const fallback = resolveFastViewpointOverride()
        if (!fallback) throw error
        text = await callAi(prompt.system, prompt.user, { maxTokens: 160, timeoutMs: 60_000, override: fallback })
      }
      const viewpoint = normalizeViewpoint(text)
      if (!viewpoint) return sendJson(res, 500, { error: 'AI 没有生成观点' })
      return sendJson(res, 200, { viewpoint })
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/training-draft', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const body = await readJsonBody(req)
      const viewpoint = String(body.viewpoint || '').trim()
      if (!viewpoint) return sendJson(res, 400, { error: '观点不能为空' })
      const prompt = buildTrainingPrompt(viewpoint)
      let text = ''
      try {
        text = await callAi(prompt.system, prompt.user, { maxTokens: 3000, timeoutMs: 90_000 })
      } catch (error) {
        const fallback = resolveFastViewpointOverride()
        if (!fallback) throw error
        text = await callAi(prompt.system, prompt.user, { maxTokens: 3000, timeoutMs: 120_000, override: fallback })
      }
      return sendJson(res, 200, normalizeDraft(extractJson(text)))
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/training-draft-jobs', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      cleanupTrainingDraftJobs()
      if (req.method === 'POST') {
        const body = await readJsonBody(req)
        const viewpoint = String(body.viewpoint || '').trim()
        if (!viewpoint) return sendJson(res, 400, { error: '观点不能为空' })
        const now = new Date().toISOString()
        const id = `draft-job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
        const job: TrainingDraftJob = {
          id,
          viewpoint,
          status: 'queued',
          progress: 5,
          message: '任务已进入后台队列',
          heartbeatAt: now,
          createdAt: now,
          updatedAt: now,
        }
        trainingDraftJobs.set(id, job)
        void runTrainingDraftJob(id)
        return sendJson(res, 202, publicTrainingDraftJob(job))
      }

      if (req.method === 'GET') {
        const id = String(req.url || '').replace(/^\/+/, '').split('?')[0]
        const job = trainingDraftJobs.get(id)
        if (!job) return sendJson(res, 404, { error: '后台任务不存在或已过期' })
        return sendJson(res, 200, publicTrainingDraftJob(job))
      }

      return sendJson(res, 405, { error: 'method not allowed' })
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/cognition-from-url', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const body = await readJsonBody(req)
      const sourceUrl = String(body.url || '').trim()
      let url: URL
      try {
        url = new URL(sourceUrl)
      } catch {
        return sendJson(res, 400, { error: '请输入有效网页地址' })
      }
      if (!/^https?:$/.test(url.protocol)) return sendJson(res, 400, { error: '只支持 http 或 https 网页地址' })

      const pageResponse = await aiFetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; RZ-CognitionImporter/1.0)',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      }).catch((error) => {
        throw new Error(explainFetchError(error))
      })
      if (!pageResponse.ok) throw new Error(`网页读取失败：HTTP ${pageResponse.status}`)

      const html = await pageResponse.text()
      const page = parseWebPage(html)
      if (!page.title && !page.text) throw new Error('网页内容为空，无法解析认知原料')

      try {
        const prompt = buildCognitionPrompt(page, url.toString())
        const text = await callAi(prompt.system, prompt.user, { maxTokens: 900, timeoutMs: 70_000 })
        return sendJson(res, 200, normalizeCognitionDraft(extractJson(text), url.toString(), page))
      } catch {
        return sendJson(res, 200, fallbackCognitionDraft(url.toString(), page))
      }
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/cognition-from-text', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const body = await readJsonBody(req)
      const sourceText = cleanSourceText(String(body.text || ''))
      if (sourceText.length < 20) return sendJson(res, 400, { error: '先粘贴一段认知原料，至少 20 个字' })

      try {
        const prompt = buildCognitionTextPrompt(sourceText)
        const text = await callAi(prompt.system, prompt.user, { maxTokens: 2200, timeoutMs: 90_000 })
        return sendJson(res, 200, normalizeCognitionTextCards(extractJson(text), sourceText))
      } catch {
        const cards = fallbackCognitionTextCards(sourceText)
        return sendJson(res, 200, { ...cards[0], cards, usedFallback: true })
      }
    } catch (error) {
      return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'local-ai-middleware',
      configureServer(server) {
        installAiMiddleware(server)
      },
      configurePreviewServer(server) {
        installAiMiddleware(server)
      },
    },
  ],
  server: {
    fs: {
      allow: ['..', 'C:\\Users\\20427\\Documents\\000\\xuexi'],
    },
  },
})
