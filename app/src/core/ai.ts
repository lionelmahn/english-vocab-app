import type { PartOfSpeech } from './pos'

/**
 * Trợ lý AI (R8) — phần thuần: model được chọn, cài đặt, đọc JSON từ câu trả lời, thống kê lượt dùng (R8.8) và lời
 * nhắc cho từng tác vụ. Lời gọi thật nằm ở services/ai.ts (qua /api/ai của Worker, Cloudflare Workers AI miễn phí).
 */

/** Phải khớp danh sách MODELS trong worker/index.ts. */
export const AI_MODELS = [
  { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', note: 'Đúng nghĩa và tiếng Việt tự nhiên nhất khi thử 20 từ; chậm hơn (khoảng 8 giây), mỗi lượt khoảng 55 neuron' },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', note: 'Nhanh gấp đôi, khoảng 33 neuron mỗi lượt; khi thử sai nghĩa khoảng 5/20 từ' },
  { id: 'llama-4-scout', label: 'Llama 4 Scout', note: 'Nhanh, ít neuron nhất (khoảng 18 mỗi lượt); khi thử sai nghĩa khoảng 5/20 từ' },
] as const

export type AiModelId = (typeof AI_MODELS)[number]['id']

/** Hạn mức miễn phí của Cloudflare Workers AI cho cả tài khoản, đặt lại lúc 0:00 UTC (7:00 sáng giờ Việt Nam). */
export const FREE_NEURONS_PER_DAY = 10_000
export const DAILY_LIMITS = [30, 100, 200] as const

export interface AiSettings {
  enabled: boolean
  model: AiModelId
  /** Số lượt hỏi AI tối đa mỗi ngày trên máy này (không tính lượt lấy lại kết quả đã lưu). */
  dailyLimit: number
}

export const AI_DEFAULTS: AiSettings = { enabled: true, model: 'gpt-oss-120b', dailyLimit: 100 }

export function sanitizeAi(raw: unknown, base: AiSettings = AI_DEFAULTS): AiSettings {
  if (!raw || typeof raw !== 'object') return { ...base }
  const r = raw as Record<string, unknown>
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    model: AI_MODELS.some((m) => m.id === r.model) ? (r.model as AiModelId) : base.model,
    dailyLimit: typeof r.dailyLimit === 'number' && Number.isFinite(r.dailyLimit) ? Math.min(1000, Math.max(1, Math.round(r.dailyLimit))) : base.dailyLimit,
  }
}

/** Đối tượng JSON đầu tiên trong câu trả lời (bỏ phần suy nghĩ, khối markdown, chữ thừa trước/sau). */
export function extractJson(text: string): unknown {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(t.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Khóa lưu kết quả: cùng tác vụ, model và nội dung hỏi thì dùng lại câu trả lời cũ. */
export async function cacheKey(task: string, model: string, content: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${task}\n${model}\n${content}`)))
  return `${task}:${[...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

// ---- Lượt dùng (R8.8) -------------------------------------------------------------------------

export interface AiUsageRow {
  id: string
  at: number
  task: string
  model: string
  inputTokens: number
  outputTokens: number
  neurons: number
  /** Lấy lại từ kết quả đã lưu, không gọi AI. */
  cached: boolean
  error?: string
}

/** Đầu ngày theo UTC: hạn mức miễn phí của Workers AI đặt lại lúc này. */
export function utcDayStart(now: number): number {
  return Math.floor(now / 86_400_000) * 86_400_000
}

export interface AiUsageSummary {
  todayRequests: number
  todayNeurons: number
  monthRequests: number
  monthNeurons: number
  monthCached: number
  monthErrors: number
}

/** Lượt gọi AI thật (không tính lượt lấy lại kết quả đã lưu và lượt lỗi) hôm nay và 30 ngày qua. */
export function usageSummary(rows: readonly AiUsageRow[], now: number): AiUsageSummary {
  const today = utcDayStart(now)
  const month = now - 30 * 86_400_000
  const out: AiUsageSummary = { todayRequests: 0, todayNeurons: 0, monthRequests: 0, monthNeurons: 0, monthCached: 0, monthErrors: 0 }
  for (const r of rows) {
    if (r.at < month) continue
    if (r.error) {
      out.monthErrors++
      continue
    }
    if (r.cached) {
      out.monthCached++
      continue
    }
    out.monthRequests++
    out.monthNeurons += r.neurons
    if (r.at >= today) {
      out.todayRequests++
      out.todayNeurons += r.neurons
    }
  }
  out.todayNeurons = Math.round(out.todayNeurons)
  out.monthNeurons = Math.round(out.monthNeurons)
  return out
}

// ---- Gợi ý thông tin từ (R8.1) và mẹo nhớ (R8.4) ------------------------------------------------

export interface WordSense {
  pos: PartOfSpeech
  meaningVi: string
  exampleEn: string
  exampleVi: string
}

export interface WordInfo {
  term: string
  senses: WordSense[]
  mnemonicVi: string
}

const POS_MAP: Record<string, PartOfSpeech> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  phrasal_verb: 'phrasal_verb',
  'phrasal verb': 'phrasal_verb',
  phrase: 'phrase',
  idiom: 'idiom',
  preposition: 'preposition',
  pronoun: 'pronoun',
  conjunction: 'conjunction',
  interjection: 'interjection',
  other: 'other',
}

export const WORD_INFO_SYSTEM = `Bạn là trợ lý từ điển Anh–Việt cho người Việt đang học từ vựng tiếng Anh.
Với từ hoặc cụm từ tiếng Anh được hỏi, trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"term": string, "senses": [{"pos": "noun"|"verb"|"adjective"|"adverb"|"phrasal_verb"|"phrase"|"other", "meaning_vi": string, "example_en": string, "example_vi": string}], "mnemonic_vi": string}
Quy tắc:
- senses: 1 đến 3 nghĩa thông dụng nhất, nghĩa phổ biến nhất trước; mỗi loại từ khác nhau là một nghĩa riêng.
- meaning_vi: nghĩa tiếng Việt ngắn gọn, tự nhiên (tối đa 8 chữ), như trong từ điển Anh–Việt.
- example_en: câu ví dụ ngắn (tối đa 15 từ), tự nhiên, có chứa đúng từ được hỏi.
- example_vi: bản dịch tiếng Việt tự nhiên của câu ví dụ.
- mnemonic_vi: một mẹo nhớ ngắn bằng tiếng Việt cho nghĩa đầu tiên (liên tưởng âm hoặc hình ảnh).`

export const WORD_INFO_SCHEMA = {
  type: 'object',
  properties: {
    term: { type: 'string' },
    senses: {
      type: 'array',
      items: {
        type: 'object',
        properties: { pos: { type: 'string' }, meaning_vi: { type: 'string' }, example_en: { type: 'string' }, example_vi: { type: 'string' } },
        required: ['pos', 'meaning_vi', 'example_en', 'example_vi'],
      },
    },
    mnemonic_vi: { type: 'string' },
  },
  required: ['term', 'senses', 'mnemonic_vi'],
} as const

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

/** Kiểm và chuẩn hóa câu trả lời gợi ý thông tin từ; bỏ nghĩa thiếu phần bắt buộc. Không dùng được thì null. */
export function toWordInfo(raw: unknown, term: string): WordInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const senses: WordSense[] = []
  for (const s of Array.isArray(r.senses) ? r.senses.slice(0, 3) : []) {
    const x = (s ?? {}) as Record<string, unknown>
    const meaningVi = str(x.meaning_vi, 120)
    const exampleEn = str(x.example_en, 300)
    if (!meaningVi) continue
    senses.push({
      pos: POS_MAP[String(x.pos ?? '').toLowerCase().trim()] ?? 'other',
      meaningVi,
      exampleEn,
      exampleVi: exampleEn ? str(x.example_vi, 300) : '',
    })
  }
  if (senses.length === 0) return null
  return { term: str(r.term, 200) || term, senses, mnemonicVi: str(r.mnemonic_vi, 300) }
}
