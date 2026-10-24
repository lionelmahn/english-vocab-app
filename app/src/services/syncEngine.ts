import type { FSRS } from 'ts-fsrs'
import { mergeRows, sameValue } from '../core/merge'
import { healCards, replayCard } from '../db/cards'
import type { VocabDatabase } from '../db/db'
import type { CardStateRow, ID } from '../db/types'
import { fromRemote, PUSH_ORDER, REMOTE_TABLE, remoteIdColumn, toMs, toRemote, type PushRows, type PushTable } from './syncMapping'

/**
 * Đồng bộ hai chiều nhiều thiết bị (R11.5) và xử lý xung đột (R11.7), theo kế hoạch mục 3.5.
 *
 * Mỗi lượt: kéo các dòng đổi trên máy chủ về và gộp vào thiết bị, rồi mới gửi thay đổi của thiết bị lên.
 * - Nội dung (từ, bộ từ, liên kết, lịch ôn): gộp ba chiều theo từng trường, so với bản đã đồng bộ lần trước.
 * - Lượt trả lời: chỉ thêm theo mã, nhận lại hay gửi lại nhiều lần cũng không nhân đôi.
 * - Lịch ôn bị đổi ở cả hai thiết bị, hoặc chưa tính hết lượt trả lời: tính lại từ toàn bộ lượt trả lời.
 */

/** Vị trí đã kéo tới trong một bảng: (server_updated_at, id) của dòng cuối cùng nhận được. */
export interface Cursor {
  ts: string
  id: string
}

/** Kênh nói chuyện với máy chủ. Bản thật dùng Supabase; khi kiểm thử dùng Postgres trong bộ nhớ. */
export interface SyncRemote {
  /** Thêm hoặc cập nhật theo cột khóa `onConflict` (hồ sơ: user_id; bảng khác: id). */
  upsert(table: string, rows: Record<string, unknown>[], opts: { ignoreDuplicates: boolean; onConflict: string }): Promise<void>
  /** Tối đa `limit` dòng đứng sau `after`, theo thứ tự (server_updated_at, cột khóa `idColumn`). */
  pullPage(table: string, after: Cursor, limit: number, idColumn: string): Promise<Record<string, unknown>[]>
}

export interface SyncContext {
  scheduler: FSRS
  now: () => number
  /** Tài khoản đang đăng nhập (khóa của hồ sơ trên máy chủ). */
  userId: string
}

export interface SyncResult {
  /** Số dòng nhận về có làm thay đổi dữ liệu trên thiết bị. */
  received: number
  sent: number
  /** Số dòng bị sửa ở cả thiết bị này và nơi khác, đã được gộp. */
  merged: number
  /** Số lịch ôn được tính lại từ lượt trả lời. */
  replayed: number
}

const MIN_ID = '00000000-0000-0000-0000-000000000000'
const START: Cursor = { ts: '1970-01-01T00:00:00Z', id: MIN_ID }
const PAGE = 1000
const PUSH_BATCH = 400
/**
 * Máy chủ ghi `server_updated_at` lúc bắt đầu lượt ghi, nên một lượt ghi xong muộn có thể mang mốc
 * cũ hơn dòng đã kéo về. Nếu lần kéo trước sát thời điểm đó thì kéo chồng lấn một khoảng để không sót.
 */
const OVERLAP_MS = 60_000

const FSRS_FIELDS = ['due', 'stability', 'difficulty', 'scheduledDays', 'learningSteps', 'reps', 'lapses', 'state', 'lastReview'] as const
const GROUPS: Partial<Record<PushTable, Record<string, readonly string[]>>> = { cardStates: { fsrs: FSRS_FIELDS } }

interface SavedCursor extends Cursor {
  /** Giờ trên thiết bị lúc bắt đầu lần kéo đó. */
  pulledAt: number
}

const cursorKey = (table: PushTable) => `sync:cursor:${table}`
const baseKey = (table: PushTable, id: ID) => `${table}:${id}`

/** Kéo từ đâu: từ vị trí đã lưu, hoặc lùi lại một khoảng nếu lần kéo trước sát với dòng mới nhất. */
export function pullStart(saved: SavedCursor | undefined): Cursor {
  if (!saved) return START
  const settled = saved.pulledAt - OVERLAP_MS
  return toMs(saved.ts) > settled ? { ts: new Date(settled).toISOString(), id: MIN_ID } : { ts: saved.ts, id: saved.id }
}

interface Applied {
  received: number
  merged: number
  replayed: number
  /** Mục học có lượt trả lời hoặc lịch ôn mới, cần kiểm tra lịch ôn. */
  touched: ID[]
}

type ContentTable = Exclude<PushTable, 'reviewLogs'>

/** Ghi một trang dòng từ máy chủ vào thiết bị, gộp với thay đổi chưa gửi. */
async function applyRemote(database: VocabDatabase, table: PushTable, rows: PushRows[PushTable][], ctx: SyncContext): Promise<Applied> {
  if (table === 'reviewLogs') {
    const logs = rows as PushRows['reviewLogs'][]
    return database.transaction('rw', database.reviewLogs, async () => {
      const existing = await database.reviewLogs.bulkGet(logs.map((l) => l.id))
      const fresh = logs.filter((_, i) => !existing[i])
      await database.reviewLogs.bulkAdd(fresh)
      return { received: fresh.length, merged: 0, replayed: 0, touched: fresh.map((l) => l.itemId) }
    })
  }
  const t = table as ContentTable
  const tbl = database.table(t)
  return database.transaction('rw', [tbl, database.outbox, database.syncBase, database.reviewLogs], async () => {
    const remotes = rows as PushRows[ContentTable][]
    const ids = remotes.map((r) => r.id)
    const locals = (await tbl.bulkGet(ids)) as (PushRows[ContentTable] | undefined)[]
    const bases = await database.syncBase.bulkGet(ids.map((id) => baseKey(t, id)))
    const pendingRows = await database.outbox.where('[table+rowId]').anyOf(ids.map((id) => [t, id])).toArray()
    const pending = new Set(pendingRows.map((p) => p.rowId))

    const put: PushRows[ContentTable][] = []
    const settled: ID[] = []
    let merged = 0
    let replayed = 0
    for (let i = 0; i < remotes.length; i++) {
      const remote = remotes[i]
      const local = locals[i]
      if (!local || !pending.has(remote.id)) {
        // Thiết bị không có thay đổi chưa gửi: bản trên máy chủ là bản đúng.
        if (!sameValue(local, remote)) put.push(remote)
        continue
      }
      const base = bases[i]?.row as PushRows[ContentTable] | undefined
      let { row, conflicts } = mergeRows(local, remote, base, GROUPS[t] as Record<string, readonly (keyof typeof local)[]>)
      if (conflicts.length > 0) merged++
      if (t === 'cardStates' && conflicts.includes('fsrs')) {
        const logs = await database.reviewLogs.where('itemId').equals(remote.id).toArray()
        row = replayCard(ctx.scheduler, row as CardStateRow, logs, ctx.now())
        replayed++
      }
      if (sameValue({ ...row, updatedAt: 0 }, { ...remote, updatedAt: 0 })) {
        // Gộp xong trùng với máy chủ: không còn gì phải gửi.
        put.push(remote)
        settled.push(remote.id)
      } else if (!sameValue(row, local)) {
        put.push(row)
      }
    }
    await tbl.bulkPut(put)
    await database.syncBase.bulkPut(remotes.map((r) => ({ key: baseKey(t, r.id), row: r })))
    if (settled.length > 0) await database.outbox.where('[table+rowId]').anyOf(settled.map((id) => [t, id])).delete()
    return { received: put.length, merged, replayed, touched: t === 'cardStates' ? ids : [] }
  })
}

/** Kéo mọi dòng mới của một bảng, theo từng trang. */
async function pullTable(database: VocabDatabase, remote: SyncRemote, table: PushTable, ctx: SyncContext): Promise<Applied> {
  const saved = (await database.meta.get(cursorKey(table)))?.value as SavedCursor | undefined
  const pulledAt = ctx.now()
  let after = pullStart(saved)
  let last: Cursor | null = null
  const total: Applied = { received: 0, merged: 0, replayed: 0, touched: [] }
  for (;;) {
    const idColumn = remoteIdColumn(table)
    const page = await remote.pullPage(REMOTE_TABLE[table], after, PAGE, idColumn)
    if (page.length === 0) break
    const res = await applyRemote(database, table, page.map((r) => fromRemote(table, r)), ctx)
    total.received += res.received
    total.merged += res.merged
    total.replayed += res.replayed
    total.touched.push(...res.touched)
    const end = page[page.length - 1]
    last = after = { ts: end.server_updated_at as string, id: end[idColumn] as string }
    if (page.length < PAGE) break
  }
  // Kéo theo thứ tự tăng dần nên dòng cuối cùng là mới nhất; không nhận được gì thì giữ vị trí cũ.
  const next = last ?? saved ?? null
  if (next) await database.meta.put({ key: cursorKey(table), value: { ts: next.ts, id: next.id, pulledAt } satisfies SavedCursor })
  return total
}

export async function pullAll(database: VocabDatabase, remote: SyncRemote, ctx: SyncContext): Promise<Omit<SyncResult, 'sent'>> {
  const result = { received: 0, merged: 0, replayed: 0 }
  const touched: ID[] = []
  for (const table of PUSH_ORDER) {
    const res = await pullTable(database, remote, table, ctx)
    result.received += res.received
    result.merged += res.merged
    result.replayed += res.replayed
    touched.push(...res.touched)
  }
  result.replayed += await healCards(database, touched, ctx.scheduler, ctx.now())
  return result
}

/** Gửi một lượt hàng đợi. Trả về số mục hàng đợi đã xử lý. Lỗi thì giữ nguyên hàng đợi để thử lại. */
export async function pushOutbox(database: VocabDatabase, remote: SyncRemote, userId: string, batch = PUSH_BATCH): Promise<{ processed: number; sent: number }> {
  const entries = await database.outbox.orderBy('seq').limit(batch).toArray()
  if (entries.length === 0) return { processed: 0, sent: 0 }
  const maxSeq = entries[entries.length - 1].seq!
  const byTable = new Map<string, Set<string>>()
  for (const e of entries) {
    let set = byTable.get(e.table)
    if (!set) byTable.set(e.table, (set = new Set()))
    set.add(e.rowId)
  }
  let sent = 0
  for (const table of PUSH_ORDER) {
    const ids = byTable.get(table)
    if (!ids || ids.size === 0) continue
    const rows = (await database.table(table).bulkGet([...ids])).filter(Boolean)
    if (rows.length === 0) continue
    const data = rows.map((r) => toRemote(table, r, userId))
    // Lượt trả lời chỉ thêm: gửi lại không nhân đôi, không sửa bản đã có.
    await remote.upsert(REMOTE_TABLE[table], data, { ignoreDuplicates: table === 'reviewLogs', onConflict: remoteIdColumn(table) })
    if (table !== 'reviewLogs') {
      // Ghi lại bản máy chủ đang giữ, làm gốc cho lần gộp sau.
      const saved = data.map((d) => fromRemote(table, d))
      await database.syncBase.bulkPut(saved.map((row) => ({ key: baseKey(table, row.id), row })))
    }
    sent += data.length
  }
  await database.outbox.where('seq').belowOrEqual(maxSeq).delete()
  return { processed: entries.length, sent }
}

/** Một lượt đồng bộ đầy đủ: kéo về và gộp trước, rồi gửi hết hàng đợi. */
export async function syncOnce(database: VocabDatabase, remote: SyncRemote, ctx: SyncContext): Promise<SyncResult> {
  const pulled = await pullAll(database, remote, ctx)
  let sent = 0
  for (;;) {
    const res = await pushOutbox(database, remote, ctx.userId)
    sent += res.sent
    if (res.processed === 0) break
  }
  return { ...pulled, sent }
}

/**
 * Tài khoản đăng nhập khác lần trước: quên vị trí đã kéo và các bản gốc, coi như đồng bộ lần đầu.
 * Trả về true nếu đã đặt lại.
 */
export async function bindAccount(database: VocabDatabase, userId: string): Promise<boolean> {
  const prev = (await database.meta.get('sync:user'))?.value
  if (prev === userId) return false
  await database.transaction('rw', [database.meta, database.syncBase], async () => {
    await database.meta.where('key').startsWith('sync:cursor:').delete()
    await database.syncBase.clear()
    await database.meta.put({ key: 'sync:user', value: userId })
  })
  return prev !== undefined
}

/** Kéo lại toàn bộ dữ liệu từ máy chủ ở lần đồng bộ tới (gộp với dữ liệu đang có, không xóa gì). */
export async function forgetCursors(database: VocabDatabase): Promise<void> {
  await database.meta.where('key').startsWith('sync:cursor:').delete()
}
