import { projectKeys, verifySupabaseJwt } from './auth'

/**
 * Worker của app: phục vụ file tĩnh (qua ASSETS) và một cửa duy nhất cho trợ lý AI (R8): POST /api/ai.
 * Mặc định dùng Cloudflare Workers AI theo gói miễn phí (10.000 neuron/ngày cho cả tài khoản); tài khoản miễn phí
 * vượt hạn mức thì yêu cầu báo lỗi, không phát sinh tiền. Chỉ người đã đăng nhập vào app (phiên Supabase) gọi được.
 */

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}
interface AssetsBinding {
  fetch(request: Request): Promise<Response>
}
export interface Env {
  AI: AiBinding
  ASSETS: AssetsBinding
  SUPABASE_URL: string
}

/** Model được phép gọi (tên ngắn → mã trên Workers AI). `json`: hỗ trợ JSON mode theo khuôn. */
export const MODELS: Record<string, { id: string; json?: boolean; reasoning?: boolean }> = {
  'gpt-oss-120b': { id: '@cf/openai/gpt-oss-120b', reasoning: true },
  'llama-3.3-70b': { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', json: true },
  'llama-4-scout': { id: '@cf/meta/llama-4-scout-17b-16e-instruct' },
}

export const LIMITS = { text: 6000, schema: 4000, turns: 24, maxTokens: 2000 } as const

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AiRequest {
  model: string
  system: string
  /** Một câu hỏi, hoặc cả cuộc hội thoại (`messages`). */
  prompt?: string
  messages?: ChatTurn[]
  /** Khuôn JSON (JSON Schema) mong muốn; model có JSON mode thì ép theo khuôn. */
  schema?: Record<string, unknown>
  maxTokens?: number
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  neurons: number
}

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max

/** Kiểm tra yêu cầu; trả về chuỗi lỗi nếu không hợp lệ. */
export function parseRequest(body: unknown): AiRequest | string {
  if (!body || typeof body !== 'object') return 'body'
  const b = body as Record<string, unknown>
  if (typeof b.model !== 'string' || !MODELS[b.model]) return 'model'
  if (!isText(b.system, LIMITS.text)) return 'system'
  let messages: ChatTurn[] | undefined
  if (b.messages !== undefined) {
    if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > LIMITS.turns) return 'messages'
    messages = []
    for (const m of b.messages as unknown[]) {
      const t = m as Record<string, unknown>
      if ((t?.role !== 'user' && t?.role !== 'assistant') || !isText(t.content, LIMITS.text)) return 'messages'
      messages.push({ role: t.role, content: t.content })
    }
    if (messages[messages.length - 1].role !== 'user') return 'messages'
  } else if (!isText(b.prompt, LIMITS.text)) return 'prompt'
  let schema: Record<string, unknown> | undefined
  if (b.schema !== undefined) {
    if (!b.schema || typeof b.schema !== 'object' || JSON.stringify(b.schema).length > LIMITS.schema) return 'schema'
    schema = b.schema as Record<string, unknown>
  }
  const maxTokens = typeof b.maxTokens === 'number' ? Math.min(LIMITS.maxTokens, Math.max(64, Math.round(b.maxTokens))) : 1000
  return { model: b.model, system: b.system as string, prompt: messages ? undefined : (b.prompt as string), messages, schema, maxTokens }
}

/** Chữ trả lời trong các kiểu kết quả khác nhau của Workers AI; bỏ phần suy nghĩ <think>…</think>. */
export function textOf(raw: unknown): string | null {
  const r = raw as Record<string, unknown> | null
  let text: string | null = null
  if (typeof r?.response === 'string') text = r.response
  else if (r?.response && typeof r.response === 'object') text = JSON.stringify(r.response)
  else {
    const choice = (r?.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content
    if (typeof choice === 'string') text = choice
    else if (Array.isArray(r?.output)) {
      text = (r.output as { type?: string; content?: { text?: string }[] }[])
        .filter((o) => o.type === 'message')
        .flatMap((o) => o.content ?? [])
        .map((c) => c.text ?? '')
        .join('')
    }
  }
  if (text === null) return null
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

export function usageOf(raw: unknown): AiUsage {
  const u = ((raw as Record<string, unknown> | null)?.usage ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return { inputTokens: num(u.prompt_tokens), outputTokens: num(u.completion_tokens), neurons: Math.round(num(u.neurons) * 100) / 100 }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export async function handleAi(request: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'unauthorized' }, 401)
  let auth
  try {
    const issuer = `${env.SUPABASE_URL}/auth/v1`
    auth = await verifySupabaseJwt(token, await projectKeys(env.SUPABASE_URL, fetcher), issuer)
    // Khóa chưa có trong bộ nhớ đệm (Supabase vừa đổi khóa): tải lại danh sách khóa một lần.
    if (!auth.ok && auth.reason === 'unknown_key') auth = await verifySupabaseJwt(token, await projectKeys(env.SUPABASE_URL, fetcher, true), issuer)
  } catch {
    return json({ error: 'auth_unavailable' }, 503)
  }
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason }, 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_request', field: 'body' }, 400)
  }
  const req = parseRequest(body)
  if (typeof req === 'string') return json({ error: 'bad_request', field: req }, 400)

  const model = MODELS[req.model]
  const input: Record<string, unknown> = {
    messages: [{ role: 'system', content: req.system }, ...(req.messages ?? [{ role: 'user', content: req.prompt! }])],
    max_tokens: req.maxTokens,
    temperature: 0.3,
  }
  if (req.schema && model.json) input.response_format = { type: 'json_schema', json_schema: req.schema }
  if (model.reasoning) input.reasoning = { effort: 'low' }

  let raw: unknown
  try {
    raw = await env.AI.run(model.id, input)
  } catch (e) {
    const message = String((e as Error)?.message ?? e)
    if (/4006|free allocation|neurons/i.test(message)) return json({ error: 'quota' }, 429)
    if (/5018|not allowed/i.test(message)) return json({ error: 'model_unavailable' }, 502)
    return json({ error: 'upstream', detail: message.slice(0, 300) }, 502)
  }
  const text = textOf(raw)
  if (!text) return json({ error: 'empty' }, 502)
  return json({ text, model: req.model, usage: usageOf(raw) })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/ai') return handleAi(request, env)
    if (pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404)
    return env.ASSETS.fetch(request)
  },
}
