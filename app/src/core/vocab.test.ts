import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import { deckStats, inStudyPlan, itemStatus, membership, type LibCard, type LibDeck, type LibItem } from './library'
import { parsePos } from './pos'
import { findDuplicates, meaningKey, parseTags, termKey } from './vocab'

describe('parsePos', () => {
  it('nhận viết tắt, tiếng Anh và tiếng Việt', () => {
    expect(parsePos('n')).toBe('noun')
    expect(parsePos('(adj.)')).toBe('adjective')
    expect(parsePos('Động từ')).toBe('verb')
    expect(parsePos('phrasal verb')).toBe('phrasal_verb')
    expect(parsePos('cụm từ')).toBe('phrase')
  })
  it('không nhận ra thì là "other"', () => {
    expect(parsePos('xyz')).toBe('other')
    expect(parsePos('')).toBe('other')
  })
})

describe('findDuplicates — R2.5', () => {
  const existing = [
    { id: '1', term: 'Run', termKey: termKey('Run'), partOfSpeech: 'verb' as const, meaningVi: 'chạy', deletedAt: null },
    { id: '2', term: 'run', termKey: 'run', partOfSpeech: 'noun' as const, meaningVi: 'cuộc chạy', deletedAt: null },
    { id: '3', term: 'run', termKey: 'run', partOfSpeech: 'verb' as const, meaningVi: 'điều hành', deletedAt: Date.now() },
  ]

  it('cùng từ, loại từ và nghĩa là trùng hẳn', () => {
    const m = findDuplicates({ term: ' RUN ', partOfSpeech: 'verb', meaningVi: 'Chạy.' }, existing)
    expect(m[0]).toMatchObject({ kind: 'exact', item: { id: '1' } })
  })

  it('cùng từ khác nghĩa là mục học riêng', () => {
    const m = findDuplicates({ term: 'run', partOfSpeech: 'verb', meaningVi: 'vận hành' }, existing)
    expect(m.map((x) => x.kind)).toEqual(['same_term', 'same_term'])
  })

  it('bỏ qua mục đã xóa và chính mục đang sửa', () => {
    const m = findDuplicates({ term: 'run', partOfSpeech: 'verb', meaningVi: 'chạy' }, existing, '1')
    expect(m.map((x) => x.item.id)).toEqual(['2'])
  })

  it('meaningKey chuẩn hóa', () => {
    expect(meaningKey('  Kiên   cường. ')).toBe('kiên cường')
  })
})

describe('parseTags', () => {
  it('tách, bỏ trùng không phân biệt hoa thường', () => {
    expect(parseTags('ielts, Công việc; IELTS ,, ')).toEqual(['ielts', 'Công việc'])
  })
})

describe('library — trạng thái và phạm vi học', () => {
  const now = 1_000_000
  const item = (id: string, archived = false): LibItem => ({ id, archived, deletedAt: null })
  const deck = (id: string, active: boolean, archived = false, deleted = false): LibDeck => ({ id, active, archived, deletedAt: deleted ? 1 : null })
  const card = (id: string, due: number, state: 0 | 1 | 2 | 3 = State.Review, extra: Partial<LibCard> = {}): LibCard => ({
    id,
    due,
    state,
    stability: 5,
    reps: 3,
    suspended: false,
    deletedAt: null,
    ...extra,
  })

  it('itemStatus', () => {
    expect(itemStatus(item('a'), undefined, now)).toBe('new')
    expect(itemStatus(item('a', true), card('a', 0), now)).toBe('archived')
    expect(itemStatus(item('a'), card('a', now - 1), now)).toBe('due')
    expect(itemStatus(item('a'), card('a', now + 1, State.Learning), now)).toBe('learning')
    expect(itemStatus(item('a'), card('a', now + 1), now)).toBe('review')
    expect(itemStatus(item('a'), card('a', now - 1, State.Review, { suspended: true }), now)).toBe('suspended')
    expect(itemStatus(item('a'), card('a', now - 1, State.Review, { deletedAt: 5 }), now)).toBe('new')
  })

  it('inStudyPlan — từ thuộc nhiều bộ (R3.6)', () => {
    const decks = new Map([
      ['on', deck('on', true)],
      ['off', deck('off', false)],
      ['gone', deck('gone', true, false, true)],
    ])
    const m = membership([
      { deckId: 'on', itemId: 'both', deletedAt: null },
      { deckId: 'off', itemId: 'both', deletedAt: null },
      { deckId: 'off', itemId: 'onlyOff', deletedAt: null },
      { deckId: 'gone', itemId: 'onlyGone', deletedAt: null },
      { deckId: 'on', itemId: 'removed', deletedAt: 9 },
    ])
    expect(inStudyPlan('both', m, decks)).toBe(true)
    expect(inStudyPlan('onlyOff', m, decks)).toBe(false)
    expect(inStudyPlan('loose', m, decks)).toBe(true)
    expect(inStudyPlan('onlyGone', m, decks)).toBe(true)
    expect(inStudyPlan('removed', m, decks)).toBe(true)
  })

  it('deckStats', () => {
    const items = new Map([
      ['a', item('a')],
      ['b', item('b')],
      ['c', item('c', true)],
    ])
    const m = membership([
      { deckId: 'd', itemId: 'a', deletedAt: null },
      { deckId: 'd', itemId: 'b', deletedAt: null },
      { deckId: 'd', itemId: 'c', deletedAt: null },
    ])
    const cards = new Map([['a', card('a', now - 5)]])
    expect(deckStats('d', items, m, cards, now)).toEqual({ total: 2, learned: 1, due: 1, newCount: 1 })
  })
})
