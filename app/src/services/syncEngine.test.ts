import 'fake-indexeddb/auto'
import type { PGlite } from '@electric-sql/pglite'
import { Rating, type Grade } from 'ts-fsrs'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { SelfRating } from '../core/grading'
import { createScheduler, replayReviews } from '../core/scheduler'
import { applyAction, planReview } from '../core/session'
import { VocabDatabase } from '../db/db'
import { PROFILE_ID } from '../db/types'
import { loadLibrary } from '../db/library'
import { createRepo, type ItemInput } from '../db/repo'
import { bindAccount, pullStart, pushOutbox, syncOnce } from './syncEngine'
import { addUser, asUser, startTestServer, testRemote } from './testServer'

/**
 * Mô phỏng hai thiết bị (điện thoại và máy tính) đồng bộ qua máy chủ chạy đúng schema Supabase (R11.5, R11.7).
 * Điều kiện "xong" của giai đoạn 2: học xen kẽ trên hai thiết bị không mất và không nhân đôi lượt học.
 */

const scheduler = createScheduler()
const T0 = Date.parse('2026-10-24T08:00:00Z')
const DAY = 86_400_000
let pg: PGlite
let user: string
let clock: number
const opened: VocabDatabase[] = []

beforeAll(async () => {
  pg = await startTestServer()
}, 60_000)
beforeEach(async () => {
  user = await addUser(pg)
  clock = T0
})
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

function device() {
  const db = new VocabDatabase(`device-${crypto.randomUUID()}`)
  opened.push(db)
  const repo = createRepo(db, scheduler)
  const remote = testRemote(pg, user)
  return { db, repo, remote, sync: () => syncOnce(db, remote, { scheduler, now: () => clock, userId: user }) }
}
type Device = ReturnType<typeof device>

const input = (term: string, meaningVi: string, extra: Partial<ItemInput> = {}): ItemInput => ({
  term,
  partOfSpeech: 'verb',
  meaningVi,
  examples: [],
  acceptedAnswers: [],
  tags: [],
  favorite: false,
  difficult: false,
  ...extra,
})

/** Một lượt ôn bằng thẻ tự đánh giá, đi đúng đường ghi của app. */
async function review(dev: Device, itemId: string, rating: SelfRating, at: number) {
  const plan = planReview([itemId], () => 'flashcard', at)
  const session = await dev.repo.startSession(plan, at)
  const step = plan.steps[plan.cursor]
  const r = applyAction(plan, { type: 'answer', result: { kind: 'self_rating', rating } })
  await dev.repo.recordStep(session, step, r.effect, r.plan, { at, responseMs: 1500 })
}

/** Đồng bộ lần lượt cho tới khi mọi thiết bị có cùng dữ liệu. */
async function settle(...devs: Device[]) {
  for (let round = 0; round < 2; round++) for (const d of devs) await d.sync()
}

async function snapshot(db: VocabDatabase) {
  const byId = <T extends { id: string }>(rows: T[]) => rows.sort((a, b) => (a.id < b.id ? -1 : 1))
  return {
    items: byId(await db.vocabItems.toArray()),
    decks: byId(await db.decks.toArray()),
    deckItems: byId(await db.deckItems.toArray()),
    cards: byId(await db.cardStates.toArray()),
    logs: byId(await db.reviewLogs.toArray()),
  }
}

async function serverCount(table: string): Promise<number> {
  return asUser(pg, user, async () => (await pg.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0].n)
}

describe('đồng bộ hai thiết bị qua máy chủ', () => {
  it('thiết bị mới đăng nhập nhận đủ từ, bộ, tiến độ và lịch sử học', async () => {
    const phone = device()
    const deck = await phone.repo.createDeck({ name: 'IELTS' }, T0)
    const ids = [
      await phone.repo.createItem(input('run', 'chạy'), [deck], T0),
      await phone.repo.createItem(input('resilient', 'kiên cường', { partOfSpeech: 'adjective', examples: [{ en: 'Kids are resilient.' }] }), [deck], T0 + 1),
      await phone.repo.createItem(input('thrive', 'phát triển mạnh'), [deck], T0 + 2),
    ]
    await review(phone, ids[0], 'good', T0 + 60_000)
    await review(phone, ids[1], 'again', T0 + 120_000)
    await phone.sync()

    const laptop = device()
    const res = await laptop.sync()
    // hồ sơ (máy chủ tạo sẵn khi có tài khoản) + 3 từ + 1 bộ + 3 liên kết + 2 lượt trả lời + 2 lịch ôn
    expect(res.received).toBe(1 + 3 + 1 + 3 + 2 + 2)
    expect(await snapshot(laptop.db)).toEqual(await snapshot(phone.db))
    const lib = await loadLibrary(laptop.db)
    expect(lib.items).toHaveLength(3)
    expect(lib.cards.size).toBe(2)
    expect([...lib.members.get(ids[2])!]).toEqual([deck])
  })

  it('hai máy cùng ôn một từ khi mất mạng: giữ đủ lượt, lịch ôn tính từ lượt của cả hai', async () => {
    const phone = device()
    const laptop = device()
    const id = await phone.repo.createItem(input('meticulous', 'tỉ mỉ'), [], T0)
    await review(phone, id, 'good', T0 + 1000)
    await settle(phone, laptop)

    // Cả hai cùng ôn trước khi kịp đồng bộ.
    await review(phone, id, 'good', T0 + 3 * DAY)
    await review(laptop, id, 'again', T0 + 3 * DAY + 3_600_000)
    await settle(phone, laptop)

    expect(await serverCount('review_logs')).toBe(3)
    for (const d of [phone, laptop]) expect(await d.db.reviewLogs.count()).toBe(3)
    const logs = (await phone.db.reviewLogs.toArray()).map((l) => ({ id: l.id, reviewedAt: new Date(l.reviewedAt), grade: l.grade as Grade }))
    const expected = replayReviews(scheduler, new Date(T0 + 1000), logs)
    const a = (await phone.db.cardStates.get(id))!
    const b = (await laptop.db.cardStates.get(id))!
    expect(a).toEqual(b)
    expect(a).toMatchObject({ reps: 3, lapses: expected.lapses, due: expected.due.getTime(), stability: expected.stability })
  })

  it('mỗi máy sửa một trường khác nhau thì giữ cả hai thay đổi', async () => {
    const phone = device()
    const laptop = device()
    const id = await phone.repo.createItem(input('run', 'chạy'), [], T0)
    await settle(phone, laptop)

    await laptop.repo.updateItem(id, input('run', 'chạy bộ'), {}, T0 + 5000)
    await phone.repo.setItemFlags(id, { favorite: true }, T0 + 9000)
    await settle(phone, laptop)

    for (const d of [phone, laptop]) expect(await d.db.vocabItems.get(id)).toMatchObject({ meaningVi: 'chạy bộ', favorite: true })
  })

  it('cùng sửa một trường: bản sửa sau thắng trên mọi máy, dù đồng bộ trước hay sau', async () => {
    const phone = device()
    const laptop = device()
    const id = await phone.repo.createItem(input('run', 'chạy'), [], T0)
    await settle(phone, laptop)

    await phone.repo.updateItem(id, input('run', 'điều hành'), {}, T0 + 9000)
    await laptop.repo.updateItem(id, input('run', 'chạy bộ'), {}, T0 + 5000)
    await laptop.sync() // bản cũ hơn lên máy chủ trước
    await settle(phone, laptop)

    for (const d of [phone, laptop]) expect((await d.db.vocabItems.get(id))!.meaningVi).toBe('điều hành')
  })

  it('xóa trên một máy trong khi máy kia đánh dấu từ: từ bị xóa ở cả hai', async () => {
    const phone = device()
    const laptop = device()
    const deck = await phone.repo.createDeck({ name: 'A' }, T0)
    const id = await phone.repo.createItem(input('run', 'chạy'), [deck], T0)
    await settle(phone, laptop)

    await phone.repo.deleteItems([id], T0 + 5000)
    await laptop.repo.setItemFlags(id, { difficult: true }, T0 + 9000)
    await settle(phone, laptop)

    for (const d of [phone, laptop]) {
      expect((await d.db.vocabItems.get(id))!.deletedAt).toBe(T0 + 5000)
      expect((await loadLibrary(d.db)).items).toHaveLength(0)
    }
  })

  it('máy kia thêm từ vào bộ, máy này xóa từ khác khỏi bộ: giữ cả hai', async () => {
    const phone = device()
    const laptop = device()
    const deck = await phone.repo.createDeck({ name: 'A' }, T0)
    const a = await phone.repo.createItem(input('a', '1'), [deck], T0)
    const b = await phone.repo.createItem(input('b', '2'), [], T0)
    await settle(phone, laptop)

    await phone.repo.removeFromDeck(deck, [a], T0 + 1000)
    await laptop.repo.addToDeck(deck, [b], T0 + 2000)
    await settle(phone, laptop)

    for (const d of [phone, laptop]) {
      const lib = await loadLibrary(d.db)
      expect(lib.members.get(a)).toBeUndefined()
      expect([...lib.members.get(b)!]).toEqual([deck])
    }
  })

  it('đồng bộ lặp lại không nhận, không gửi và không nhân đôi gì', async () => {
    const phone = device()
    const laptop = device()
    const id = await phone.repo.createItem(input('run', 'chạy'), [], T0)
    await review(phone, id, 'good', T0 + 1000)
    await settle(phone, laptop)
    const before = await snapshot(phone.db)

    for (const d of [phone, laptop, phone]) expect(await d.sync()).toEqual({ received: 0, sent: 0, merged: 0, replayed: 0 })
    expect(await snapshot(phone.db)).toEqual(before)
    expect(await serverCount('review_logs')).toBe(1)
    expect(await serverCount('vocab_items')).toBe(1)
  })

  it('lịch ôn bị máy khác ghi đè (gửi gần như cùng lúc) vẫn được tính lại đủ lượt', async () => {
    const phone = device()
    const laptop = device()
    const id = await phone.repo.createItem(input('run', 'chạy'), [], T0)
    await review(phone, id, 'good', T0 + 1000)
    await settle(phone, laptop)

    await review(laptop, id, 'good', T0 + 2 * DAY)
    await laptop.sync()
    // Điện thoại gửi ngay sau khi máy tính gửi, trước khi kịp kéo về: lịch ôn trên máy chủ thiếu lượt của máy tính.
    await review(phone, id, 'hard', T0 + 2 * DAY + 600_000)
    while ((await pushOutbox(phone.db, phone.remote, user)).processed > 0);
    await settle(laptop, phone)

    const a = (await phone.db.cardStates.get(id))!
    const b = (await laptop.db.cardStates.get(id))!
    expect(a.reps).toBe(3)
    expect(a).toEqual(b)
  })

  it('cùng nhập một danh sách trên hai máy: thấy từ trùng, gộp ở một máy thì máy kia cũng hết trùng', async () => {
    const phone = device()
    const laptop = device()
    const list = [{ input: input('run', 'chạy') }, { input: input('thrive', 'phát triển mạnh') }]
    await phone.repo.importItems(list, { kind: 'newDeck', name: 'Cơ bản' }, T0)
    await laptop.repo.importItems(list, { kind: 'newDeck', name: 'Cơ bản' }, T0 + 1)
    await settle(phone, laptop)
    expect((await loadLibrary(laptop.db)).items).toHaveLength(4)

    expect(await laptop.repo.mergeDuplicates(T0 + 1000)).toEqual({ groups: 2, removed: 2 })
    await settle(laptop, phone)
    for (const d of [phone, laptop]) expect((await loadLibrary(d.db)).items.map((i) => i.term).sort()).toEqual(['run', 'thrive'])
  })

  it('nhiều hơn một trang (hơn 1.000 dòng ghi cùng lúc) vẫn kéo về đủ', async () => {
    const phone = device()
    const entries = Array.from({ length: 1005 }, (_, i) => ({ input: input(`word${i}`, `nghĩa ${i}`) }))
    await phone.repo.importItems(entries, { kind: 'none' }, T0)
    await phone.sync()
    const laptop = device()
    await laptop.sync()
    expect(await laptop.db.vocabItems.count()).toBe(1005)
  }, 60_000)

  it('đăng nhập tài khoản khác thì đồng bộ lại từ đầu', async () => {
    const phone = device()
    expect(await bindAccount(phone.db, 'user-a')).toBe(false)
    await phone.db.meta.put({ key: 'sync:cursor:decks', value: { ts: '2026-10-24T08:00:00Z', id: 'x', pulledAt: T0 } })
    expect(await bindAccount(phone.db, 'user-a')).toBe(false)
    expect(await phone.db.meta.get('sync:cursor:decks')).toBeDefined()
    expect(await bindAccount(phone.db, 'user-b')).toBe(true)
    expect(await phone.db.meta.get('sync:cursor:decks')).toBeUndefined()
  })
})

describe('hồ sơ, mục tiêu và cài đặt học đồng bộ giữa các máy (R1.4, R1.5, R9.2, R14.2)', () => {
  const profileOf = async (dev: Device) => {
    const p = (await dev.db.profiles.get(PROFILE_ID))!
    return { ...p, createdAt: 0, updatedAt: 0 }
  }

  it('máy mới đăng nhập nhận hồ sơ, mục tiêu, lịch học và cài đặt học', async () => {
    const phone = device()
    await phone.repo.updateProfile(
      { displayName: 'Mạnh', selfLevel: 'intermediate', learningPurpose: 'Thi IELTS/TOEIC, Công việc', dailyNewWords: 20, dailyMinutes: 30, studyWeekdays: [1, 2, 3, 4, 5], studyTime: '20:30', timeZone: 'Asia/Ho_Chi_Minh', reviewStyle: 'flashcard', accent: 'uk' },
      T0 + 1000,
    )
    await phone.sync()
    const laptop = device()
    await laptop.sync()
    expect(await profileOf(laptop)).toEqual(await profileOf(phone))
    expect(await profileOf(laptop)).toMatchObject({ displayName: 'Mạnh', dailyNewWords: 20, studyWeekdays: [1, 2, 3, 4, 5], studyTime: '20:30', reviewStyle: 'flashcard', accent: 'uk' })
  })

  it('hai máy sửa hai mục khác nhau thì giữ cả hai', async () => {
    const phone = device()
    const laptop = device()
    await phone.repo.updateProfile({ displayName: 'Mạnh' }, T0 + 1000)
    await settle(phone, laptop)
    await phone.repo.updateProfile({ dailyNewWords: 15 }, T0 + 5000)
    await laptop.repo.updateProfile({ reviewLimit: 100 }, T0 + 9000)
    await settle(phone, laptop)
    for (const d of [phone, laptop]) expect(await profileOf(d)).toMatchObject({ displayName: 'Mạnh', dailyNewWords: 15, reviewLimit: 100 })
  })

  it('máy chưa từng đồng bộ sửa một cài đặt thì không xóa hồ sơ đang có trên máy chủ', async () => {
    const phone = device()
    await phone.repo.updateProfile({ displayName: 'Mạnh', dailyMinutes: 45, studyWeekdays: [1, 3, 5] }, T0 + 1000)
    await phone.sync()
    const laptop = device()
    await laptop.repo.updateProfile({ accent: 'uk' }, T0 + 9000) // trước lần đồng bộ đầu tiên
    await settle(laptop, phone)
    for (const d of [phone, laptop]) expect(await profileOf(d)).toMatchObject({ displayName: 'Mạnh', dailyMinutes: 45, studyWeekdays: [1, 3, 5], accent: 'uk' })
  })
})

describe('pullStart — không sót dòng ghi xong muộn', () => {
  const saved = { ts: '2026-10-24T08:00:00.123456+00:00', id: '7d0c3b1e-0000-4000-8000-000000000001' }

  it('lần đầu kéo từ đầu', () => {
    expect(pullStart(undefined).ts).toBe('1970-01-01T00:00:00Z')
  })

  it('lần kéo trước sát dòng mới nhất thì lùi lại một khoảng', () => {
    const at = Date.parse('2026-10-24T08:00:10Z')
    expect(pullStart({ ...saved, pulledAt: at })).toEqual({ ts: new Date(at - 60_000).toISOString(), id: '00000000-0000-0000-0000-000000000000' })
  })

  it('dữ liệu đã yên từ lâu thì kéo tiếp từ vị trí đã lưu', () => {
    expect(pullStart({ ...saved, pulledAt: Date.parse('2026-10-24T09:00:00Z') })).toEqual(saved)
  })
})

describe('khi lỗi mạng giữa chừng', () => {
  it('gửi lỗi thì giữ hàng đợi, lần sau gửi lại đủ', async () => {
    const phone = device()
    const id = await phone.repo.createItem(input('run', 'chạy'), [], T0)
    await review(phone, id, 'good', T0 + 1000)
    const failing = { ...phone.remote, upsert: async () => Promise.reject(new Error('mất mạng')) }
    await expect(syncOnce(phone.db, failing, { scheduler, now: () => clock, userId: user })).rejects.toThrow('mất mạng')
    expect(await phone.db.outbox.count()).toBeGreaterThan(0)
    await phone.sync()
    expect(await phone.db.outbox.count()).toBe(0)
    expect(await serverCount('review_logs')).toBe(1)
    expect(await serverCount('card_states')).toBe(1)
    expect(Rating.Good).toBe((await phone.db.reviewLogs.toArray())[0].grade)
  })
})
