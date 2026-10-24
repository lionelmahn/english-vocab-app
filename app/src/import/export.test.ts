import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import type { Deck, DeckItem, VocabItem } from '../db/types'
import { csvCell, exportFileName, exportRows, toCsv } from './export'
import { toImportRows } from './parse'

const T = Date.parse('2026-10-24T08:00:00Z')
const item = (id: string, term: string, meaningVi: string, extra: Partial<VocabItem> = {}): VocabItem => ({
  id,
  term,
  termKey: term.toLowerCase(),
  partOfSpeech: 'adjective',
  meaningVi,
  examples: [],
  acceptedAnswers: [],
  tags: [],
  favorite: false,
  difficult: false,
  archived: false,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
  ...extra,
})

const items: VocabItem[] = [
  item('a', 'resilient', 'kiên cường, mau phục hồi', {
    ipaUs: '/rɪˈzɪliənt/',
    examples: [{ en: 'Kids are "resilient", aren\'t they?', vi: 'Trẻ em kiên cường.' }],
    tags: ['ielts', 'công việc'],
    favorite: true,
    createdAt: T + 1,
  }),
  item('b', 'give up', 'từ bỏ', { partOfSpeech: 'phrasal_verb', note: 'dòng 1\ndòng 2', createdAt: T }),
  item('c', 'old', 'cũ', { archived: true, createdAt: T + 2 }),
  item('d', 'gone', 'đã xóa', { deletedAt: T + 5 }),
]
const decks: Deck[] = [{ id: 'd1', name: 'IELTS', active: true, archived: false, createdAt: T, updatedAt: T, deletedAt: null }]
const deckItems: DeckItem[] = [{ id: 'l1', deckId: 'd1', itemId: 'a', position: 0, createdAt: T, updatedAt: T, deletedAt: null }]
const cards = new Map([['a', { id: 'a', due: Date.parse('2026-11-02T03:00:00Z'), state: 2 as const, stability: 10, reps: 3, suspended: false, deletedAt: null }]])
const src = { items, decks, deckItems, cards }

describe('xuất từ vựng ra CSV (R11.3)', () => {
  it('bọc ô có dấu phẩy, nháy kép, xuống dòng', () => {
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('plain')).toBe('plain')
  })

  it('theo thứ tự thêm, bỏ từ đã xóa, tùy chọn từ lưu trữ và lọc theo bộ', () => {
    expect(exportRows(src, { includeArchived: false }).map((r) => r[0])).toEqual(['give up', 'resilient'])
    expect(exportRows(src, { includeArchived: true }).map((r) => r[0])).toEqual(['give up', 'resilient', 'old'])
    const ielts = exportRows(src, { includeArchived: true, deckId: 'd1' })
    expect(ielts.map((r) => r[0])).toEqual(['resilient'])
    expect(ielts[0]).toEqual([
      'resilient',
      'adjective',
      'kiên cường, mau phục hồi',
      '',
      '/rɪˈzɪliənt/',
      '',
      'Kids are "resilient", aren\'t they?',
      'Trẻ em kiên cường.',
      'ielts, công việc',
      'IELTS',
      '',
      'Nhớ khá',
      '2026-11-02',
      'x',
      '',
      '',
    ])
  })

  it('nhập lại file vừa xuất vào app được đúng từ, nghĩa, loại từ, ví dụ, nhãn, bộ', () => {
    const csv = toCsv(exportRows(src, { includeArchived: false }))
    expect(csv.startsWith('﻿')).toBe(true)
    const table = Papa.parse<string[]>(csv.slice(1), { skipEmptyLines: 'greedy' }).data
    const rows = toImportRows(table, [])
    expect(rows.map((r) => ({ term: r.term, meaningVi: r.meaningVi, pos: r.partOfSpeech, deck: r.deck, tags: r.tags, example: r.example, note: r.note, status: r.status }))).toEqual([
      { term: 'give up', meaningVi: 'từ bỏ', pos: 'phrasal_verb', deck: undefined, tags: [], example: undefined, note: 'dòng 1\ndòng 2', status: 'ok' },
      { term: 'resilient', meaningVi: 'kiên cường, mau phục hồi', pos: 'adjective', deck: 'IELTS', tags: ['ielts', 'công việc'], example: 'Kids are "resilient", aren\'t they?', note: undefined, status: 'ok' },
    ])
    expect(rows[1].ipaUs).toBe('/rɪˈzɪliənt/')
  })

  it('tên file theo ngày, có tên bộ không dấu', () => {
    expect(exportFileName(undefined, T)).toMatch(/^tu-vung-2026-10-2\d\.csv$/)
    expect(exportFileName('Giao tiếp hằng ngày', T)).toMatch(/^tu-vung-giao-tiep-hang-ngay-2026-10-2\d\.csv$/)
  })
})
