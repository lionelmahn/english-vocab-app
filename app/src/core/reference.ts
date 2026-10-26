import { POS_ORDER, type PartOfSpeech } from './pos'
import { foldText, termKey } from './vocab'

/**
 * Nội dung tham khảo soạn sẵn cho bộ 1.000 từ khởi đầu: kết hợp từ (R7.4), mẹo nhớ (R8.4), câu ví dụ theo trình độ
 * (R8.3) và nhóm từ dễ nhầm (R7.5). Dùng chung cho mọi người học, không đồng bộ; từ khác thì hỏi AI.
 */

export type CollocationKind = 'col' | 'prep' | 'pattern'

export const COLLOCATION_KIND_LABEL: Record<CollocationKind, string> = {
  col: 'Cụm từ',
  prep: 'Giới từ',
  pattern: 'Mẫu câu',
}

export interface Collocation {
  kind: CollocationKind
  en: string
  vi: string
  ex?: string
  exVi?: string
}

export interface WordReference {
  term: string
  partOfSpeech: PartOfSpeech
  collocations: Collocation[]
  mnemonic?: string
}

export type ExampleLevel = 'A2' | 'B1' | 'B2'
export const EXAMPLE_LEVELS: readonly ExampleLevel[] = ['A2', 'B1', 'B2']

export interface LevelExample {
  level: ExampleLevel
  en: string
  vi: string
}

export interface ConfusableItem {
  word: string
  meaning: string
  usage: string
  /**
   * Câu ví dụ; từ cần chọn nằm trong [ngoặc vuông], ví dụ "Could you [lend] me your pen?". `also`: từ khác trong nhóm
   * cũng đúng ở câu này (despite / in spite of), để bài thử không chấm sai.
   */
  examples: { en: string; vi: string; also?: string[] }[]
}

export interface ConfusableGroup {
  id: string
  words: string[]
  summary: string
  items: ConfusableItem[]
  /** Từ gốc trong bộ 1.000 từ mà nhóm cũng hiện ở trang của nó (interest → interested / interesting). */
  related: string[]
}

const fields = (line: string) => line.split('|').map((f) => f.trim())
const lines = (text: string) => text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
const KINDS: readonly CollocationKind[] = ['col', 'prep', 'pattern']

/**
 * File kết hợp từ và mẹo nhớ: `T|từ|loại từ` mở một từ, sau đó `C|kiểu|cụm|nghĩa|câu ví dụ|dịch` cho mỗi kết hợp từ và
 * `M|mẹo nhớ` (nếu có). Khóa là `termKey` của từ.
 */
export function parseWordReference(text: string): Map<string, WordReference> {
  const out = new Map<string, WordReference>()
  let cur: WordReference | undefined
  for (const line of lines(text)) {
    const f = fields(line)
    if (f[0] === 'T') {
      cur = {
        term: f[1],
        partOfSpeech: POS_ORDER.includes(f[2] as PartOfSpeech) ? (f[2] as PartOfSpeech) : 'other',
        collocations: [],
      }
      out.set(termKey(f[1]), cur)
    } else if (f[0] === 'C' && cur) {
      cur.collocations.push({
        kind: KINDS.includes(f[1] as CollocationKind) ? (f[1] as CollocationKind) : 'col',
        en: f[2],
        vi: f[3],
        ex: f[4] || undefined,
        exVi: f[5] || undefined,
      })
    } else if (f[0] === 'M' && cur && f[1]) {
      cur.mnemonic = f[1]
    }
  }
  return out
}

/** File câu ví dụ theo trình độ: `T|từ` rồi `E|trình độ|câu|dịch`. */
export function parseLevelExamples(text: string): Map<string, LevelExample[]> {
  const out = new Map<string, LevelExample[]>()
  let cur: LevelExample[] | undefined
  for (const line of lines(text)) {
    const f = fields(line)
    if (f[0] === 'T') out.set(termKey(f[1]), (cur = []))
    else if (f[0] === 'E' && cur && EXAMPLE_LEVELS.includes(f[1] as ExampleLevel)) cur.push({ level: f[1] as ExampleLevel, en: f[2], vi: f[3] })
  }
  return out
}

/**
 * File nhóm từ dễ nhầm: `G|mã|cách phân biệt|từ liên quan (cách nhau bởi dấu cách)`, rồi mỗi từ `W|từ|nghĩa|cách dùng`
 * kèm các câu `X|câu|dịch|từ khác cũng đúng (cách nhau bởi ;)`.
 */
export function parseConfusables(text: string): ConfusableGroup[] {
  const out: ConfusableGroup[] = []
  let group: ConfusableGroup | undefined
  let item: ConfusableItem | undefined
  for (const line of lines(text)) {
    const f = fields(line)
    if (f[0] === 'G') {
      group = {
        id: f[1],
        words: [],
        summary: f[2],
        items: [],
        related: (f[3] ?? '').split(' ').filter(Boolean),
      }
      item = undefined
      out.push(group)
    } else if (f[0] === 'W' && group) {
      item = { word: f[1], meaning: f[2], usage: f[3], examples: [] }
      group.items.push(item)
      group.words.push(item.word)
    } else if (f[0] === 'X' && item) {
      const also = (f[3] ?? '')
        .split(';')
        .map((w) => w.trim())
        .filter(Boolean)
      item.examples.push(also.length ? { en: f[1], vi: f[2], also } : { en: f[1], vi: f[2] })
    }
  }
  return out
}

/** Các nhóm có chứa từ này hoặc ghi từ này là từ liên quan (so theo `termKey`, nên "Lend" khớp "lend"). */
export function groupsWith(groups: readonly ConfusableGroup[], term: string): ConfusableGroup[] {
  const key = termKey(term)
  return key ? groups.filter((g) => g.words.some((w) => termKey(w) === key) || g.related.some((r) => termKey(r) === key)) : []
}

/** Tìm nhóm theo từ tiếng Anh hoặc chữ trong phần giải thích, không cần gõ dấu. Từ khớp đúng được xếp trước. */
export function searchGroups(groups: readonly ConfusableGroup[], query: string): ConfusableGroup[] {
  const q = foldText(query)
  if (!q) return [...groups]
  const exact = groupsWith(groups, query)
  const rest = groups.filter((g) => !exact.includes(g) && (g.words.some((w) => foldText(w).includes(q)) || foldText(g.summary).includes(q) || g.items.some((i) => foldText(i.meaning).includes(q))))
  return [...exact, ...rest]
}

/** Tách câu có [từ] thành ba phần; câu không có ngoặc thì `form` rỗng. */
export function splitMarked(sentence: string): {
  before: string
  form: string
  after: string
} {
  const m = /\[([^\]]+)\]/.exec(sentence)
  if (!m) return { before: sentence, form: '', after: '' }
  return {
    before: sentence.slice(0, m.index),
    form: m[1],
    after: sentence.slice(m.index + m[0].length),
  }
}

export function plainSentence(sentence: string): string {
  return sentence.replace(/\[([^\]]+)\]/g, '$1')
}

/**
 * Đánh dấu [từ] trong câu nếu câu chưa có: tìm nguyên cụm, hoặc một chữ bắt đầu bằng gốc của từ (lend → lending).
 * Không tìm thấy (ví dụ dạng bất quy tắc lent) thì null.
 */
export function markWord(sentence: string, word: string): string | null {
  if (splitMarked(sentence).form) return sentence
  const w = word.trim().toLowerCase()
  if (!w) return null
  if (w.includes(' ')) {
    const i = sentence.toLowerCase().indexOf(w)
    return i < 0 ? null : `${sentence.slice(0, i)}[${sentence.slice(i, i + w.length)}]${sentence.slice(i + w.length)}`
  }
  const stem = w.length > 4 ? w.slice(0, w.length - (w.endsWith('e') || w.endsWith('y') ? 1 : 0)) : w
  const re = /[A-Za-z']+/g
  for (let m = re.exec(sentence); m; m = re.exec(sentence)) {
    const t = m[0].toLowerCase()
    if (t === w || (t.startsWith(stem) && t.length - stem.length <= 4)) return `${sentence.slice(0, m.index)}[${m[0]}]${sentence.slice(m.index + m[0].length)}`
  }
  return null
}

export interface ConfusableQuestion {
  /** Câu có [từ]. */
  sentence: string
  vi: string
  answer: string
  /** Mọi lựa chọn được tính đúng: đáp án và từ cũng đúng ở câu này. */
  accept: string[]
  options: string[]
}

/** Câu hỏi "chọn từ đúng" từ các câu ví dụ của nhóm, xáo thứ tự. Đáp án là từ gốc; lựa chọn giữ thứ tự của nhóm. */
export function confusableQuiz(group: ConfusableGroup, random: () => number = Math.random): ConfusableQuestion[] {
  const qs = group.items.flatMap((it) =>
    it.examples
      .filter((e) => splitMarked(e.en).form)
      .map((e) => ({
        sentence: e.en,
        vi: e.vi,
        answer: it.word,
        accept: [it.word, ...(e.also ?? []).filter((w) => group.words.includes(w))],
        options: group.words,
      })),
  )
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
  }
  return qs
}

/** Thứ tự hiện câu ví dụ soạn sẵn: trình độ của người học trước, rồi các mức gần nhất. */
export function levelOrder(cefr: string): ExampleLevel[] {
  if (cefr === 'B1') return ['B1', 'A2', 'B2']
  if (cefr === 'B2' || cefr.startsWith('C')) return ['B2', 'B1', 'A2']
  return ['A2', 'B1', 'B2']
}

/** Mẹo nhớ và câu ví dụ soạn sẵn viết theo nghĩa trong bộ từ khởi đầu: chỉ dùng khi từ trong sổ tay cùng loại từ. */
export function sameSense(ref: WordReference | undefined, partOfSpeech: PartOfSpeech): boolean {
  return !!ref && ref.partOfSpeech === partOfSpeech
}
