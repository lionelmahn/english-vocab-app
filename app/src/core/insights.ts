import { studyDay } from './day'
import type { ExerciseKind, SessionMode } from './grading'
import { lastDays, weekStart } from './stats'

/**
 * Phân tích lỗi và điểm yếu (R10.3): từ hay sai, dạng bài còn yếu và mức tiến bộ, tính từ lịch sử trả lời.
 * Chỉ tính lượt đầu của mỗi từ trong mỗi buổi, để lượt luyện lại ngay sau khi sai không bị đếm thêm lỗi.
 */

export interface InsightLog {
  itemId: string
  sessionId: string
  reviewedAt: number
  mode: SessionMode
  exercise: ExerciseKind
  correct: boolean | null
}

/** Lượt đầu (có chấm đúng/sai) của mỗi từ trong mỗi buổi, theo thời gian. */
export function firstAttempts<T extends InsightLog>(logs: readonly T[]): T[] {
  const seen = new Set<string>()
  return logs
    .filter((l) => l.correct !== null)
    .sort((a, b) => a.reviewedAt - b.reviewedAt)
    .filter((l) => {
      const key = `${l.sessionId}|${l.itemId}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export interface TroubleWord {
  itemId: string
  wrong: number
  total: number
  lastAt: number
}

/**
 * Từ hay sai từ thời điểm `since`: sai từ 2 lần trở lên và chiếm ít nhất 1/4 số lần, hoặc sai ít nhất một nửa số lần.
 * Sai nhiều xếp trước, rồi tỷ lệ sai cao, rồi sai gần đây.
 */
export function troubleWords(logs: readonly InsightLog[], since: number, limit = Infinity): TroubleWord[] {
  const by = new Map<string, TroubleWord>()
  for (const l of firstAttempts(logs)) {
    if (l.reviewedAt < since) continue
    let w = by.get(l.itemId)
    if (!w) by.set(l.itemId, (w = { itemId: l.itemId, wrong: 0, total: 0, lastAt: 0 }))
    w.total++
    if (!l.correct) {
      w.wrong++
      w.lastAt = l.reviewedAt
    }
  }
  return [...by.values()]
    .filter((w) => (w.wrong >= 2 && w.wrong * 4 >= w.total) || (w.wrong >= 1 && w.wrong * 2 >= w.total))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total || b.lastAt - a.lastAt)
    .slice(0, limit)
}

export interface ExerciseStat {
  exercise: ExerciseKind
  total: number
  correct: number
  accuracy: number
}

/** Dạng bài cần ít nhất chừng này lượt mới được xét yếu hay không. */
export const MIN_EXERCISE_SAMPLES = 5

/** Tỷ lệ đúng theo dạng bài từ `since`, thấp xếp trước. */
export function exerciseStats(logs: readonly InsightLog[], since: number): ExerciseStat[] {
  const by = new Map<ExerciseKind, ExerciseStat>()
  for (const l of firstAttempts(logs)) {
    if (l.reviewedAt < since) continue
    let s = by.get(l.exercise)
    if (!s) by.set(l.exercise, (s = { exercise: l.exercise, total: 0, correct: 0, accuracy: 0 }))
    s.total++
    if (l.correct) s.correct++
  }
  return [...by.values()].map((s) => ({ ...s, accuracy: s.correct / s.total })).sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
}

/** Dạng bài còn yếu: đủ lượt, và tỷ lệ đúng dưới 70% hoặc thấp hơn tỷ lệ chung từ 10 điểm trở lên. */
export function weakExercises(stats: readonly ExerciseStat[]): ExerciseStat[] {
  const total = stats.reduce((n, s) => n + s.total, 0)
  const overall = total ? stats.reduce((n, s) => n + s.correct, 0) / total : 0
  return stats.filter((s) => s.total >= MIN_EXERCISE_SAMPLES && (s.accuracy < 0.7 || s.accuracy <= overall - 0.1))
}

export interface WeekAccuracy {
  /** Thứ Hai của tuần. */
  week: string
  total: number
  correct: number
  accuracy: number | null
}

/** Tỷ lệ đúng theo tuần (lượt đầu mỗi buổi), `weeks` tuần gần nhất kết thúc ở tuần chứa `today` (cũ → mới). */
export function weeklyAccuracy(logs: readonly InsightLog[], today: string, timeZone: string, weeks = 8): WeekAccuracy[] {
  const days = lastDays(today, weeks * 7)
  const list = [...new Set(days.map(weekStart))].slice(-weeks)
  const by = new Map(list.map((w) => [w, { week: w, total: 0, correct: 0, accuracy: null as number | null }]))
  for (const l of firstAttempts(logs)) {
    const b = by.get(weekStart(studyDay(new Date(l.reviewedAt), timeZone)))
    if (!b) continue
    b.total++
    if (l.correct) b.correct++
  }
  return list.map((w) => {
    const b = by.get(w)!
    return { ...b, accuracy: b.total ? b.correct / b.total : null }
  })
}

/** Mức tiến bộ: tỷ lệ đúng của nửa sau so với nửa đầu khoảng thời gian (null nếu một nửa chưa có lượt nào). */
export function progressDelta(weeks: readonly WeekAccuracy[]): { recent: number | null; before: number | null; change: number | null } {
  const half = Math.floor(weeks.length / 2)
  const rate = (list: readonly WeekAccuracy[]) => {
    const total = list.reduce((n, w) => n + w.total, 0)
    return total ? list.reduce((n, w) => n + w.correct, 0) / total : null
  }
  const before = rate(weeks.slice(0, half))
  const recent = rate(weeks.slice(half))
  return { recent, before, change: recent !== null && before !== null ? recent - before : null }
}
