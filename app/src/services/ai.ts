import { useLiveQuery } from 'dexie-react-hooks'
import { cacheKey, extractJson, sanitizeAi, usageSummary, utcDayStart, type AiSettings, type AiUsageRow, type AiUsageSummary } from '../core/ai'
import { db, type VocabDatabase } from '../db/db'
import { repo } from '../db/repo'
import { PROFILE_ID } from '../db/types'
import { getAuth } from './auth'
import { getSupabase } from './supabase'

/**
 * Gọi trợ lý AI (R8) qua /api/ai của Worker (Cloudflare Workers AI, gói miễn phí). Mỗi câu trả lời được lưu trên máy:
 * cùng câu hỏi thì dùng lại, không gọi lại. Mỗi lượt ghi vào bảng lượt dùng (R8.8); quá giới hạn mỗi ngày thì dừng.
 */

export type AiErrorCode = 'disabled' | 'signed_out' | 'offline' | 'limit' | 'quota' | 'unavailable' | 'bad_output'

export class AiError extends Error {
  readonly code: AiErrorCode
  constructor(code: AiErrorCode) {
    super(code)
    this.code = code
  }
}

export const AI_ERROR_TEXT: Record<AiErrorCode, string> = {
  disabled: 'Trợ lý AI đang tắt. Bật ở Cá nhân → Trợ lý AI.',
  signed_out: 'Cần đăng nhập để dùng trợ lý AI.',
  offline: 'Đang mất mạng. Trợ lý AI cần có mạng.',
  limit: 'Đã đến giới hạn lượt hỏi AI hôm nay trên máy này. Đổi giới hạn ở Cá nhân → Trợ lý AI.',
  quota: 'Đã dùng hết hạn mức miễn phí của Cloudflare hôm nay. Hạn mức đặt lại lúc 7:00 sáng.',
  unavailable: 'Trợ lý AI đang trục trặc. Thử lại sau ít phút.',
  bad_output: 'AI trả lời không đúng khuôn. Thử lại, hoặc chọn model khác.',
}

export interface AskOptions {
  /** Tên tác vụ (ghi vào lượt dùng, phân biệt kết quả đã lưu). */
  task: string
  system: string
  prompt?: string
  messages?: { role: 'user' | 'assistant'; content: string }[]
  schema?: Record<string, unknown>
  maxTokens?: number
  /** false: luôn hỏi lại (ví dụ hội thoại). */
  useCache?: boolean
}

export interface AskResult {
  text: string
  cached: boolean
  neurons: number
  ms: number
}

export interface AiDeps {
  database: VocabDatabase
  fetch: typeof fetch
  token: () => Promise<string | null>
  settings: () => Promise<AiSettings>
  online: () => boolean
  now: () => number
}

async function profileAi(database: VocabDatabase): Promise<AiSettings> {
  return sanitizeAi((await database.profiles.get(PROFILE_ID))?.ai)
}

const defaults: AiDeps = {
  database: db,
  fetch: (...args) => fetch(...args),
  token: async () => {
    if (getAuth().status !== 'signed_in') return null
    const client = await getSupabase()
    return (await client?.auth.getSession())?.data.session?.access_token ?? null
  },
  settings: () => profileAi(db),
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  now: Date.now,
}

async function record(d: AiDeps, row: Omit<AiUsageRow, 'id' | 'at'>, at: number) {
  await d.database.aiUsage.put({ id: crypto.randomUUID(), at, ...row })
}

export async function askAI(opts: AskOptions, deps: Partial<AiDeps> = {}): Promise<AskResult> {
  const d = { ...defaults, ...deps }
  const settings = await d.settings()
  if (!settings.enabled) throw new AiError('disabled')
  const content = JSON.stringify([opts.system, opts.prompt ?? opts.messages, opts.schema ?? null])
  const key = await cacheKey(opts.task, settings.model, content)
  const start = d.now()
  if (opts.useCache !== false) {
    const hit = await d.database.aiCache.get(key)
    if (hit) {
      await record(d, { task: opts.task, model: settings.model, inputTokens: 0, outputTokens: 0, neurons: 0, cached: true }, start)
      return { text: hit.text, cached: true, neurons: 0, ms: 0 }
    }
  }
  if (!d.online()) throw new AiError('offline')
  const used = await d.database.aiUsage.where('at').aboveOrEqual(utcDayStart(start)).filter((r) => !r.cached && !r.error).count()
  if (used >= settings.dailyLimit) throw new AiError('limit')
  const token = await d.token()
  if (!token) throw new AiError('signed_out')

  let res: Response
  try {
    res = await d.fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: settings.model, system: opts.system, prompt: opts.prompt, messages: opts.messages, schema: opts.schema, maxTokens: opts.maxTokens }),
    })
  } catch {
    throw new AiError(d.online() ? 'unavailable' : 'offline')
  }
  const fail = async (code: AiErrorCode) => {
    await record(d, { task: opts.task, model: settings.model, inputTokens: 0, outputTokens: 0, neurons: 0, cached: false, error: code }, start)
    return new AiError(code)
  }
  if (res.status === 401) throw await fail('signed_out')
  if (res.status === 429) throw await fail('quota')
  if (!res.ok) {
    // Model nghĩ quá lâu mà chưa kịp trả lời (Worker báo "empty"): thử lại hoặc đổi model.
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw await fail(err.error === 'empty' ? 'bad_output' : 'unavailable')
  }
  const body = (await res.json()) as { text?: string; usage?: { inputTokens?: number; outputTokens?: number; neurons?: number } }
  if (!body.text) throw await fail('unavailable')
  const usage = body.usage ?? {}
  await record(d, { task: opts.task, model: settings.model, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, neurons: usage.neurons ?? 0, cached: false }, start)
  if (opts.useCache !== false) await d.database.aiCache.put({ key, task: opts.task, model: settings.model, text: body.text, createdAt: start })
  return { text: body.text, cached: false, neurons: usage.neurons ?? 0, ms: d.now() - start }
}

/**
 * Hỏi và đọc JSON theo khuôn: `parse` kiểm câu trả lời, không dùng được thì trả null. Câu trả lời hỏng không được
 * giữ lại để lần sau hỏi lại được.
 */
export async function askJson<T>(opts: AskOptions, parse: (raw: unknown) => T | null, deps: Partial<AiDeps> = {}): Promise<{ data: T } & Omit<AskResult, 'text'>> {
  const d = { ...defaults, ...deps }
  const res = await askAI(opts, d)
  const data = parse(extractJson(res.text))
  if (data === null) {
    const settings = await d.settings()
    await d.database.aiCache.delete(await cacheKey(opts.task, settings.model, JSON.stringify([opts.system, opts.prompt ?? opts.messages, opts.schema ?? null])))
    throw new AiError('bad_output')
  }
  return { data, cached: res.cached, neurons: res.neurons, ms: res.ms }
}

export interface SpeechResult {
  text: string
  /** Xác suất cao nhất là không có tiếng nói (0–1). */
  noSpeech: number
  duration: number
}

/**
 * Nhận dạng giọng nói để chấm phát âm (R7.3): gửi bản ghi WAV (base64) tới /api/stt (Whisper trên Workers AI, khoảng
 * 47 neuron mỗi phút âm thanh). Cùng điều kiện như hỏi AI: bật trợ lý, có mạng, đăng nhập, chưa quá giới hạn ngày.
 */
export async function transcribe(audio: string, deps: Partial<AiDeps> = {}): Promise<SpeechResult> {
  const d = { ...defaults, ...deps }
  const settings = await d.settings()
  if (!settings.enabled) throw new AiError('disabled')
  if (!d.online()) throw new AiError('offline')
  const start = d.now()
  const used = await d.database.aiUsage.where('at').aboveOrEqual(utcDayStart(start)).filter((r) => !r.cached && !r.error).count()
  if (used >= settings.dailyLimit) throw new AiError('limit')
  const token = await d.token()
  if (!token) throw new AiError('signed_out')
  let res: Response
  try {
    res = await d.fetch('/api/stt', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ audio }) })
  } catch {
    throw new AiError(d.online() ? 'unavailable' : 'offline')
  }
  const row = { task: 'pronounce', model: 'whisper-large-v3-turbo', inputTokens: 0, outputTokens: 0, cached: false }
  const fail = async (code: AiErrorCode) => {
    await record(d, { ...row, neurons: 0, error: code }, start)
    return new AiError(code)
  }
  if (res.status === 401) throw await fail('signed_out')
  if (res.status === 429) throw await fail('quota')
  if (!res.ok) throw await fail('unavailable')
  const body = (await res.json()) as Partial<SpeechResult> & { neurons?: number }
  await record(d, { ...row, neurons: body.neurons ?? 0 }, start)
  return { text: typeof body.text === 'string' ? body.text : '', noSpeech: body.noSpeech ?? 0, duration: body.duration ?? 0 }
}

/**
 * Kết quả đã lưu trên máy của một câu hỏi, không gọi AI và không tính lượt: để mở lại trang là thấy ngay kết quả lần
 * trước. Chưa hỏi bao giờ, AI đang tắt hoặc kết quả không đọc được thì null.
 */
export async function peekJson<T>(opts: AskOptions, parse: (raw: unknown) => T | null, deps: Partial<AiDeps> = {}): Promise<T | null> {
  const d = { ...defaults, ...deps }
  const settings = await d.settings()
  if (!settings.enabled) return null
  const hit = await d.database.aiCache.get(await cacheKey(opts.task, settings.model, JSON.stringify([opts.system, opts.prompt ?? opts.messages, opts.schema ?? null])))
  return hit ? parse(extractJson(hit.text)) : null
}

let settingsQueue: Promise<unknown> = Promise.resolve()

/** Đổi cài đặt AI: các lần đổi chạy lần lượt, mỗi lần đọc bản mới nhất rồi gộp, nên bấm liền nhau không ghi đè nhau. */
export function setAiSettings(patch: Partial<AiSettings>, database: VocabDatabase = db): Promise<void> {
  const next = settingsQueue.then(async () => {
    await repo.updateProfile({ ai: { ...(await profileAi(database)), ...patch } })
  })
  settingsQueue = next.catch(() => undefined)
  return next
}

export function useAiUsage(): AiUsageSummary | undefined {
  return useLiveQuery(async () => usageSummary(await db.aiUsage.where('at').aboveOrEqual(Date.now() - 31 * 86_400_000).toArray(), Date.now()), [])
}

export function useAiCacheCount(): number | undefined {
  return useLiveQuery(() => db.aiCache.count(), [])
}

export async function clearAiCache(): Promise<void> {
  await db.aiCache.clear()
}
