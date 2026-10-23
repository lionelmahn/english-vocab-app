import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { applyReview, createScheduler, newCard } from '../core/scheduler'
import { cardToRow, rowToCard } from './cards'
import { VocabDatabase, writeWithOutbox } from './db'
import type { VocabItem } from './types'

let database: VocabDatabase

afterEach(async () => {
  await database?.delete()
})

const item = (id: string, now: number): VocabItem => ({
  id,
  term: 'resilient',
  termKey: 'resilient',
  partOfSpeech: 'adjective',
  meaningVi: 'kiên cường',
  examples: [{ en: 'Children are resilient.', vi: 'Trẻ em rất kiên cường.' }],
  acceptedAnswers: [],
  tags: ['ielts'],
  favorite: false,
  difficult: false,
  archived: false,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})

describe('VocabDatabase', () => {
  it('ghi từ và xếp vào hàng đợi đồng bộ trong cùng một giao dịch', async () => {
    database = new VocabDatabase(`test-${crypto.randomUUID()}`)
    const now = Date.now()
    await writeWithOutbox(database, 'vocabItems', [item('a', now), item('b', now)], now)

    expect(await database.vocabItems.count()).toBe(2)
    expect(await database.vocabItems.where('tags').equals('ielts').count()).toBe(2)
    const queued = await database.outbox.toArray()
    expect(queued.map((q) => q.rowId)).toEqual(['a', 'b'])
    expect(queued.every((q) => q.table === 'vocabItems')).toBe(true)
  })

  it('lưu và đọc lại trạng thái thẻ mà lịch ôn không đổi', async () => {
    database = new VocabDatabase(`test-${crypto.randomUUID()}`)
    const s = createScheduler()
    const t0 = new Date('2026-10-01T08:00:00Z')
    let card = applyReview(s, newCard(t0), Rating.Good, t0).card
    card = applyReview(s, card, Rating.Good, card.due).card

    await database.cardStates.put(cardToRow('a', card, t0.getTime()))
    const stored = rowToCard((await database.cardStates.get('a'))!)

    const reviewAt = new Date(card.due.getTime() + 86_400_000)
    expect(applyReview(s, stored, Rating.Good, reviewAt).card).toEqual(applyReview(s, card, Rating.Good, reviewAt).card)
  })
})
