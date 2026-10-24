import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { createScheduler } from '../core/scheduler'
import { applyAction, planLearn, planReview } from '../core/session'
import { VocabDatabase } from './db'
import { dueQueue, learnCandidates, loadLibrary, nextDueAt } from './library'
import { createRepo, type ItemInput } from './repo'

let database: VocabDatabase
let repo: ReturnType<typeof createRepo>
const scheduler = createScheduler()

beforeEach(() => {
  database = new VocabDatabase(`test-${crypto.randomUUID()}`)
  repo = createRepo(database, scheduler)
})
afterEach(async () => {
  await database.delete()
})

const input = (term: string, meaningVi: string, extra: Partial<ItemInput> = {}): ItemInput => ({
  term,
  partOfSpeech: 'adjective',
  meaningVi,
  examples: [],
  acceptedAnswers: [],
  tags: [],
  favorite: false,
  difficult: false,
  ...extra,
})

const T0 = Date.parse('2026-10-24T08:00:00Z')

describe('repo — mục học và bộ từ', () => {
  it('tạo từ trong bộ, chuẩn hóa nội dung và xếp hàng đồng bộ', async () => {
    const deck = await repo.createDeck({ name: '  IELTS  ' }, T0)
    const id = await repo.createItem(input('  Resilient ', ' kiên cường ', { examples: [{ en: ' She is resilient. ', vi: '' }, { en: '  ' }] }), [deck], T0)
    const item = (await database.vocabItems.get(id))!
    expect(item).toMatchObject({ term: 'Resilient', termKey: 'resilient', meaningVi: 'kiên cường', examples: [{ en: 'She is resilient.', vi: undefined }] })
    expect((await database.decks.get(deck))!.name).toBe('IELTS')
    expect(await database.deckItems.where('deckId').equals(deck).count()).toBe(1)
    const queued = await database.outbox.toArray()
    expect(queued.map((q) => q.table).sort()).toEqual(['deckItems', 'decks', 'vocabItems'])
  })

  it('phát hiện trùng khi thêm (R2.5)', async () => {
    await repo.createItem(input('run', 'chạy', { partOfSpeech: 'verb' }))
    const exact = await repo.duplicatesOf({ term: 'Run', partOfSpeech: 'verb', meaningVi: 'chạy' })
    expect(exact[0].kind).toBe('exact')
    const other = await repo.duplicatesOf({ term: 'run', partOfSpeech: 'verb', meaningVi: 'điều hành' })
    expect(other[0].kind).toBe('same_term')
  })

  it('xóa bộ từ thì từ vẫn còn trong sổ tay (R3.3)', async () => {
    const deck = await repo.createDeck({ name: 'A' })
    const id = await repo.createItem(input('meticulous', 'tỉ mỉ'), [deck])
    await repo.deleteDeck(deck)
    const lib = await loadLibrary(database)
    expect(lib.decks).toHaveLength(0)
    expect(lib.itemById.has(id)).toBe(true)
    expect(lib.members.get(id)).toBeUndefined()
  })

  it('thêm từ vào nhiều bộ không tạo liên kết trùng (R3.4)', async () => {
    const a = await repo.createDeck({ name: 'A' })
    const b = await repo.createDeck({ name: 'B' })
    const id = await repo.createItem(input('x', 'y'), [a])
    await repo.addToDeck(a, [id])
    await repo.addToDeck(b, [id])
    const lib = await loadLibrary(database)
    expect([...lib.members.get(id)!].sort()).toEqual([a, b].sort())
    await repo.moveToDeck(a, b, [id])
    expect([...(await loadLibrary(database)).members.get(id)!]).toEqual([b])
  })

  it('sửa từ có chọn học lại từ đầu thì mất lịch ôn (R2.3)', async () => {
    const id = await repo.createItem(input('ubiquitous', 'phổ biến'))
    await database.cardStates.put(await repo.scheduledCard(id, Rating.Good, T0))
    await repo.updateItem(id, input('ubiquitous', 'có mặt khắp nơi'), { resetProgress: true })
    expect((await loadLibrary(database)).cards.has(id)).toBe(false)
  })

  it('xóa từ thì xóa luôn liên kết bộ từ và lịch ôn (R2.4)', async () => {
    const deck = await repo.createDeck({ name: 'A' })
    const id = await repo.createItem(input('a', 'b'), [deck])
    await database.cardStates.put(await repo.scheduledCard(id, Rating.Good, T0))
    await repo.deleteItems([id])
    const lib = await loadLibrary(database)
    expect(lib.items).toHaveLength(0)
    expect(lib.deckItems).toHaveLength(0)
    expect(lib.cards.size).toBe(0)
  })
})

describe('repo — lưu từ từ nguồn có sẵn (R2.8)', () => {
  it('lưu nhiều nghĩa vào bộ đã chọn; nghĩa đã có thì chỉ thêm vào bộ; nghĩa lặp trong lần lưu chỉ tạo một', async () => {
    const deck = await repo.createDeck({ name: 'Tra từ' })
    const had = await repo.createItem(input('give up', 'từ bỏ', { partOfSpeech: 'phrasal_verb' }))
    const res = await repo.saveFromSource(
      [
        input('give up', 'Từ bỏ.', { partOfSpeech: 'phrasal_verb' }),
        input('give up', 'đầu hàng', { partOfSpeech: 'phrasal_verb', meaningEn: 'To surrender.', examples: [{ en: 'He gave himself up.' }] }),
        input('give up', 'nhường', { partOfSpeech: 'phrasal_verb' }),
        input('give up', 'Nhường', { partOfSpeech: 'phrasal_verb' }),
      ],
      [deck],
      T0,
    )
    expect(res.existing).toEqual([had])
    expect(res.created).toHaveLength(2)
    const lib = await loadLibrary(database)
    expect(lib.items.filter((i) => i.termKey === 'give up').map((i) => i.meaningVi).sort()).toEqual(['nhường', 'từ bỏ', 'đầu hàng'])
    expect(lib.itemById.get(res.created[0])).toMatchObject({ meaningEn: 'To surrender.', examples: [{ en: 'He gave himself up.' }] })
    for (const id of [had, ...res.created]) expect([...lib.members.get(id)!]).toEqual([deck])
  })
})

describe('repo — gộp từ trùng (R2.5, R11.4)', () => {
  it('giữ mục có tiến độ, bổ sung thông tin còn thiếu, chuyển bộ từ, xóa mục thừa', async () => {
    const a = await repo.createDeck({ name: 'A' })
    const b = await repo.createDeck({ name: 'B' })
    const learned = await repo.createItem(input('run', 'chạy', { partOfSpeech: 'verb', tags: ['Thể thao'] }), [a], T0 + 5)
    const extra = await repo.createItem(input('Run', 'Chạy.', { partOfSpeech: 'verb', note: 'ghi chú', favorite: true, tags: ['thể thao', 'IELTS'] }), [b], T0)
    await repo.createItem(input('run', 'điều hành', { partOfSpeech: 'verb' }), [], T0)
    await database.cardStates.put(await repo.scheduledCard(learned, Rating.Good, T0))

    expect(await repo.mergeDuplicates(T0 + 100)).toEqual({ groups: 1, removed: 1 })
    const lib = await loadLibrary(database)
    expect(lib.items).toHaveLength(2)
    expect(lib.itemById.has(extra)).toBe(false)
    expect(lib.itemById.get(learned)).toMatchObject({ note: 'ghi chú', favorite: true, tags: ['Thể thao', 'IELTS'] })
    expect([...lib.members.get(learned)!].sort()).toEqual([a, b].sort())
    expect(lib.cards.get(learned)!.reps).toBe(1)
    expect(await repo.mergeDuplicates()).toEqual({ groups: 0, removed: 0 })
  })
})

describe('repo — học và ôn', () => {
  it('ghi lượt trả lời, lập lịch ôn và lưu tiến trình buổi', async () => {
    const id = await repo.createItem(input('resilient', 'kiên cường'))
    const plan = planLearn([id], () => 'mcq_meaning', T0)
    const session = await repo.startSession(plan, T0)
    let p = applyAction(plan, { type: 'intro_next' }).plan
    const step = p.steps[p.cursor]
    const r = applyAction(p, { type: 'answer', result: { kind: 'answer', exercise: 'mcq_meaning', correct: true } })
    p = r.plan
    const { card } = await repo.recordStep(session, step, r.effect, p, { at: T0 + 60_000, responseMs: 2400 })

    expect(card).toMatchObject({ id, reps: 1 })
    const logs = await database.reviewLogs.toArray()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ itemId: id, grade: Rating.Good, affectsSchedule: true, mode: 'learn', responseMs: 2400 })
    expect((await database.studySessions.get(session.id))!.plan.cursor).toBe(2)
    const queued = (await database.outbox.toArray()).map((q) => q.table)
    expect(queued).toContain('reviewLogs')
    expect(queued).toContain('cardStates')
  })

  it('chỉ một buổi đang mở: bắt đầu buổi mới thì buổi cũ bị bỏ dở', async () => {
    const s1 = await repo.startSession(planReview(['a'], () => 'mcq_meaning', T0), T0)
    const s2 = await repo.startSession(planReview(['b'], () => 'mcq_meaning', T0 + 1), T0 + 1)
    expect((await database.studySessions.get(s1.id))!.status).toBe('abandoned')
    expect((await repo.activeSession())!.id).toBe(s2.id)
  })

  it('phạm vi học: bỏ từ đã học, từ lưu trữ và từ chỉ thuộc bộ đã tắt', async () => {
    const on = await repo.createDeck({ name: 'on' })
    const off = await repo.createDeck({ name: 'off' })
    await repo.updateDeck(off, { active: false })
    const a = await repo.createItem(input('a', '1'), [on], T0)
    const b = await repo.createItem(input('b', '2'), [off], T0 + 1)
    const c = await repo.createItem(input('c', '3'), [], T0 + 2)
    const d = await repo.createItem(input('d', '4'), [on], T0 + 3)
    await repo.setItemFlags(d, { archived: true })
    const e = await repo.createItem(input('e', '5'), [on], T0 + 4)
    await database.cardStates.put(await repo.scheduledCard(e, Rating.Good, T0))

    const lib = await loadLibrary(database)
    expect(learnCandidates(lib).map((i) => i.id)).toEqual([a, c])
    expect(learnCandidates(lib, [off]).map((i) => i.id)).toEqual([b])
  })

  it('hàng đợi ôn: chỉ từ đến hạn, ưu tiên từ dễ quên nhất, có giới hạn (R5.2, R5.6)', async () => {
    const ids = await Promise.all(['a', 'b', 'c'].map((t, i) => repo.createItem(input(t, String(i)))))
    // a: ôn lâu rồi (quá hạn nhiều), b: vừa đến hạn, c: chưa đến hạn
    await database.cardStates.put(await repo.scheduledCard(ids[0], Rating.Good, T0 - 40 * 86_400_000))
    await database.cardStates.put(await repo.scheduledCard(ids[1], Rating.Good, T0 - 3 * 86_400_000))
    await database.cardStates.put(await repo.scheduledCard(ids[2], Rating.Easy, T0))
    const lib = await loadLibrary(database)
    const q = dueQueue(lib, scheduler, T0)
    expect(q.map((c) => c.id)).toEqual([ids[0], ids[1]])
    expect(dueQueue(lib, scheduler, T0, 1).map((c) => c.id)).toEqual([ids[0]])
    expect(nextDueAt(lib, T0)).toBe(lib.cards.get(ids[2])!.due)
  })
})
