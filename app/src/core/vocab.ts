import { normalizeAnswer } from './answers'
import type { PartOfSpeech } from './pos'

/** Khóa so sánh của từ: chuẩn hóa giống khi chấm đáp án (R2.5). */
export function termKey(term: string): string {
  return normalizeAnswer(term)
}

/** Khóa so sánh của nghĩa: bỏ hoa thường, khoảng trắng thừa và dấu câu ở cuối. */
export function meaningKey(meaning: string): string {
  return meaning
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;,!]+$/u, '')
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
