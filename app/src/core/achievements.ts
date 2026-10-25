import { studyDay } from './day'
import type { ExerciseKind, SessionMode } from './grading'
import { firstAttempts } from './insights'
import { lastDays, weekStart } from './stats'

/**
 * Điểm kinh nghiệm và thành tích (R10.6). Như thống kê, mọi thứ tính lại từ lịch sử trả lời nên đồng bộ giữa các
 * máy mà không cộng lặp, và chỉ dựa trên số liệu chỉ tăng (không mất huy hiệu khi một từ tụt cấp).
 */

export interface XpLog {
  itemId: string
  sessionId: string
  reviewedAt: number
  mode: SessionMode
  exercise: ExerciseKind
  correct: boolean | null
  hintLevel: number
  affectsSchedule: boolean
}

/** Cách cộng điểm: đúng 10, đúng nhưng dùng gợi ý 6, sai vẫn được 2 vì đã cố gắng; học xong một từ mới thêm 5. */
export const XP_RULES = { correct: 10, hinted: 6, wrong: 2, newWord: 5 } as const

export function xpOf(l: XpLog): number {
  let xp = l.correct === null ? 0 : l.correct ? (l.hintLevel > 0 ? XP_RULES.hinted : XP_RULES.correct) : XP_RULES.wrong
  if (l.mode === 'learn' && l.affectsSchedule) xp += XP_RULES.newWord
  return xp
}

export function sumXp(logs: readonly XpLog[]): number {
  return logs.reduce((n, l) => n + xpOf(l), 0)
}

/** Điểm tổng, hôm nay và tuần này (tuần bắt đầu thứ Hai, ngày học bắt đầu 4:00). */
export function xpTotals(logs: readonly XpLog[], now: number, timeZone: string): { total: number; today: number; week: number } {
  const today = studyDay(new Date(now), timeZone)
  const monday = weekStart(today)
  const out = { total: 0, today: 0, week: 0 }
  for (const l of logs) {
    const xp = xpOf(l)
    out.total += xp
    const day = studyDay(new Date(l.reviewedAt), timeZone)
    if (day === today) out.today += xp
    if (day >= monday && day <= today) out.week += xp
  }
  return out
}

// ---- Huy hiệu --------------------------------------------------------------------------------------

export type BadgeGroup = 'streak' | 'days' | 'words' | 'answers' | 'perfect' | 'xp' | 'test'

export interface BadgeDef {
  group: BadgeGroup
  title: string
  /** Mô tả chung; `{n}` thay bằng mốc. */
  describe: string
  tiers: readonly number[]
}

export const BADGES: readonly BadgeDef[] = [
  { group: 'streak', title: 'Chuỗi ngày học', describe: 'Học liên tục {n} ngày', tiers: [3, 7, 30, 100] },
  { group: 'days', title: 'Chăm chỉ', describe: 'Học tổng cộng {n} ngày', tiers: [10, 50, 100, 365] },
  { group: 'words', title: 'Vốn từ', describe: 'Học {n} từ mới', tiers: [10, 50, 100, 500, 1000] },
  { group: 'answers', title: 'Luyện tập', describe: 'Trả lời {n} câu', tiers: [100, 1000, 5000, 20000] },
  { group: 'perfect', title: 'Buổi hoàn hảo', describe: '{n} buổi từ 10 từ trở lên, đúng hết ngay lần đầu', tiers: [1, 10, 50] },
  { group: 'xp', title: 'Kinh nghiệm', describe: 'Đạt {n} điểm kinh nghiệm', tiers: [1000, 10000, 50000] },
  { group: 'test', title: 'Bài kiểm tra xuất sắc', describe: '{n} bài kiểm tra từ 20 câu trở lên, đúng từ 90%', tiers: [1, 5] },
]

export interface BadgeTier {
  target: number
  /** Lúc đạt mốc (null nếu chưa đạt). */
  earnedAt: number | null
}

export interface BadgeState {
  def: BadgeDef
  /** Giá trị hiện tại (với chuỗi ngày: chuỗi dài nhất từng có). */
  value: number
  tiers: BadgeTier[]
}

export const PERFECT_MIN_WORDS = 10
export const TEST_MIN_QUESTIONS = 20
export const TEST_MIN_ACCURACY = 0.9

/** Mốc thời gian mỗi khi một bộ đếm tăng (đã sắp theo thời gian) → thời điểm đạt từng mốc. */
function tiersFrom(events: readonly number[], tiers: readonly number[]): BadgeTier[] {
  return tiers.map((target) => ({ target, earnedAt: events.length >= target ? events[target - 1] : null }))
}

export function badgeStates(logs: readonly XpLog[], timeZone: string): BadgeState[] {
  const ordered = [...logs].sort((a, b) => a.reviewedAt - b.reviewedAt)

  // Ngày học: mỗi ngày mới là một sự kiện; chuỗi ngày: thời điểm chuỗi dài nhất đạt độ dài k lần đầu.
  const dayEvents: number[] = []
  const streakEvents: number[] = []
  let prevDay: string | null = null
  let run = 0
  for (const l of ordered) {
    const day = studyDay(new Date(l.reviewedAt), timeZone)
    if (day === prevDay) continue
    run = prevDay !== null && lastDays(day, 2)[0] === prevDay ? run + 1 : 1
    if (run > streakEvents.length) streakEvents.push(l.reviewedAt)
    dayEvents.push(l.reviewedAt)
    prevDay = day
  }

  const wordEvents: number[] = []
  const learned = new Set<string>()
  const answerEvents: number[] = []
  const xpEvents: number[] = []
  let xp = 0
  for (const l of ordered) {
    if (l.mode === 'learn' && l.affectsSchedule && !learned.has(l.itemId)) {
      learned.add(l.itemId)
      wordEvents.push(l.reviewedAt)
    }
    if (l.correct !== null) answerEvents.push(l.reviewedAt)
    const before = xp
    xp += xpOf(l)
    // Một sự kiện cho mỗi 1.000 điểm, để mốc "đạt n điểm" có ngày đạt.
    for (let k = Math.floor(before / 1000) + 1; k <= Math.floor(xp / 1000); k++) xpEvents.push(l.reviewedAt)
  }

  // Buổi hoàn hảo và bài kiểm tra xuất sắc: theo lượt đầu của mỗi từ trong buổi.
  const sessions = new Map<string, { mode: SessionMode; total: number; correct: number; endedAt: number }>()
  for (const l of firstAttempts(ordered)) {
    let s = sessions.get(l.sessionId)
    if (!s) sessions.set(l.sessionId, (s = { mode: l.mode, total: 0, correct: 0, endedAt: 0 }))
    s.total++
    if (l.correct) s.correct++
    s.endedAt = Math.max(s.endedAt, l.reviewedAt)
  }
  const done = [...sessions.values()].sort((a, b) => a.endedAt - b.endedAt)
  const perfectEvents = done.filter((s) => s.mode !== 'test' && s.total >= PERFECT_MIN_WORDS && s.correct === s.total).map((s) => s.endedAt)
  const testEvents = done.filter((s) => s.mode === 'test' && s.total >= TEST_MIN_QUESTIONS && s.correct / s.total >= TEST_MIN_ACCURACY).map((s) => s.endedAt)

  const events: Record<Exclude<BadgeGroup, 'xp'>, number[]> = {
    streak: streakEvents,
    days: dayEvents,
    words: wordEvents,
    answers: answerEvents,
    perfect: perfectEvents,
    test: testEvents,
  }
  return BADGES.map((def) => {
    if (def.group !== 'xp') return { def, value: events[def.group].length, tiers: tiersFrom(events[def.group], def.tiers) }
    // Sự kiện điểm tính theo từng 1.000 điểm.
    return { def, value: xp, tiers: tiersFrom(xpEvents, def.tiers.map((t) => t / 1000)).map((t, i) => ({ ...t, target: def.tiers[i] })) }
  })
}

export interface Milestone {
  group: BadgeGroup
  title: string
  text: string
  earnedAt: number
}

export function describeTier(def: BadgeDef, target: number): string {
  return def.describe.replace('{n}', new Intl.NumberFormat('vi-VN').format(target))
}

/** Các mốc đã đạt, mới nhất trước. */
export function milestones(states: readonly BadgeState[]): Milestone[] {
  return states
    .flatMap((s) => s.tiers.filter((t) => t.earnedAt !== null).map((t) => ({ group: s.def.group, title: s.def.title, text: describeTier(s.def, t.target), earnedAt: t.earnedAt! })))
    .sort((a, b) => b.earnedAt - a.earnedAt)
}
