import { computeDecayFactor, createEmptyCard, default_w, fsrs, generatorParameters, type Card, type FSRS, type FSRSParameters, type Grade, type RecordLogItem } from 'ts-fsrs'

/**
 * Bọc thư viện ts-fsrs (R5.1, R5.4). Lịch ôn tính riêng cho từng mục học.
 */

export interface SchedulerOptions {
  /** Xác suất nhớ mục tiêu khi đến hạn (R5.13). Mặc định 0,9. */
  requestRetention?: number
  maximumIntervalDays?: number
  /** Tham số đã tối ưu từ lịch sử của người học (R5.13). */
  weights?: readonly number[] | null
}

function schedulerParams(options: SchedulerOptions): FSRSParameters {
  return generatorParameters({
    request_retention: options.requestRetention ?? 0.9,
    maximum_interval: options.maximumIntervalDays ?? 36500,
    // Tắt ngẫu nhiên hóa để mọi thiết bị tính ra cùng một lịch khi đồng bộ.
    enable_fuzz: false,
    enable_short_term: true,
    w: options.weights ? [...options.weights] : [...default_w],
  })
}

export function createScheduler(options: SchedulerOptions = {}): FSRS {
  return fsrs(schedulerParams(options))
}

/**
 * Đổi mục tiêu ghi nhớ và tham số của bộ lập lịch đang dùng (R5.13), giữ nguyên đối tượng để mọi nơi dùng chung.
 * Chỉ ảnh hưởng các lượt ôn từ nay; lịch đã hẹn của từng từ giữ nguyên.
 */
export function configureScheduler(scheduler: FSRS, options: SchedulerOptions): void {
  const next = schedulerParams(options)
  const cur = scheduler.parameters
  if (cur.request_retention === next.request_retention && cur.w.length === next.w.length && cur.w.every((v, i) => v === next.w[i])) return
  scheduler.parameters = next
}

/**
 * Khoảng cách ôn ở mục tiêu ghi nhớ `retention` so với ở 90% (cùng độ bền trí nhớ). Ví dụ 85% → khoảng 1,9 lần.
 * Tính theo đường cong quên của FSRS: I(r) ∝ r^(1/decay) − 1.
 */
export function intervalRatio(retention: number, weights: readonly number[] = default_w): number {
  const { decay } = computeDecayFactor([...weights])
  const at = (r: number) => Math.pow(r, 1 / decay) - 1
  return at(retention) / at(0.9)
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
