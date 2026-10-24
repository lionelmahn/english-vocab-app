import { studyDay } from './day'
import type { SessionMode } from './grading'

/**
 * Thống kê học tập tính từ lịch sử trả lời (R10.1, R10.2, R10.4).
 * Không lưu bộ đếm cộng dồn: mọi con số được tính lại từ lượt trả lời (kế hoạch mục 3.5, quy tắc 5),
 * nên không thể bị cộng lặp khi đồng bộ nhiều thiết bị.
 */

export interface StatLog {
  itemId: string
  sessionId: string
  reviewedAt: number
  mode: SessionMode
  correct: boolean | null
  affectsSchedule: boolean
  responseMs: number | null
}

export interface DayActivity {
  /** Ngày học YYYY-MM-DD (bắt đầu lúc 4:00 sáng). */
  day: string
  /** Lượt trả lời khi học từ mới. */
  learnAnswers: number
  /** Lượt trả lời khi ôn tập, luyện lại, ôn chủ động. */
  reviewAnswers: number
  /** Số từ mới bắt đầu học trong ngày. */
  newWords: number
  /** Lượt được chấm đúng/sai, và số lượt đúng trong đó. */
  graded: number
  correct: number
  /** Thời gian học ước tính (mili-giây). */
  timeMs: number
}

/** Một câu trả lời tính tối đa 2 phút; khoảng nghỉ giữa hai câu trong buổi tính tối đa 3 phút. */
const MAX_ANSWER_MS = 120_000
const MAX_GAP_MS = 180_000

/**
 * Thời gian học ước tính của từng lượt trả lời: câu đầu buổi tính bằng thời gian trả lời,
 * các câu sau tính bằng khoảng cách tới câu trước (gồm cả xem thẻ, đọc phản hồi), có giới hạn để
 * bỏ app mở mà không học thì không bị tính.
 */
export function studyTimeByLog<T extends StatLog>(logs: readonly T[]): Map<T, number> {
  const bySession = new Map<string, T[]>()
  for (const l of logs) {
    const list = bySession.get(l.sessionId)
    if (list) list.push(l)
    else bySession.set(l.sessionId, [l])
  }
  const out = new Map<T, number>()
  for (const list of bySession.values()) {
    list.sort((a, b) => a.reviewedAt - b.reviewedAt)
    list.forEach((l, i) => {
      const own = Math.min(Math.max(l.responseMs ?? 0, 0), MAX_ANSWER_MS)
      out.set(l, i === 0 ? own : Math.min(Math.max(l.reviewedAt - list[i - 1].reviewedAt, 0), MAX_GAP_MS))
    })
  }
  return out
}

/** Hoạt động theo ngày học, theo múi giờ của người học. */
export function dailyActivity(logs: readonly StatLog[], timeZone: string): Map<string, DayActivity> {
  const time = studyTimeByLog(logs)
  const days = new Map<string, DayActivity>()
  const newSeen = new Set<string>()
  const ordered = [...logs].sort((a, b) => a.reviewedAt - b.reviewedAt)
  for (const l of ordered) {
    const day = studyDay(new Date(l.reviewedAt), timeZone)
    let d = days.get(day)
    if (!d) days.set(day, (d = { day, learnAnswers: 0, reviewAnswers: 0, newWords: 0, graded: 0, correct: 0, timeMs: 0 }))
    if (l.mode === 'learn') d.learnAnswers++
    else d.reviewAnswers++
    // Từ mới: lượt học đầu tiên được tính lịch của từ (mỗi từ chỉ tính một lần).
    if (l.mode === 'learn' && l.affectsSchedule && !newSeen.has(l.itemId)) {
      newSeen.add(l.itemId)
      d.newWords++
    }
    if (l.correct !== null) {
      d.graded++
      if (l.correct) d.correct++
    }
    d.timeMs += time.get(l) ?? 0
  }
  return days
}

// ---- Khoảng thời gian -------------------------------------------------------------------------

const DAY_MS = 86_400_000

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

function dayString(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

/** `count` ngày học liền nhau kết thúc ở `today` (cũ → mới). */
export function lastDays(today: string, count: number): string[] {
  const end = dayNumber(today)
  return Array.from({ length: count }, (_, i) => dayString(end - count + 1 + i))
}

/** Thứ trong tuần của ngày học: 0 = Chủ nhật … 6 = Thứ bảy. */
export function weekdayOf(day: string): number {
  return new Date(dayNumber(day) * DAY_MS).getUTCDay()
}

/** Ngày thứ Hai của tuần chứa `day`. */
export function weekStart(day: string): string {
  return dayString(dayNumber(day) - ((weekdayOf(day) + 6) % 7))
}

export interface Bucket {
  /** Ngày đầu của nhóm (ngày, hoặc thứ Hai của tuần). */
  start: string
  days: string[]
  learnAnswers: number
  reviewAnswers: number
  newWords: number
  graded: number
  correct: number
  timeMs: number
}

/** Gộp hoạt động theo ngày (`week` = false) hoặc theo tuần bắt đầu từ thứ Hai. */
export function buckets(activity: Map<string, DayActivity>, days: readonly string[], week = false): Bucket[] {
  const out: Bucket[] = []
  for (const day of days) {
    const start = week ? weekStart(day) : day
    let b = out[out.length - 1]
    if (!b || b.start !== start) out.push((b = { start, days: [], learnAnswers: 0, reviewAnswers: 0, newWords: 0, graded: 0, correct: 0, timeMs: 0 }))
    b.days.push(day)
    const a = activity.get(day)
    if (!a) continue
    b.learnAnswers += a.learnAnswers
    b.reviewAnswers += a.reviewAnswers
    b.newWords += a.newWords
    b.graded += a.graded
    b.correct += a.correct
    b.timeMs += a.timeMs
  }
  return out
}

export function totals(list: readonly Bucket[]): Omit<Bucket, 'start' | 'days'> {
  const t = { learnAnswers: 0, reviewAnswers: 0, newWords: 0, graded: 0, correct: 0, timeMs: 0 }
  for (const b of list) {
    t.learnAnswers += b.learnAnswers
    t.reviewAnswers += b.reviewAnswers
    t.newWords += b.newWords
    t.graded += b.graded
    t.correct += b.correct
    t.timeMs += b.timeMs
  }
  return t
}

// ---- Mục tiêu (R10.4) ---------------------------------------------------------------------------

export interface Goals {
  dailyNewWords: number
  dailyMinutes: number
  studyWeekdays: readonly number[]
}

/**
 * met: đạt mục tiêu thời gian · partial: có học nhưng chưa đủ · missed: ngày học theo lịch mà không học ·
 * rest: ngày nghỉ theo lịch · pending: hôm nay, chưa học · future: chưa tới.
 */
export type DayGoalState = 'met' | 'partial' | 'missed' | 'rest' | 'pending' | 'future'

/** Một ngày đạt mục tiêu khi học đủ số phút đặt ra (gồm cả ôn tập); mục tiêu 0 phút thì chỉ cần có học. */
export function dayGoalState(activity: DayActivity | undefined, day: string, today: string, goals: Goals): DayGoalState {
  if (dayNumber(day) > dayNumber(today)) return 'future'
  const studied = !!activity && activity.learnAnswers + activity.reviewAnswers > 0
  const minutes = (activity?.timeMs ?? 0) / 60_000
  if (studied && minutes >= goals.dailyMinutes) return 'met'
  if (studied) return 'partial'
  if (!goals.studyWeekdays.includes(weekdayOf(day))) return 'rest'
  return day === today ? 'pending' : 'missed'
}

export interface WeekGoal {
  days: { day: string; weekday: number; state: DayGoalState; scheduled: boolean }[]
  /** Số ngày học theo lịch trong tuần, và số ngày (kể cả ngày nghỉ) đã đạt mục tiêu. */
  scheduled: number
  met: number
}

/** Tuần hiện tại (thứ Hai → Chủ nhật) so với mục tiêu và lịch học. */
export function weekGoal(activity: Map<string, DayActivity>, today: string, goals: Goals): WeekGoal {
  const start = dayNumber(weekStart(today))
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = dayString(start + i)
    const weekday = weekdayOf(day)
    return { day, weekday, state: dayGoalState(activity.get(day), day, today, goals), scheduled: goals.studyWeekdays.includes(weekday) }
  })
  return { days, scheduled: days.filter((d) => d.scheduled).length, met: days.filter((d) => d.state === 'met').length }
}

/** Tỷ lệ đúng (0–1), hoặc null khi chưa có lượt chấm. */
export function accuracy(graded: number, correct: number): number | null {
  return graded > 0 ? correct / graded : null
}
