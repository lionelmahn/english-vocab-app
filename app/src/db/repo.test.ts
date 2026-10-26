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

  it('tạm dừng ôn và học lại từ đầu nhiều từ một lúc (R5.8)', async () => {
    const a = await repo.createItem(input('alpha', 'a'))
    const b = await repo.createItem(input('beta', 'b'))
    const fresh = await repo.createItem(input('gamma', 'c'))
    for (const id of [a, b]) await database.cardStates.put(await repo.scheduledCard(id, Rating.Good, T0 - 3 * 86_400_000))
    expect(await repo.setSuspended([a, b, fresh], true, T0)).toBe(2)
    expect(await repo.setSuspended([a], true, T0)).toBe(0)
    let lib = await loadLibrary(database)
    expect(dueQueue(lib, scheduler, T0 + 30 * 86_400_000)).toHaveLength(0)
    await repo.setSuspended([b], false, T0)
    lib = await loadLibrary(database)
    expect(dueQueue(lib, scheduler, T0 + 30 * 86_400_000).map((c) => c.id)).toEqual([b])

    expect(await repo.resetProgress([a, fresh], T0)).toBe(1)
    lib = await loadLibrary(database)
    expect(lib.cards.has(a)).toBe(false)
    expect(learnCandidates(lib).map((i) => i.id)).toContain(a)
    // Học lại: thẻ mới có ngày tạo mới, không tính các lượt cũ.
    const again = await repo.scheduledCard(a, Rating.Good, T0 + 1000)
    expect(again.createdAt).toBe(T0 + 1000)
    expect(again.reps).toBe(1)
  })

  it('sao chép bộ từ: bộ mới cùng các từ theo thứ tự, bỏ từ đã xóa; thêm bớt ở bản sao không ảnh hưởng bộ gốc (R3.5)', async () => {
    const deck = await repo.createDeck({ name: 'IELTS', description: 'mô tả', topic: 'thi' }, T0)
    const a = await repo.createItem(input('alpha', 'a'), [deck], T0)
    const b = await repo.createItem(input('beta', 'b'), [deck], T0)
    const c = await repo.createItem(input('gamma', 'c'), [deck], T0)
    await repo.deleteItems([b], T0)
    const copy = (await repo.copyDeck(deck, T0 + 1))!
    let lib = await loadLibrary(database)
    expect(lib.deckById.get(copy)).toMatchObject({ name: 'IELTS (bản sao)', description: 'mô tả', topic: 'thi', active: true, archived: false })
    const order = (id: string) => lib.deckItems.filter((d) => d.deckId === id).sort((x, y) => x.position - y.position).map((d) => d.itemId)
    expect(order(copy)).toEqual([a, c])
    await repo.removeFromDeck(copy, [a], T0 + 2)
    lib = await loadLibrary(database)
    expect(order(copy)).toEqual([c])
    expect(order(deck)).toEqual([a, c])
    expect(await repo.copyDeck('khong-co')).toBeNull()
  })

  it('lịch sử tra: mỗi từ một dòng, tra lại thì cập nhật thời điểm; xóa từng từ hoặc xóa hết (R15.4)', async () => {
    await repo.recordLookup('  give   up ', T0)
    await repo.recordLookup('resilient', T0 + 1)
    await repo.recordLookup('give up', T0 + 2)
    await repo.recordLookup('   ', T0 + 3)
    let live = (await database.lookupHistory.toArray()).filter((e) => e.deletedAt === null).sort((x, y) => y.lookedUpAt - x.lookedUpAt)
    expect(live.map((e) => [e.query, e.lookedUpAt, e.updatedAt])).toEqual([
      ['give up', T0 + 2, T0 + 2],
      ['resilient', T0 + 1, T0 + 1],
    ])
    expect((await database.outbox.toArray()).filter((q) => q.table === 'lookupHistory')).not.toHaveLength(0)
    expect(await repo.clearLookups([live[1].id], T0 + 4)).toBe(1)
    live = (await database.lookupHistory.toArray()).filter((e) => e.deletedAt === null)
    expect(live.map((e) => e.query)).toEqual(['give up'])
    expect(await repo.clearLookups(undefined, T0 + 5)).toBe(1)
    expect((await database.lookupHistory.toArray()).every((e) => e.deletedAt !== null && e.updatedAt >= e.lookedUpAt)).toBe(true)
  })

  it('lưu mẹo nhớ AI gợi ý; thêm câu ví dụ không trùng, tối đa 5 câu (R8.3, R8.4)', async () => {
    const id = await repo.createItem(input('resilient', 'kiên cường', { examples: [{ en: 'She is resilient.' }] }), [], T0)
    await repo.setMnemonic(id, '  Cây cau bị gió quật lại đứng thẳng  ', T0 + 1)
    expect((await database.vocabItems.get(id))!.mnemonic).toBe('Cây cau bị gió quật lại đứng thẳng')
    const added = await repo.addExamples(
      id,
      [
        { en: 'she is  RESILIENT.', vi: 'trùng' },
        { en: 'Kids are resilient.', vi: 'Trẻ con kiên cường.' },
        { en: 'Teams must be resilient.' },
        { en: 'Be resilient at work.', vi: '' },
        { en: 'Stay resilient.' },
        { en: 'One too many.' },
      ],
      T0 + 2,
    )
    const item = (await database.vocabItems.get(id))!
    expect(added).toBe(4)
    expect(item.examples.map((e) => e.en)).toEqual(['She is resilient.', 'Kids are resilient.', 'Teams must be resilient.', 'Be resilient at work.', 'Stay resilient.'])
    expect(item.examples[1].vi).toBe('Trẻ con kiên cường.')
    expect(item.examples[3].vi).toBeUndefined()
    expect(await repo.addExamples(id, [{ en: 'More.' }], T0 + 3)).toBe(0)
    await repo.setMnemonic(id, '', T0 + 4)
    expect((await database.vocabItems.get(id))!.mnemonic).toBeUndefined()
  })

  it('báo đáp án của mình cũng đúng: thêm vào đáp án chấp nhận, không thêm trùng (R6.13)', async () => {
    const id = await repo.createItem(input('large', 'lớn', { acceptedAnswers: ['huge'] }))
    expect(await repo.addAcceptedAnswer(id, '  big  ', T0)).toBe(true)
    expect(await repo.addAcceptedAnswer(id, 'BIG', T0)).toBe(false)
    expect(await repo.addAcceptedAnswer(id, 'Large', T0)).toBe(false)
    expect(await repo.addAcceptedAnswer(id, ' ', T0)).toBe(false)
    const item = (await database.vocabItems.get(id))!
    expect(item.acceptedAnswers).toEqual(['huge', 'big'])
    expect(item.updatedAt).toBe(T0)
    expect((await database.outbox.toArray()).filter((q) => q.table === 'vocabItems')).not.toHaveLength(0)
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

describe('repo — bộ từ khởi đầu (R1.7)', () => {
  it('tạo bộ, giữ thứ tự, từ đã có chỉ đưa vào bộ; thêm lại không nhân đôi', async () => {
    const had = await repo.createItem(input('the', '(mạo từ xác định) chỉ người, vật đã biết', { partOfSpeech: 'other' }), [], T0)
    const words = [input('the', '(mạo từ xác định) chỉ người, vật đã biết', { partOfSpeech: 'other' }), input('be', 'thì, là, ở', { partOfSpeech: 'verb' }), input('and', 'và', { partOfSpeech: 'conjunction' })]
    const first = await repo.addStarterDeck('1.000 từ thông dụng nhất', words, T0 + 10)
    expect(first).toMatchObject({ created: 2, existing: 1 })
    const again = await repo.addStarterDeck('1.000 từ thông dụng nhất', words, T0 + 20)
    expect(again).toMatchObject({ deckId: first.deckId, created: 0, existing: 3 })
    const lib = await loadLibrary(database)
    expect(lib.decks).toHaveLength(1)
    expect(lib.items).toHaveLength(3)
    expect(lib.deckItems.filter((d) => d.deckId === first.deckId)).toHaveLength(3)
    expect(lib.itemById.get(had)).toBeDefined()
    const ordered = lib.items.filter((i) => i.id !== had).sort((a, b) => a.createdAt - b.createdAt).map((i) => i.term)
    expect(ordered).toEqual(['be', 'and'])
  })

  it('điền phiên âm còn trống cho từ đã có (từ của bộ hoặc trùng hẳn nghĩa), không sửa phiên âm đã có', async () => {
    const NGSL = 'NGSL 1.2 (CC BY-SA 4.0)'
    const be = await repo.createItem(input('be', 'là', { partOfSpeech: 'verb', source: NGSL }), [], T0)
    const and = await repo.createItem(input('and', 'và', { partOfSpeech: 'conjunction', source: NGSL, ipaUk: '/ənd/' }), [], T0)
    const the = await repo.createItem(input('the', '(mạo từ xác định) chỉ người, vật đã biết', { partOfSpeech: 'other' }), [], T0)
    const lead = await repo.createItem(input('lead', 'chì', { partOfSpeech: 'verb' }), [], T0)
    const gone = await repo.createItem(input('have', 'có', { partOfSpeech: 'verb', source: NGSL }), [], T0)
    await repo.deleteItems([gone], T0 + 1)
    const word = (term: string, partOfSpeech: ItemInput['partOfSpeech'], meaningVi: string, ipaUs: string, ipaUk: string) =>
      input(term, meaningVi, { partOfSpeech, source: NGSL, ipaUs, ipaUk })
    const words = [
      word('the', 'other', '(mạo từ xác định) chỉ người, vật đã biết', '/ði/', '/ðiː/'),
      word('be', 'verb', 'thì, là, ở', '/bi/', '/biː/'),
      word('and', 'conjunction', 'và', '/ænd/', '/ænd/'),
      word('lead', 'verb', 'dẫn dắt', '/lid/', '/liːd/'),
      word('have', 'verb', 'có', '/hæv/', '/hæv/'),
    ]
    expect(await repo.fillMissingIpa(words, T0 + 50)).toBe(3)
    const get = async (id: string) => (await database.vocabItems.get(id))!
    expect(await get(be)).toMatchObject({ meaningVi: 'là', ipaUs: '/bi/', ipaUk: '/biː/', updatedAt: T0 + 50 })
    expect(await get(and)).toMatchObject({ ipaUs: '/ænd/', ipaUk: '/ənd/' })
    expect(await get(the)).toMatchObject({ ipaUs: '/ði/', ipaUk: '/ðiː/' })
    expect((await get(lead)).ipaUs).toBeUndefined()
    expect((await get(gone)).ipaUs).toBeUndefined()
    expect(await database.outbox.filter((o) => o.table === 'vocabItems' && o.rowId === be && o.at === T0 + 50).count()).toBe(1)
    expect(await repo.fillMissingIpa(words, T0 + 60)).toBe(0)
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

  it('thứ tự học từ mới: xen kẽ đều các bộ và nhóm từ không thuộc bộ nào', async () => {
    const term = (t: string) => input(t, t)
    // Bộ A đã học 2 từ đầu; bộ B thêm sau; vài từ tự lưu không thuộc bộ nào.
    const A = await repo.createDeck({ name: 'A' }, T0)
    const B = await repo.createDeck({ name: 'B' }, T0 + 10)
    const a = await repo.saveFromSource(['a1', 'a2', 'a3', 'a4'].map(term), [A], T0)
    for (const id of a.created.slice(0, 2)) await database.cardStates.put(await repo.scheduledCard(id, Rating.Good, T0))
    const n1 = await repo.createItem(term('n1'), [], T0 + 20)
    const b = await repo.saveFromSource(['b1', 'b2', 'b3'].map(term), [B], T0 + 30)
    const n2 = await repo.createItem(term('n2'), [], T0 + 40)
    // Một từ nằm ở cả hai bộ: chỉ lấy một lần.
    const both = await repo.createItem(term('ab'), [A, B], T0 + 50)

    const lib = await loadLibrary(database)
    const terms = (ids: { term: string }[]) => ids.map((i) => i.term)
    expect(terms(learnCandidates(lib))).toEqual(['a3', 'b1', 'n1', 'a4', 'b2', 'n2', 'ab', 'b3'])
    // Chọn riêng một bộ: đúng thứ tự trong bộ đó.
    expect(terms(learnCandidates(lib, [B]))).toEqual(['b1', 'b2', 'b3', 'ab'])
    expect(learnCandidates(lib).map((i) => i.id)).toContain(both)
    expect([n1, n2, ...b.created].every((id) => learnCandidates(lib).some((i) => i.id === id))).toBe(true)
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
