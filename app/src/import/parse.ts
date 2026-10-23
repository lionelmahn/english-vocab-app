import { parsePos, type PartOfSpeech } from '../core/pos'
import { foldText, findDuplicates, meaningKey, parseTags, termKey, type ComparableItem } from '../core/vocab'

/** Đọc bảng từ vựng nhập từ file (R11.2): nhận cột, chuẩn hóa, kiểm tra lỗi và trùng. */

export type Field = 'term' | 'meaningVi' | 'pos' | 'ipaUs' | 'ipaUk' | 'example' | 'exampleVi' | 'tags' | 'deck' | 'note' | 'meaningEn'

const ALIASES: Record<Field, string[]> = {
  term: ['term', 'word', 'words', 'tu', 'tu vung', 'tu/cum tu', 'cum tu', 'english', 'tieng anh', 'vocabulary', 'vocab', 'front', 'expression'],
  meaningVi: ['meaning', 'meaning_vi', 'meaning vi', 'nghia', 'nghia tieng viet', 'vietnamese', 'tieng viet', 'dich', 'back', 'translation', 'definition_vi'],
  pos: ['pos', 'part of speech', 'part_of_speech', 'loai tu', 'tu loai', 'type', 'word type', 'class'],
  ipaUs: ['ipa', 'ipa_us', 'ipa us', 'phien am', 'phien am my', 'pronunciation', 'phonetic', 'phonetics', 'us'],
  ipaUk: ['ipa_uk', 'ipa uk', 'phien am anh', 'uk'],
  example: ['example', 'example_en', 'example sentence', 'vi du', 'cau vi du', 'sentence'],
  exampleVi: ['example_vi', 'example vi', 'dich vi du', 'nghia vi du', 'dich cau', 'example translation', 'cau vi du dich'],
  tags: ['tags', 'tag', 'nhan', 'labels', 'label'],
  deck: ['deck', 'bo tu', 'bo', 'set', 'list', 'chu de', 'topic', 'lesson', 'bai'],
  note: ['note', 'notes', 'ghi chu'],
  meaningEn: ['meaning_en', 'definition', 'english meaning', 'nghia tieng anh', 'define'],
}

export type ColumnMap = Partial<Record<Field, number>>

function headerField(cell: string): Field | undefined {
  const k = foldText(cell).replace(/[*:]/g, '').trim()
  if (!k) return undefined
  for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) if (names.includes(k)) return field
  return undefined
}

/** Nhận cột theo dòng tiêu đề. Không có tiêu đề: coi 2 cột đầu là từ và nghĩa. */
export function detectColumns(firstRow: readonly string[]): { map: ColumnMap; hasHeader: boolean } {
  const map: ColumnMap = {}
  firstRow.forEach((cell, i) => {
    const f = headerField(cell)
    if (f && map[f] === undefined) map[f] = i
  })
  if (map.term !== undefined || map.meaningVi !== undefined) return { map, hasHeader: true }
  const fallback: ColumnMap = { term: 0, meaningVi: 1 }
  if (firstRow.length >= 3) fallback.pos = 2
  if (firstRow.length >= 4) fallback.ipaUs = 3
  if (firstRow.length >= 5) fallback.example = 4
  return { map: fallback, hasHeader: false }
}

export type RowStatus = 'ok' | 'error' | 'duplicate' | 'same_term' | 'dup_in_file'

export interface ImportRow {
  line: number
  term: string
  meaningVi: string
  partOfSpeech: PartOfSpeech
  ipaUs?: string
  ipaUk?: string
  meaningEn?: string
  example?: string
  exampleVi?: string
  tags: string[]
  deck?: string
  note?: string
  status: RowStatus
  message?: string
}

const cell = (row: readonly string[], i: number | undefined) => (i === undefined ? '' : String(row[i] ?? '').trim())

export const MAX_ROWS = 5000

export function toImportRows(table: readonly (readonly string[])[], existing: readonly ComparableItem[]): ImportRow[] {
  const nonEmpty = table.filter((r) => r.some((c) => String(c ?? '').trim()))
  if (nonEmpty.length === 0) return []
  const { map, hasHeader } = detectColumns(nonEmpty[0].map((c) => String(c ?? '')))
  const body = (hasHeader ? nonEmpty.slice(1) : nonEmpty).slice(0, MAX_ROWS)
  const seen = new Set<string>()

  return body.map((r, idx) => {
    const term = cell(r, map.term).replace(/\s+/g, ' ')
    const meaningVi = cell(r, map.meaningVi)
    const rawPos = cell(r, map.pos)
    const row: ImportRow = {
      line: idx + (hasHeader ? 2 : 1),
      term,
      meaningVi,
      partOfSpeech: rawPos ? parsePos(rawPos) : 'other',
      ipaUs: cell(r, map.ipaUs) || undefined,
      ipaUk: cell(r, map.ipaUk) || undefined,
      meaningEn: cell(r, map.meaningEn) || undefined,
      example: cell(r, map.example) || undefined,
      exampleVi: cell(r, map.exampleVi) || undefined,
      tags: parseTags(cell(r, map.tags)),
      deck: cell(r, map.deck) || undefined,
      note: cell(r, map.note) || undefined,
      status: 'ok',
    }
    if (!term) return { ...row, status: 'error', message: 'Thiếu từ' }
    if (!meaningVi) return { ...row, status: 'error', message: 'Thiếu nghĩa' }
    if (term.length > 200) return { ...row, status: 'error', message: 'Từ quá dài' }
    const key = `${termKey(term)}|${row.partOfSpeech}|${meaningKey(meaningVi)}`
    if (seen.has(key)) return { ...row, status: 'dup_in_file', message: 'Lặp lại trong file' }
    seen.add(key)
    const matches = findDuplicates({ term, partOfSpeech: row.partOfSpeech, meaningVi }, existing)
    if (matches.some((m) => m.kind === 'exact')) return { ...row, status: 'duplicate', message: 'Đã có trong sổ tay' }
    if (matches.length > 0) return { ...row, status: 'same_term', message: 'Đã có từ này với nghĩa khác' }
    return row
  })
}

export function summarizeRows(rows: readonly ImportRow[]) {
  const count = (s: RowStatus) => rows.filter((r) => r.status === s).length
  return {
    total: rows.length,
    ok: count('ok'),
    sameTerm: count('same_term'),
    duplicate: count('duplicate'),
    dupInFile: count('dup_in_file'),
    error: count('error'),
  }
}

/** File mẫu (UTF-8 có BOM để Excel đọc đúng tiếng Việt). */
export const TEMPLATE_CSV =
  '﻿' +
  [
    'term,part_of_speech,meaning_vi,ipa,example,example_vi,tags,deck',
    'resilient,adj,"kiên cường, mau phục hồi",/rɪˈzɪliənt/,Children are often more resilient than adults.,Trẻ em thường kiên cường hơn người lớn.,ielts,IELTS',
    'give up,phrasal verb,từ bỏ,/ɡɪv ʌp/,Never give up on your dreams.,Đừng bao giờ từ bỏ ước mơ.,,Giao tiếp',
  ].join('\r\n')
