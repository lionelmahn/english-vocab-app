import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { seededRandom } from '../core/exercises'
import { createScheduler } from '../core/scheduler'
import { applyAction } from '../core/session'
import { VocabDatabase } from '../db/db'
import { loadLibrary } from '../db/library'
import { createRepo, type ItemInput } from '../db/repo'
import { buildFreshPracticePlan, buildPracticePlan, practiceCandidates, testCandidates } from './plans'

let database: VocabDatabase
let repo: ReturnType<typeof createRepo>

beforeEach(() => {
  database = new VocabDatabase(`test-${crypto.randomUUID()}`)
  repo = createRepo(database, createScheduler())
})
afterEach(async () => {
  await database.delete()
})

const DAY = 86_400_000
const T0 = Date.parse('2026-10-24T08:00:00Z')

const input = (term: string): ItemInput => ({
  term,
  partOfSpeech: 'noun',
  meaningVi: `nghĩa ${term}`,
  examples: [],
  acceptedAnswers: [],
  tags: [],
  favorite: false,
  difficult: false,
})

/** Tạo từ đã học: `reviews` là các điểm lần lượt, mỗi lượt cách nhau một ngày, lượt cuối ngay trước T0. */
async function studied(term: string, reviews: Rating[], deckIds: string[] = []): Promise<string> {
  const id = await repo.createItem(input(term), deckIds)
  let at = T0 - (reviews.length - 1) * DAY - 60_000
  for (const g of reviews) {
    await database.cardStates.put(await repo.scheduledCard(id, g as 1 | 2 | 3 | 4, at))
    at += DAY
  }
  return id
}

describe('ôn chủ động (R5.7)', () => {
  it('phạm vi: sắp đến hạn theo thứ tự hạn, hay quên, một bộ, từ đã chọn; bỏ từ tạm dừng và từ chưa học', async () => {
    const deck = await repo.createDeck({ name: 'A' })
    const soon = await studied('soon', [Rating.Good])
    const later = await studied('later', [Rating.Good, Rating.Good, Rating.Good])
    const forgot = await studied('forgot', [Rating.Good, Rating.Good, Rating.Again, Rating.Good], [deck])
    const paused = await studied('paused', [Rating.Again])
    const fresh = await repo.createItem(input('fresh'), [deck])
    await repo.setSuspended([paused], true)
    const lib = await loadLibrary(database)
    const ids = (scope: Parameters<typeof practiceCandidates>[1], now = T0) => practiceCandidates(lib, scope, now).map((i) => i.id)

    expect(ids({ kind: 'soon' })).toEqual([soon, forgot, later].sort((a, b) => lib.cards.get(a)!.due - lib.cards.get(b)!.due))
    expect(ids({ kind: 'soon' })).not.toContain(paused)
    // Từ đã đến hạn thuộc buổi ôn theo lịch, không nằm trong "sắp đến hạn".
    expect(ids({ kind: 'soon' }, T0 + 400 * DAY)).toEqual([])
    expect(ids({ kind: 'hard' })).toEqual([forgot])
    expect(ids({ kind: 'deck', deckId: deck })).toEqual([forgot])
    expect(ids({ kind: 'all' }).sort()).toEqual([soon, later, forgot].sort())
    expect(ids({ kind: 'picked', itemIds: [paused, fresh, soon, soon] })).toEqual([paused, soon])
    expect(testCandidates(lib, { kind: 'all' }).map((i) => i.id)).not.toContain(paused)
  })

  it('kế hoạch: tối đa số từ đã chọn, chế độ luyện không đổi lịch ôn, trả lời sai được luyện lại', async () => {
    for (const t of ['a', 'b', 'c', 'd', 'e']) await studied(t, [Rating.Good])
    const lib = await loadLibrary(database)
    const plan = buildPracticePlan(lib, { scope: { kind: 'all' }, count: 3, now: T0, style: 'exercises', audioAvailable: true, rand: seededRandom(7) })!
    expect(plan.mode).toBe('practice')
    expect(plan.steps).toHaveLength(3)
    expect(new Set(plan.steps.map((s) => s.itemId)).size).toBe(3)

    const first = plan.steps[0]
    const { plan: after, effect } = applyAction(plan, { type: 'answer', result: { kind: 'answer', exercise: first.exercise!, correct: false } })
    expect(effect.schedule).toBe(false)
    expect(effect.log).toBe(true)
    expect(after.steps.some((s, i) => i > 0 && s.itemId === first.itemId && s.kind === 'retry')).toBe(true)

    expect(buildPracticePlan(lib, { scope: { kind: 'hard' }, count: 10, now: T0, style: 'exercises', audioAvailable: true })).toBeNull()
    const cards = buildPracticePlan(lib, { scope: { kind: 'soon' }, count: 10, now: T0, style: 'flashcard', audioAvailable: true })!
    expect(cards.steps.every((s) => s.exercise === 'flashcard')).toBe(true)
  })
})

describe('bài luyện câu mới (R8.5)', () => {
  it('từ có câu AI soạn làm bài điền từ trong câu đó (xen kẽ chọn và gõ); từ không có câu dùng dạng bài thường; không đổi lịch', async () => {
    const ids = []
    for (const t of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) ids.push(await studied(t, [Rating.Good, Rating.Good]))
    const lib = await loadLibrary(database)
    const contexts = { [ids[0]]: { en: 'The alpha team won.', vi: 'Đội alpha thắng.' }, [ids[1]]: { en: 'Say bravo loudly.' } }
    const plan = buildFreshPracticePlan(lib, [...ids, 'gone'], contexts, { now: T0, style: 'exercises', audioAvailable: false })!
    expect(plan.mode).toBe('practice')
    expect(plan.steps.map((s) => s.itemId)).toEqual(ids)
    expect(plan.steps[0].exercise).toBe('cloze_choice')
    expect(plan.steps[1].exercise).toBe('cloze_typing')
    expect(plan.steps.slice(2).every((s) => s.exercise !== 'cloze_choice' && s.exercise !== 'cloze_typing')).toBe(true)
    expect(plan.contexts).toEqual(contexts)
    expect(buildFreshPracticePlan(lib, ['gone'], {}, { now: T0, style: 'exercises', audioAvailable: false })).toBeNull()
  })
})
