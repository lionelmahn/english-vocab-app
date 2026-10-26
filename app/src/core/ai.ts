import type { PartOfSpeech } from './pos'
import { markWord, plainSentence, type Collocation, type CollocationKind, type ConfusableGroup, type ConfusableItem } from './reference'
import { termKey } from './vocab'

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

// ---- Nghĩa tiếng Việt cho các nghĩa tiếng Anh đã chọn khi tra từ (R8.1) ---------------------------

export interface SenseInput {
  partOfSpeech: PartOfSpeech
  definition: string
  example?: string
}

export interface SenseMeaning {
  meaningVi: string
  exampleVi: string
}

export const SENSE_MEANINGS_SYSTEM = `Bạn là trợ lý từ điển Anh–Việt cho người Việt học tiếng Anh.
Bạn nhận một từ tiếng Anh và danh sách các nghĩa tiếng Anh của nó (đánh số, có loại từ, có thể kèm câu ví dụ).
Trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"senses": [{"n": number, "meaning_vi": string, "example_vi": string}]}
Quy tắc:
- Mỗi nghĩa trong danh sách là một phần tử, giữ đúng số thứ tự n.
- meaning_vi: nghĩa tiếng Việt ngắn gọn (tối đa 8 chữ), đúng với nghĩa tiếng Anh đó, như trong từ điển Anh–Việt.
- example_vi: bản dịch tiếng Việt tự nhiên của câu ví dụ; nghĩa nào không có câu ví dụ thì để chuỗi rỗng.`

export function senseMeaningsPrompt(term: string, senses: readonly SenseInput[]): string {
  return [`Từ: "${term}"`, ...senses.map((s, i) => `${i + 1}. (${s.partOfSpeech}) ${s.definition}${s.example ? `\n   Ví dụ: ${s.example}` : ''}`)].join('\n')
}

/** Nghĩa tiếng Việt theo đúng thứ tự các nghĩa đã gửi; nghĩa thiếu thì để trống. Không có nghĩa nào thì null. */
export function toSenseMeanings(raw: unknown, count: number): SenseMeaning[] | null {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).senses) ? ((raw as Record<string, unknown>).senses as unknown[]) : null
  if (!list) return null
  const out: SenseMeaning[] = Array.from({ length: count }, () => ({ meaningVi: '', exampleVi: '' }))
  list.forEach((s, i) => {
    const x = (s ?? {}) as Record<string, unknown>
    const n = typeof x.n === 'number' && x.n >= 1 && x.n <= count ? x.n - 1 : i
    if (n >= count || out[n].meaningVi) return
    out[n] = { meaningVi: str(x.meaning_vi, 120), exampleVi: str(x.example_vi, 300) }
  })
  return out.some((m) => m.meaningVi) ? out : null
}

// ---- Mẹo nhớ (R8.4) ------------------------------------------------------------------------------

export type MnemonicKind = 'sound' | 'image' | 'parts'

export const MNEMONIC_KIND_LABEL: Record<MnemonicKind, string> = {
  sound: 'Theo âm',
  image: 'Hình ảnh',
  parts: 'Tách từ',
}

export interface Mnemonic {
  kind: MnemonicKind
  text: string
}

export const MNEMONIC_SYSTEM = `Bạn là giáo viên tiếng Anh giỏi tạo mẹo ghi nhớ từ vựng cho người Việt.
Với một từ tiếng Anh, loại từ và nghĩa tiếng Việt, đưa ra đúng 3 mẹo nhớ ngắn, mỗi kiểu một mẹo.
Trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"mnemonics": [{"type": "sound"|"image"|"parts", "text": string}]}
Ba kiểu:
- sound: cách đọc của từ nghe gần giống một cụm tiếng Việt, rồi nối cụm đó với nghĩa thành một câu dễ nhớ. Ví dụ: "lazy" đọc gần "lây dì" → "Lây dì tính lười, cả nhà cùng lười (lazy = lười)".
- image: một hình ảnh hoặc tình huống ngắn, cụ thể, gắn từ với nghĩa.
- parts: tách từ thành các phần quen thuộc (tiền tố, gốc từ, hậu tố, hoặc từ ngắn bên trong) và giải thích vì sao ra nghĩa đó.
Mỗi mẹo là một hoặc hai câu ngắn bằng tiếng Việt tự nhiên, có nhắc từ tiếng Anh và nghĩa; không cần đếm chữ. Không bịa nguồn gốc từ sai sự thật.`

export function mnemonicPrompt(term: string, partOfSpeech: PartOfSpeech, meaningVi: string, ipa?: string): string {
  return `Từ: "${term}" (${partOfSpeech})${ipa ? `, phát âm ${ipa}` : ''}\nNghĩa: ${meaningVi}`
}

const KINDS: readonly MnemonicKind[] = ['sound', 'image', 'parts']

export function toMnemonics(raw: unknown): Mnemonic[] | null {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).mnemonics) ? ((raw as Record<string, unknown>).mnemonics as unknown[]) : null
  if (!list) return null
  const out: Mnemonic[] = []
  for (const m of list.slice(0, 3)) {
    const x = (m ?? {}) as Record<string, unknown>
    const text = str(x.text, 300)
    if (!text || /^none$/i.test(text)) continue
    const kind = KINDS.includes(x.type as MnemonicKind) ? (x.type as MnemonicKind) : KINDS[out.length] ?? 'image'
    out.push({ kind, text })
  }
  return out.length > 0 ? out : null
}

// ---- Câu ví dụ theo trình độ, chủ đề, mục đích (R8.3) -----------------------------------------------

export const EXAMPLE_TOPICS = ['Đời sống hằng ngày', 'Công việc', 'Du lịch', 'Học tập, thi cử', 'Công nghệ', 'Sức khỏe'] as const
export type ExampleTopic = (typeof EXAMPLE_TOPICS)[number]

/** Chủ đề mặc định theo mục đích học trong hồ sơ. */
export function defaultTopic(purpose: string | undefined): ExampleTopic {
  const p = (purpose ?? '').toLowerCase()
  if (/công việc|chuyên ngành/.test(p)) return 'Công việc'
  if (/ielts|toeic|du học|thi/.test(p)) return 'Học tập, thi cử'
  if (/du lịch/.test(p)) return 'Du lịch'
  return 'Đời sống hằng ngày'
}

export const EXAMPLES_SYSTEM = `Bạn là giáo viên tiếng Anh cho người Việt.
Viết đúng 3 câu ví dụ tiếng Anh tự nhiên, mỗi câu dùng đúng từ được cho với đúng nghĩa đã cho, hợp trình độ và chủ đề của người học, kèm bản dịch tiếng Việt tự nhiên.
Trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"examples": [{"en": string, "vi": string}]}
Quy tắc:
- Mỗi câu 6 đến 16 từ. Trình độ A1–A2: câu đơn giản, từ vựng cơ bản. B1–B2: câu đời thường. C1: câu phong phú hơn.
- Ba câu khác nhau về tình huống; không dùng tên riêng lạ.
- Bản dịch tiếng Việt sát nghĩa, tự nhiên như người Việt nói.`

export function examplesPrompt(o: { term: string; partOfSpeech: PartOfSpeech; meaningVi: string; meaningEn?: string; level: string; topic: string; purpose?: string; attempt?: number }): string {
  return [
    `Từ: "${o.term}" (${o.partOfSpeech}), nghĩa: ${o.meaningVi}${o.meaningEn ? ` (${o.meaningEn})` : ''}`,
    `Trình độ người học: ${o.level}`,
    `Chủ đề: ${o.topic}`,
    o.purpose ? `Mục đích học: ${o.purpose}` : '',
    o.attempt && o.attempt > 1 ? `Hãy viết 3 câu mới, khác các câu đã viết trước đó (lần ${o.attempt}).` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Câu có dùng từ (hoặc một dạng của nó): có ít nhất một từ thành phần dài từ 3 chữ cái xuất hiện ở đầu một từ trong câu. */
export function usesTerm(sentence: string, term: string): boolean {
  const parts = term.toLowerCase().match(/[a-z]{3,}/g)
  if (!parts) return true
  const words = sentence.toLowerCase().match(/[a-z]+/g) ?? []
  return parts.some((p) => words.some((w) => w.startsWith(p.slice(0, Math.max(3, p.length - 2)))))
}

export function toExamples(raw: unknown, term: string): { en: string; vi: string }[] | null {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).examples) ? ((raw as Record<string, unknown>).examples as unknown[]) : null
  if (!list) return null
  const out = list
    .slice(0, 3)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>
      return { en: str(x.en, 300), vi: str(x.vi, 300) }
    })
    .filter((e) => e.en.split(' ').length >= 3 && usesTerm(e.en, term))
  return out.length > 0 ? out : null
}

/** Trình độ CEFR từ trình độ trong hồ sơ (mặc định B1). */
export function cefrOf(selfLevel: string | undefined): string {
  return { beginner: 'A1', elementary: 'A2', intermediate: 'B1', upper_intermediate: 'B2', advanced: 'C1' }[selfLevel ?? ''] ?? 'B1'
}

// ---- Kết hợp từ (R7.4) và từ dễ nhầm (R7.5) cho từ ngoài bộ soạn sẵn ---------------------------------

export const COLLOCATIONS_SYSTEM = `Bạn là giáo viên tiếng Anh cho người Việt.
Với một từ tiếng Anh (kèm loại từ và nghĩa), liệt kê 3 đến 5 kết hợp từ thông dụng và hữu ích nhất cho người học.
Trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"items": [{"kind": "col"|"prep"|"pattern", "en": string, "vi": string, "ex": string, "ex_vi": string}]}
Quy tắc:
- kind: "col" là cụm từ hay đi cùng (make a decision, heavy rain), "prep" là giới từ đi kèm (depend on, interested in), "pattern" là mẫu câu (spend time V-ing, too + adj + to V).
- en: cụm tiếng Anh ngắn có chứa từ được hỏi; mẫu câu được dùng sb, sth, V, V-ing, to V.
- vi: nghĩa tiếng Việt ngắn, tự nhiên.
- ex: câu ví dụ tự nhiên 5 đến 14 từ có dùng cụm đó; ex_vi: bản dịch tiếng Việt tự nhiên. Ít nhất 2 mục có câu ví dụ; mục khác để chuỗi rỗng.
- Chỉ đưa cụm thật sự phổ biến và đúng ngữ pháp; không bịa.`

export function wordPrompt(term: string, partOfSpeech: PartOfSpeech, meaningVi: string): string {
  return `Từ: "${term}" (${partOfSpeech}), nghĩa: ${meaningVi}`
}

const COLLOCATION_KINDS: readonly CollocationKind[] = ['col', 'prep', 'pattern']

export function toCollocations(raw: unknown, term: string): Collocation[] | null {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items) ? ((raw as Record<string, unknown>).items as unknown[]) : null
  if (!list) return null
  const out: Collocation[] = []
  for (const c of list) {
    const x = (c ?? {}) as Record<string, unknown>
    const en = str(x.en, 80)
    const vi = str(x.vi, 120)
    if (!en || !vi || !usesTerm(en, term) || out.some((o) => o.en.toLowerCase() === en.toLowerCase())) continue
    const ex = str(x.ex, 300)
    out.push({ kind: COLLOCATION_KINDS.includes(x.kind as CollocationKind) ? (x.kind as CollocationKind) : 'col', en, vi, ex: ex || undefined, exVi: ex ? str(x.ex_vi, 300) || undefined : undefined })
    if (out.length === 5) break
  }
  return out.length > 0 ? out : null
}

export const CONFUSABLES_SYSTEM = `Bạn là giáo viên tiếng Anh cho người Việt.
Với một từ tiếng Anh, tìm MỘT nhóm từ mà người Việt hay nhầm với nó nhất: nghĩa gần nhau nhưng cách dùng khác, hoặc viết, đọc gần giống. Nhóm có 2 hoặc 3 từ thông dụng và phải có chứa từ được hỏi.
Trả về DUY NHẤT một đối tượng JSON (không giải thích, không markdown) đúng khuôn:
{"groups": [{"words": [string], "summary": string, "items": [{"word": string, "meaning": string, "usage": string, "examples": [{"en": string, "vi": string}]}]}]}
Quy tắc:
- groups chỉ có 1 phần tử. Không chọn từ thô tục hay nhạy cảm.
- summary: 1 hoặc 2 câu tiếng Việt nói cách phân biệt nhanh nhất.
- items: mỗi từ trong words có đúng một mục, theo đúng thứ tự. meaning: nghĩa tiếng Việt ngắn. usage: cách dùng bằng tiếng Việt, kèm mẫu tiếng Anh (không dùng ngoặc vuông).
- examples: 2 câu tiếng Anh tự nhiên, 6 đến 14 từ, cho mỗi từ. Đặt từ đó (dạng đã chia nếu có) trong ngoặc vuông, ví dụ "Could you [lend] me your pen?". Câu phải sai hoặc đổi nghĩa nếu thay bằng từ khác trong nhóm. vi là bản dịch tiếng Việt, không có ngoặc vuông.
- Nếu không có từ nào người Việt hay nhầm với từ này thì trả {"groups": []}.`

/** Nhóm từ dễ nhầm do AI đưa: bỏ nhóm không chứa từ được hỏi, câu không đánh dấu được từ. Danh sách rỗng là câu trả lời hợp lệ. */
export function toConfusables(raw: unknown, term: string): ConfusableGroup[] | null {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).groups) ? ((raw as Record<string, unknown>).groups as unknown[]) : null
  if (!list) return null
  const key = termKey(term)
  const out: ConfusableGroup[] = []
  for (const g of list.slice(0, 1)) {
    const x = (g ?? {}) as Record<string, unknown>
    const words = [...new Set((Array.isArray(x.words) ? x.words : []).map((w) => str(w, 40)).filter(Boolean))].slice(0, 4)
    if (words.length < 2 || !words.some((w) => termKey(w) === key)) continue
    const raws = (Array.isArray(x.items) ? x.items : []).map((i) => (i ?? {}) as Record<string, unknown>)
    const items: ConfusableItem[] = []
    for (const w of words) {
      const it = raws.find((i) => termKey(str(i.word, 40)) === termKey(w))
      if (!it) break
      const examples = (Array.isArray(it.examples) ? it.examples : [])
        .map((e) => (e ?? {}) as Record<string, unknown>)
        .map((e) => ({ en: markWord(str(e.en, 300), w), vi: plainSentence(str(e.vi, 300)) }))
        .filter((e): e is { en: string; vi: string } => !!e.en)
        .slice(0, 2)
      items.push({ word: w, meaning: str(it.meaning, 100), usage: plainSentence(str(it.usage, 300)), examples })
    }
    if (items.length !== words.length || items.some((i) => !i.meaning)) continue
    out.push({ id: `ai-${termKey(words.join(' '))}`, words, summary: plainSentence(str(x.summary, 400)).replace(/\*+/g, ''), items, related: [] })
  }
  return out.length > 0 || list.length === 0 ? out : null
}
