import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS, type Grade, type RecordLogItem } from 'ts-fsrs'

/**
 * Bọc thư viện ts-fsrs (R5.1, R5.4). Lịch ôn tính riêng cho từng mục học.
 */

export interface SchedulerOptions {
  /** Xác suất nhớ mục tiêu khi đến hạn (R5.13). Mặc định 0,9. */
  requestRetention?: number
  maximumIntervalDays?: number
  /** Tham số đã tối ưu từ lịch sử của người học (R5.13). */
  weights?: readonly number[]
}

export function createScheduler(options: SchedulerOptions = {}): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: options.requestRetention ?? 0.9,
      maximum_interval: options.maximumIntervalDays ?? 36500,
      // Tắt ngẫu nhiên hóa để mọi thiết bị tính ra cùng một lịch khi đồng bộ.
      enable_fuzz: false,
      enable_short_term: true,
      ...(options.weights ? { w: [...options.weights] } : {}),
    }),
  )
}

export function newCard(now: Date): Card {
  return createEmptyCard(now)
}

export function applyReview(scheduler: FSRS, card: Card, grade: Grade, at: Date): RecordLogItem {
  return scheduler.next(card, at, grade)
}

export function isDue(card: Pick<Card, 'due'>, now: Date): boolean {
  return card.due.getTime() <= now.getTime()
}

/** Xác suất còn nhớ ở thời điểm `now` (0–1). Dùng để ưu tiên khi ôn tồn đọng (R5.6). */
export function retrievability(scheduler: FSRS, card: Card, now: Date): number {
  return scheduler.get_retrievability(card, now, false)
}

export interface ScheduledReview {
  /** Mã lượt trả lời — dùng để sắp xếp ổn định khi trùng thời điểm. */
  id: string
  reviewedAt: Date
  grade: Grade
}

/**
 * Tính lại trạng thái thẻ từ toàn bộ lượt trả lời (quy tắc đồng bộ mục 3.5).
 * Hai thiết bị cùng ôn một từ khi mất mạng: gộp lượt của cả hai rồi chạy lại,
 * không lượt nào bị mất và kết quả không phụ thuộc thứ tự nhận dữ liệu.
 */
export function replayReviews(scheduler: FSRS, createdAt: Date, reviews: readonly ScheduledReview[]): Card {
  const unique = new Map<string, ScheduledReview>()
  for (const r of reviews) unique.set(r.id, r)
  const ordered = [...unique.values()].sort(
    (a, b) => a.reviewedAt.getTime() - b.reviewedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
  let card = createEmptyCard(createdAt)
  for (const r of ordered) card = scheduler.next(card, r.reviewedAt, r.grade).card
  return card
}
