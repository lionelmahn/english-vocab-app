import type { Card, FSRS, Grade } from 'ts-fsrs'
import { replayReviews } from '../core/scheduler'
import { commit, type VocabDatabase } from './db'
import type { CardStateRow, ID, ReviewLogRow } from './types'

/** Chuyển giữa dòng lưu trên thiết bị và đối tượng thẻ của ts-fsrs. */

export function rowToCard(row: CardStateRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    // Trường cũ của ts-fsrs, thư viện tự tính lại từ last_review.
    elapsed_days: 0,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview === null ? undefined : new Date(row.lastReview),
  }
}

export function cardToRow(
  itemId: ID,
  card: Card,
  now: number,
  previous?: Pick<CardStateRow, 'createdAt' | 'suspended'>,
): CardStateRow {
  return {
    id: itemId,
    itemId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardStateRow['state'],
    lastReview: card.last_review ? card.last_review.getTime() : null,
    suspended: previous?.suspended ?? false,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  }
}

/** Lượt trả lời đã tính vào lịch ôn của thẻ hiện tại (từ lần học đầu, hoặc từ sau lần đặt lại tiến độ). */
export function scheduleLogsOf(card: CardStateRow, logs: readonly ReviewLogRow[]): ReviewLogRow[] {
  return logs.filter((l) => l.itemId === card.id && l.affectsSchedule && l.grade !== null && l.reviewedAt >= card.createdAt)
}

/** Thẻ chưa tính hết các lượt trả lời đã có (ví dụ lượt ôn trên thiết bị khác đến sau). */
export function missesReviews(card: CardStateRow, logs: readonly ReviewLogRow[]): boolean {
  return scheduleLogsOf(card, logs).length > card.reps
}

/**
 * Tính lại lịch ôn từ toàn bộ lượt trả lời (kế hoạch mục 3.5, quy tắc 4), dùng khi hai thiết bị cùng ôn một từ.
 * Giữ nguyên ngày tạo, cờ tạm dừng và trạng thái xóa của thẻ.
 */
export function replayCard(scheduler: FSRS, card: CardStateRow, logs: readonly ReviewLogRow[], now: number): CardStateRow {
  const reviews = scheduleLogsOf(card, logs).map((l) => ({ id: l.id, reviewedAt: new Date(l.reviewedAt), grade: l.grade as Grade }))
  if (reviews.length === 0) return card
  const next = replayReviews(scheduler, new Date(card.createdAt), reviews)
  return { ...cardToRow(card.id, next, now, card), deletedAt: card.deletedAt }
}

/**
 * Lịch ôn chưa tính hết lượt trả lời (hai thiết bị gửi gần như cùng lúc và một bên ghi đè, hoặc vừa khôi phục
 * bản sao lưu): tính lại từ lịch sử và xếp hàng gửi lên. Trả về số thẻ đã tính lại.
 */
export async function healCards(database: VocabDatabase, itemIds: ID[], scheduler: FSRS, now: number): Promise<number> {
  if (itemIds.length === 0) return 0
  return database.transaction('rw', [database.cardStates, database.reviewLogs, database.outbox], async () => {
    const ids = [...new Set(itemIds)]
    const cards = (await database.cardStates.bulkGet(ids)).filter((c): c is CardStateRow => !!c && c.deletedAt === null)
    const logsByItem = new Map<ID, ReviewLogRow[]>()
    for (const l of await database.reviewLogs.where('itemId').anyOf(ids).toArray()) {
      const list = logsByItem.get(l.itemId)
      if (list) list.push(l)
      else logsByItem.set(l.itemId, [l])
    }
    const fixes: CardStateRow[] = []
    for (const card of cards) {
      const logs = logsByItem.get(card.id) ?? []
      if (missesReviews(card, logs)) fixes.push(replayCard(scheduler, card, logs, now))
    }
    await commit(database, [{ table: 'cardStates', rows: fixes }], now)
    return fixes.length
  })
}
