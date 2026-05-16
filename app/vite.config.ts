import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

const appConfigFile = path.resolve(__dirname, 'ai-config.json')
const xuexiConfigFile = 'C:\\Users\\20427\\Documents\\000\\xuexi\\config.json'
const defaultModel = 'claude-sonnet-4-6'
const defaultBaseURL = 'https://api.anthropic.com'
const encPrefix = 'enc:'
const encKey = crypto.scryptSync('xuexi-local-config', 'fangda-silk', 32)

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
  relation: 'strong' | 'weak' | 'temporary' | 'no-value'
  reason: string
}

interface AiTrainingDraft {
  understanding: string
  causalChain: string
  oldModel: string
  boundary: string
  coreVariables: string[]
  scenes: Record<string, SceneDraft>
  finalRelation: 'strong' | 'weak' | 'temporary' | 'no-value'
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
  const saved = models.find((item) => item.name === model) || models[0]
  return {
    model,
    apiKey: String(override.apiKey || (saved ? decryptKey(saved.apiKey) : '') || '').trim(),
    baseURL: String(override.baseURL || saved?.baseURL || defaultBaseURL).trim(),
  }
}

function publicConfig() {
  const config = readConfigFile()
  return {
    activeModel: config.activeModel || defaultModel,
    savedModels: (config.savedModels || []).map((item) => {
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

function saveModelConfig(input: Partial<ActiveConfig>) {
  const config = readConfigFile()
  const models = config.savedModels || []
  const model = String(input.model || '').trim()
  if (!model) throw new Error('模型名称不能为空')
  let baseURL = String(input.baseURL || '').trim() || defaultBaseURL
  if (baseURL && !/^https?:\/\//i.test(baseURL)) baseURL = `https://${baseURL}`
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

async function callAi(system: string, user: string, options: { maxTokens?: number } = {}) {
  const cfg = resolveActiveConfig()
  if (!cfg.apiKey) throw new Error(`API Key 未设置：${cfg.model}`)

  if (isClaude(cfg.model)) {
    const response = await fetch(`${cfg.baseURL.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
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
    })
    if (!response.ok) throw new Error(await response.text())
    const json: any = await response.json()
    return String(json.content?.[0]?.text || '')
  }

  const response = await fetch(`${normalizeOpenAIBaseURL(cfg.baseURL)}/chat/completions`, {
    method: 'POST',
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
  if (relation === 'strong' || relation === 'weak' || relation === 'temporary' || relation === 'no-value') {
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
      '分流规则：strong 进入问题落地卡，weak 进入观察任务卡，temporary 进入认知种子卡，no-value 归档。',
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
          sales: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          customer: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          product: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          quality: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          inventory: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          'supply-chain': { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          employee: { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
          'digital-ai': { relation: 'strong|weak|temporary|no-value', reason: '判断理由' },
        },
        finalRelation: 'strong|weak|temporary|no-value',
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
        archiveReason: '无价值时生成',
      },
    }, null, 2),
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

  server.middlewares.use('/api/ai/test', async (_req: IncomingMessage, res: ServerResponse) => {
    try {
      const text = await callAi('你是连接测试助手，只回复 OK。', '回复 OK', { maxTokens: 16 })
      return sendJson(res, 200, { ok: true, text: text.slice(0, 40), model: resolveActiveConfig().model })
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  server.middlewares.use('/api/ai/training-draft', async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' })
      const body = await readJsonBody(req)
      const viewpoint = String(body.viewpoint || '').trim()
      if (!viewpoint) return sendJson(res, 400, { error: '观点不能为空' })
      const prompt = buildTrainingPrompt(viewpoint)
      const text = await callAi(prompt.system, prompt.user, { maxTokens: 3000 })
      return sendJson(res, 200, normalizeDraft(extractJson(text)))
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
