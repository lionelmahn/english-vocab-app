import { studyTimeByLog, type StatLog } from './stats'

/**
 * Gợi ý số từ mới mỗi ngày theo mục tiêu và lượng ôn còn tồn (R9.5).
 * Thời gian cần để ôn các từ còn đến hạn hôm nay được trừ vào mục tiêu số phút mỗi ngày; phần còn lại
 * chia cho thời gian học một từ mới. Từ ôn chưa xong thì học ít từ mới hơn, để lượng ôn không dồn thêm.
 * Đây chỉ là gợi ý: người học vẫn chọn học bao nhiêu từ cũng được.
 */

export interface Pace {
  /** Số giây trung bình để ôn một từ. */
  reviewSec: number
  /** Số giây trung bình để học một từ mới (thẻ giới thiệu, điền từ, luyện lại). */
  newSec: number
  /** Tính từ lịch sử học của chính người học (đủ dữ liệu) hay dùng số mặc định. */
  personal: { review: boolean; new: boolean }
}

export const DEFAULT_REVIEW_SEC = 12
export const DEFAULT_NEW_SEC = 45
/** Lấy lịch sử bao nhiêu ngày gần nhất để ước tính tốc độ học. */
export const PACE_WINDOW_DAYS = 30
/** Cần ít nhất bấy nhiêu từ đã ôn / đã học mới thì mới tin số liệu của người học. */
const MIN_REVIEWED = 20
const MIN_LEARNED = 10

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Tốc độ học của người học trong 30 ngày gần nhất; chưa đủ dữ liệu thì dùng số mặc định. */
export function estimatePace(logs: readonly StatLog[], now: number): Pace {
  const recent = logs.filter((l) => l.reviewedAt > now - PACE_WINDOW_DAYS * 86_400_000 && l.reviewedAt <= now)
  const time = studyTimeByLog(recent)
  let reviewMs = 0
  let learnMs = 0
  const reviewed = new Set<string>()
  const learned = new Set<string>()
  for (const l of recent) {
    const ms = time.get(l) ?? 0
    if (l.mode === 'learn') {
      learnMs += ms
      if (l.affectsSchedule) learned.add(l.itemId)
    } else if (l.mode === 'review') {
      reviewMs += ms
      // Một từ ôn trong một buổi (kể cả lượt luyện lại trong buổi) tính là một lần ôn.
      reviewed.add(`${l.sessionId}|${l.itemId}`)
    }
  }
  const review = reviewed.size >= MIN_REVIEWED
  const learn = learned.size >= MIN_LEARNED
  return {
    reviewSec: review ? clamp(reviewMs / 1000 / reviewed.size, 3, 60) : DEFAULT_REVIEW_SEC,
    newSec: learn ? clamp(learnMs / 1000 / learned.size, 10, 180) : DEFAULT_NEW_SEC,
    personal: { review, new: learn },
  }
}

export interface WorkloadInput {
  /** Mục tiêu từ mới mỗi ngày. */
  goalNew: number
  /** Mục tiêu số phút học mỗi ngày (0 = không đặt). */
  goalMinutes: number
  /** Số từ mới đã học hôm nay. */
  learnedToday: number
  /** Số từ còn đến hạn ôn từ giờ tới hết ngày học. */
  dueToday: number
  pace: Pace
}

export interface NewWordAdvice {
  /** Số từ mới nên học thêm hôm nay. */
  suggested: number
  /** Số từ mới còn thiếu so với mục tiêu hôm nay. */
  goalLeft: number
  /** Số phút ước tính để ôn hết các từ còn đến hạn hôm nay (làm tròn lên). */
  reviewMinutes: number
  /**
   * goal-done: đã đủ mục tiêu từ mới; full: học đủ phần còn thiếu; reduced: nên học ít hơn vì còn nhiều từ cần ôn;
   * review-first: từ cần ôn đã chiếm hết thời gian mục tiêu, nên ôn trước; no-time-goal: không đặt mục tiêu số phút.
   */
  reason: 'goal-done' | 'full' | 'reduced' | 'review-first' | 'no-time-goal'
}

export function adviseNewWords({ goalNew, goalMinutes, learnedToday, dueToday, pace }: WorkloadInput): NewWordAdvice {
  const goalLeft = Math.max(0, goalNew - learnedToday)
  const reviewSec = dueToday * pace.reviewSec
  const reviewMinutes = Math.ceil(reviewSec / 60)
  if (goalLeft === 0) return { suggested: 0, goalLeft, reviewMinutes, reason: 'goal-done' }
  if (goalMinutes <= 0) return { suggested: goalLeft, goalLeft, reviewMinutes, reason: 'no-time-goal' }
  // Mục tiêu số phút ít hơn thời gian học đủ từ mới (đặt hai mục tiêu lệch nhau): lấy thời gian học đủ từ mới làm
  // mức, để chỉ lượng ôn mới làm giảm số từ gợi ý.
  const budgetSec = Math.max(goalMinutes * 60, goalLeft * pace.newSec)
  const room = Math.floor((budgetSec - reviewSec) / pace.newSec)
  if (room >= goalLeft) return { suggested: goalLeft, goalLeft, reviewMinutes, reason: 'full' }
  if (room >= 1) return { suggested: room, goalLeft, reviewMinutes, reason: 'reduced' }
  return { suggested: 0, goalLeft, reviewMinutes, reason: 'review-first' }
}
