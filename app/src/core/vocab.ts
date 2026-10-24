import { normalizeAnswer } from './answers'
import type { PartOfSpeech } from './pos'

/** Khóa so sánh của từ: chuẩn hóa giống khi chấm đáp án (R2.5). */
export function termKey(term: string): string {
  return normalizeAnswer(term)
}

/**
 * Khóa so sánh của nghĩa: bỏ hoa thường, dấu câu và khoảng trắng thừa,
 * để "kiên cường, mau phục hồi." và "Kiên cường mau phục hồi" được coi là một nghĩa.
 */
export function meaningKey(meaning: string): string {
  return meaning
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,;:!?()[\]"“”'‘’/\\–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface DuplicateCandidate {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
}

export interface ComparableItem extends DuplicateCandidate {
  id: string
  termKey: string
  deletedAt: number | null
}

export type DuplicateKind =
  /** Cùng từ, cùng loại từ, cùng nghĩa: không tạo thêm để tránh tiến độ trùng. */
  | 'exact'
  /** Cùng từ nhưng khác nghĩa hoặc loại từ: được lưu thành mục học riêng. */
  | 'same_term'

export interface DuplicateMatch<T extends ComparableItem> {
  item: T
  kind: DuplicateKind
}

/** Phân biệt từ trùng với từ cùng mặt chữ nhưng nghĩa mới (R2.5). */
export function findDuplicates<T extends ComparableItem>(candidate: DuplicateCandidate, existing: readonly T[], excludeId?: string): DuplicateMatch<T>[] {
  const key = termKey(candidate.term)
  const meaning = meaningKey(candidate.meaningVi)
  return existing
    .filter((it) => it.deletedAt === null && it.id !== excludeId && it.termKey === key)
    .map((item) => ({
      item,
      kind: item.partOfSpeech === candidate.partOfSpeech && meaningKey(item.meaningVi) === meaning ? ('exact' as const) : ('same_term' as const),
    }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'exact' ? -1 : 1))
}

/**
 * Các nhóm mục học trùng nội dung (cùng từ, loại từ, nghĩa) đang cùng tồn tại — thường do cùng nhập
 * một danh sách trên hai thiết bị trước khi đồng bộ (R2.5, R11.4).
 */
export function duplicateGroups<T extends ComparableItem>(items: readonly T[]): T[][] {
  const groups = new Map<string, T[]>()
  for (const it of items) {
    if (it.deletedAt !== null) continue
    const key = JSON.stringify([it.termKey, it.partOfSpeech, meaningKey(it.meaningVi)])
    const group = groups.get(key)
    if (group) group.push(it)
    else groups.set(key, [it])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}

/** Bỏ dấu tiếng Việt và hoa thường để tìm kiếm: "Kiên cường" → "kien cuong". */
export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tách nhãn cá nhân: "ielts, Công việc; ielts" → ["ielts", "Công việc"]. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[,;]/)) {
    const tag = raw.replace(/\s+/g, ' ').trim()
    const k = tag.toLowerCase()
    if (!tag || seen.has(k)) continue
    seen.add(k)
    out.push(tag.slice(0, 40))
    if (out.length >= 20) break
  }
  return out
}

/** Câu ví dụ có che từ đang học, để làm gợi ý ngữ cảnh mà không lộ đáp án. */
export function blankTerm(sentence: string, term: string): string {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return sentence.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '_____')
}

/** Vị trí từ đang học trong câu (khớp nguyên từ, không phân biệt hoa thường). */
export function findTermSpan(sentence: string, term: string): { start: number; end: number } | null {
  const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escaped) return null
  const m = new RegExp(`\\b${escaped}\\b`, 'i').exec(sentence)
  return m ? { start: m.index, end: m.index + m[0].length } : null
}

/** Câu ví dụ đầu tiên có chứa đúng từ đang học, để làm bài trong ngữ cảnh. */
export function contextSentence(item: { term: string; examples: readonly { en: string }[] }): string | null {
  for (const ex of item.examples) if (findTermSpan(ex.en, item.term)) return ex.en
  return null
}
