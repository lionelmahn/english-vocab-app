import { describe, expect, it } from 'vitest'
import { termKey } from '../core/vocab'
import { detectColumns, summarizeRows, toImportRows } from './parse'

describe('detectColumns', () => {
  it('nhận tiêu đề tiếng Việt có dấu và tiếng Anh', () => {
    const { map, hasHeader } = detectColumns(['Từ vựng', 'Loại từ', 'Nghĩa', 'Phiên âm', 'Ví dụ', 'Bộ từ'])
    expect(hasHeader).toBe(true)
    expect(map).toMatchObject({ term: 0, pos: 1, meaningVi: 2, ipaUs: 3, example: 4, deck: 5 })
  })
  it('không có tiêu đề: 2 cột đầu là từ và nghĩa', () => {
    expect(detectColumns(['run', 'chạy'])).toEqual({ map: { term: 0, meaningVi: 1 }, hasHeader: false })
  })
})

describe('toImportRows', () => {
  const existing = [{ id: 'x', term: 'run', termKey: termKey('run'), partOfSpeech: 'verb' as const, meaningVi: 'chạy', deletedAt: null }]

  it('chuẩn hóa, báo lỗi, phát hiện trùng với sổ tay và trong file', () => {
    const rows = toImportRows(
      [
        ['term', 'pos', 'meaning', 'tags', 'deck'],
        ['  resilient ', 'adj', 'kiên cường', 'ielts; ielts, Writing', 'IELTS'],
        ['run', 'v', 'Chạy', '', ''],
        ['run', 'v', 'điều hành', '', ''],
        ['', 'n', 'thiếu từ', '', ''],
        ['resilient', 'adj', 'kiên cường', '', ''],
        ['', '', '', '', ''],
      ],
      existing,
    )
    expect(rows.map((r) => r.status)).toEqual(['ok', 'duplicate', 'same_term', 'error', 'dup_in_file'])
    expect(rows[0]).toMatchObject({ line: 2, term: 'resilient', partOfSpeech: 'adjective', tags: ['ielts', 'Writing'], deck: 'IELTS' })
    expect(summarizeRows(rows)).toEqual({ total: 5, ok: 1, sameTerm: 1, duplicate: 1, dupInFile: 1, error: 1 })
  })

  it('file không có tiêu đề (ví dụ xuất từ Anki)', () => {
    const rows = toImportRows([['meticulous', 'tỉ mỉ']], [])
    expect(rows[0]).toMatchObject({ line: 1, term: 'meticulous', meaningVi: 'tỉ mỉ', partOfSpeech: 'other', status: 'ok' })
  })
})
