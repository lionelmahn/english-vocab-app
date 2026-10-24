import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { SelfRating } from '../core/grading'
import { profileDefaults } from '../core/profile'
import { createScheduler } from '../core/scheduler'
import { applyAction, planReview } from '../core/session'
import { BACKUP_FORMAT, createBackup, previewRestore, readBackup, restoreBackup, type BackupFile } from './backup'
import { VocabDatabase } from './db'
import { loadLibrary } from './library'
import { createRepo, type ItemInput } from './repo'

const scheduler = createScheduler()
const T0 = Date.parse('2026-10-24T08:00:00Z')
const DAY = 86_400_000
const opened: VocabDatabase[] = []

afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

function device() {
  const db = new VocabDatabase(`backup-${crypto.randomUUID()}`)
  opened.push(db)
  return { db, repo: createRepo(db, scheduler) }
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

async function review(dev: Device, itemId: string, rating: SelfRating, at: number) {
  const plan = planReview([itemId], () => 'flashcard', at)
  const session = await dev.repo.startSession(plan, at)
  const r = applyAction(plan, { type: 'answer', result: { kind: 'self_rating', rating } })
  await dev.repo.recordStep(session, plan.steps[plan.cursor], r.effect, r.plan, { at, responseMs: 1200 })
}

/** Thiết bị có 1 bộ, 3 từ, 2 từ đã học; trả về bản sao lưu đã qua một vòng ghi file rồi đọc lại. */
async function sample() {
  const dev = device()
  const deck = await dev.repo.createDeck({ name: 'IELTS' }, T0)
  const ids = [
    await dev.repo.createItem(input('run', 'chạy'), [deck], T0),
    await dev.repo.createItem(input('resilient', 'kiên cường', { partOfSpeech: 'adjective', examples: [{ en: 'Kids are resilient.' }] }), [deck], T0 + 1),
    await dev.repo.createItem(input('thrive', 'phát triển mạnh'), [], T0 + 2),
  ]
  await review(dev, ids[0], 'good', T0 + 1000)
  await review(dev, ids[1], 'again', T0 + 2000)
  const file = await createBackup(dev.db, { appVersion: '0.6.0', settings: { dailyNewWords: 15 }, now: T0 + DAY })
  const read = readBackup(JSON.stringify(file))
  if (!read.ok) throw new Error(read.error)
  return { dev, deck, ids, file, backup: read.backup }
}

describe('sao lưu ra file (R11.3)', () => {
  it('gồm từ, bộ, liên kết, lịch ôn, lịch sử và cài đặt; bỏ mục đã xóa', async () => {
    const { dev, ids, file, backup } = await sample()
    expect(file.format).toBe(BACKUP_FORMAT)
    expect(backup.data.vocabItems).toHaveLength(3)
    expect(backup.data.deckItems).toHaveLength(2)
    expect(backup.data.cardStates).toHaveLength(2)
    expect(backup.data.reviewLogs).toHaveLength(2)
    expect(backup.settings).toEqual({ dailyNewWords: 15 })
    expect(backup.data).toEqual(file.data)

    await dev.repo.deleteItems([ids[0]], T0 + 5000)
    const after = await createBackup(dev.db, { appVersion: '0.6.0' })
    expect(after.data.vocabItems.map((i) => i.id)).not.toContain(ids[0])
    expect(after.data.reviewLogs).toHaveLength(1)
  })
})

describe('hồ sơ trong bản sao lưu', () => {
  it('ghi hồ sơ vào file và đọc lại đã làm sạch; file cũ không có hồ sơ vẫn đọc được', async () => {
    const dev = device()
    await dev.repo.createItem(input('run', 'chạy'), [], T0)
    const profile = { ...profileDefaults('Asia/Ho_Chi_Minh'), displayName: 'Mạnh', dailyNewWords: 20, studyWeekdays: [1, 3, 5] }
    const file = await createBackup(dev.db, { appVersion: '0.8.0', profile })
    const read = readBackup(JSON.stringify(file))
    expect(read.ok && read.backup.profile).toEqual(profile)
    const old = readBackup(JSON.stringify({ ...file, profile: undefined }))
    expect(old.ok && old.backup.profile).toBeUndefined()
  })
})

describe('kiểm tra bản sao (R11.4)', () => {
  it('từ chối file không phải bản sao lưu, hoặc của phiên bản app mới hơn', () => {
    expect(readBackup('không phải json')).toMatchObject({ ok: false })
    expect(readBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, error: expect.stringContaining('không phải bản sao lưu') })
    expect(readBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} }))).toMatchObject({ ok: false, error: expect.stringContaining('mới hơn') })
  })

  it('bỏ qua và đếm dòng hỏng hoặc trỏ tới dữ liệu không có trong file', async () => {
    const { file } = await sample()
    const broken: BackupFile = JSON.parse(JSON.stringify(file))
    broken.data.vocabItems.push({ ...broken.data.vocabItems[0], id: 'not-a-uuid' })
    broken.data.vocabItems.push({ ...broken.data.vocabItems[0], term: '   ' })
    broken.data.reviewLogs.push({ ...broken.data.reviewLogs[0], id: crypto.randomUUID(), itemId: crypto.randomUUID() })
    broken.data.cardStates.push({ ...broken.data.cardStates[0], state: 7 as never })
    const read = readBackup(JSON.stringify(broken))
    expect(read.ok && read.invalid).toBe(4)
    expect(read.ok && read.backup.data.vocabItems).toHaveLength(3)
  })

  it('xem trước: từ mới, từ đã xóa ở máy này, từ trùng nội dung, từ chỉ có ở máy này', async () => {
    const { backup, ids } = await sample()
    const other = device()
    await other.repo.createItem(input('Run', 'chạy'), [], T0) // trùng nội dung với "run" trong bản sao lưu
    await other.repo.createItem(input('walk', 'đi bộ'), [], T0)
    await restoreBackup(other.db, { ...backup, data: { ...backup.data, vocabItems: backup.data.vocabItems.filter((i) => i.id === ids[2]) } }, { mode: 'merge', duplicates: 'keep' }, scheduler, T0)
    await other.repo.deleteItems([ids[2]], T0 + 10)
    expect(await previewRestore(other.db, backup)).toEqual({ newItems: 1, deletedHere: 1, existing: 0, duplicates: 1, onlyHere: 2, newLogs: 2 })
  })
})

describe('khôi phục (R11.4)', () => {
  it('khôi phục vào thiết bị trống: có lại đủ từ, bộ, tiến độ và lịch sử', async () => {
    const { dev, backup } = await sample()
    const fresh = device()
    const res = await restoreBackup(fresh.db, backup, { mode: 'merge', duplicates: 'skip' }, scheduler, T0 + 2 * DAY)
    expect(res).toMatchObject({ added: 3, skipped: 0, logs: 2, replayed: 0 })
    const [a, b] = [await loadLibrary(dev.db), await loadLibrary(fresh.db)]
    expect(b.items.map((i) => i.term).sort()).toEqual(a.items.map((i) => i.term).sort())
    expect(b.decks.map((d) => d.name)).toEqual(['IELTS'])
    expect([...b.cards.values()].map((c) => [c.id, c.due, c.reps]).sort()).toEqual([...a.cards.values()].map((c) => [c.id, c.due, c.reps]).sort())
    expect(await fresh.db.reviewLogs.count()).toBe(2)
    // Mọi thứ vào hàng đợi đồng bộ để lên máy chủ và các thiết bị khác.
    expect(await fresh.db.outbox.count()).toBe(3 + 1 + 2 + 2 + 2)
  })

  it('gộp: lấy lại từ đã xóa, giữ bản sửa mới hơn ở máy này, bộ cùng tên dùng chung', async () => {
    const { dev, ids, backup } = await sample()
    await dev.repo.deleteItems([ids[2]], T0 + 2 * DAY)
    await dev.repo.updateItem(ids[0], input('run', 'chạy nhanh'), {}, T0 + 2 * DAY)
    const res = await restoreBackup(dev.db, backup, { mode: 'merge', duplicates: 'skip' }, scheduler, T0 + 3 * DAY)
    expect(res).toMatchObject({ added: 0, restored: 1, updated: 0, logs: 0 })
    const lib = await loadLibrary(dev.db)
    expect(lib.items.map((i) => i.id).sort()).toEqual([...ids].sort())
    expect(lib.itemById.get(ids[0])!.meaningVi).toBe('chạy nhanh')

    const other = device()
    const deck = await other.repo.createDeck({ name: 'ielts ' }, T0)
    await restoreBackup(other.db, backup, { mode: 'merge', duplicates: 'skip' }, scheduler, T0 + 3 * DAY)
    const olib = await loadLibrary(other.db)
    expect(olib.decks.map((d) => d.id)).toEqual([deck])
    expect([...olib.members.get(ids[0])!]).toEqual([deck])
  })

  it('từ trùng nội dung: bỏ qua thì giữ từ đang có, chọn thêm thì thành mục riêng', async () => {
    const { backup } = await sample()
    const skip = device()
    await skip.repo.createItem(input('RUN', 'Chạy.'), [], T0)
    expect(await restoreBackup(skip.db, backup, { mode: 'merge', duplicates: 'skip' }, scheduler)).toMatchObject({ added: 2, skipped: 1, logs: 1 })
    expect((await loadLibrary(skip.db)).items.filter((i) => i.termKey === 'run')).toHaveLength(1)

    const keep = device()
    await keep.repo.createItem(input('RUN', 'Chạy.'), [], T0)
    expect(await restoreBackup(keep.db, backup, { mode: 'merge', duplicates: 'keep' }, scheduler)).toMatchObject({ added: 3, skipped: 0 })
    expect((await loadLibrary(keep.db)).items.filter((i) => i.termKey === 'run')).toHaveLength(2)
  })

  it('thay thế: từ và bộ trở về như bản sao lưu, nhưng lượt học sau đó vẫn được tính', async () => {
    const { dev, ids, backup } = await sample()
    const extra = await dev.repo.createItem(input('walk', 'đi bộ'), [], T0 + 2 * DAY)
    await dev.repo.updateItem(ids[0], input('run', 'chạy nhanh'), {}, T0 + 2 * DAY)
    await review(dev, ids[0], 'good', T0 + 3 * DAY)
    const res = await restoreBackup(dev.db, backup, { mode: 'replace', duplicates: 'skip' }, scheduler, T0 + 4 * DAY)
    expect(res).toMatchObject({ removed: 1, updated: 1 })
    const lib = await loadLibrary(dev.db)
    expect(lib.itemById.has(extra)).toBe(false)
    expect(lib.itemById.get(ids[0])!.meaningVi).toBe('chạy')
    expect(lib.cards.get(ids[0])!.reps).toBe(2)
    expect(await dev.db.reviewLogs.count()).toBe(3)
  })

  it('khôi phục lại lần nữa không tạo thêm gì', async () => {
    const { backup } = await sample()
    const fresh = device()
    await restoreBackup(fresh.db, backup, { mode: 'merge', duplicates: 'skip' }, scheduler, T0 + 2 * DAY)
    const queued = await fresh.db.outbox.count()
    for (const mode of ['merge', 'replace'] as const) {
      expect(await restoreBackup(fresh.db, backup, { mode, duplicates: 'keep' }, scheduler, T0 + 3 * DAY)).toEqual({
        added: 0,
        restored: 0,
        updated: 0,
        skipped: 0,
        removed: 0,
        logs: 0,
        replayed: 0,
      })
    }
    expect(await fresh.db.outbox.count()).toBe(queued)
  })
})
