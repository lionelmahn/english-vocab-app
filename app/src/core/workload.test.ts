import { describe, expect, it } from 'vitest'
import type { StatLog } from './stats'
import { DEFAULT_NEW_SEC, DEFAULT_REVIEW_SEC, adviseNewWords, estimatePace, type Pace } from './workload'

const NOW = Date.parse('2026-10-25T13:00:00Z')
const MIN = 60_000

/** Một buổi: mỗi từ `per` lượt, các lượt cách nhau `gapSec` giây, lượt đầu trả lời trong `gapSec` giây. */
function session(id: string, mode: StatLog['mode'], words: number, gapSec: number, start: number, per = 1): StatLog[] {
  const logs: StatLog[] = []
  for (let w = 0; w < words; w++) {
    for (let k = 0; k < per; k++) {
      const i = w * per + k
      logs.push({ itemId: `${id}-w${w}`, sessionId: id, reviewedAt: start + i * gapSec * 1000, mode, correct: true, affectsSchedule: k === 0, responseMs: gapSec * 1000 })
    }
  }
  return logs
}

describe('estimatePace — tốc độ học của người học', () => {
  it('chưa đủ dữ liệu thì dùng số mặc định', () => {
    const pace = estimatePace(session('s1', 'review', 5, 30, NOW - 60 * MIN), NOW)
    expect(pace).toEqual({ reviewSec: DEFAULT_REVIEW_SEC, newSec: DEFAULT_NEW_SEC, personal: { review: false, new: false } })
  })

  it('đủ dữ liệu thì tính từ lịch sử 30 ngày gần nhất; lượt luyện lại trong buổi tính vào cùng từ', () => {
    const logs = [
      ...session('r1', 'review', 20, 10, NOW - 2 * 24 * 60 * MIN),
      // Học mới: mỗi từ hai lượt (điền từ và luyện lại), 20 giây mỗi lượt → 40 giây mỗi từ.
      ...session('l1', 'learn', 10, 20, NOW - 24 * 60 * MIN, 2),
      // Buổi cũ hơn 30 ngày (rất chậm) không tính.
      ...session('old', 'review', 30, 100, NOW - 40 * 24 * 60 * MIN),
    ]
    expect(estimatePace(logs, NOW)).toEqual({ reviewSec: 10, newSec: 40, personal: { review: true, new: true } })
  })

  it('kẹp số liệu bất thường vào khoảng hợp lý', () => {
    const fast = estimatePace(session('r1', 'review', 25, 1, NOW - 60 * MIN), NOW)
    expect(fast.reviewSec).toBe(3)
  })
})

describe('adviseNewWords — gợi ý số từ mới hôm nay (R9.5)', () => {
  const pace: Pace = { reviewSec: 12, newSec: 45, personal: { review: true, new: true } }
  const base = { goalNew: 10, goalMinutes: 15, learnedToday: 0, dueToday: 0, pace }

  it('ít từ cần ôn thì học đủ mục tiêu', () => {
    expect(adviseNewWords(base)).toEqual({ suggested: 10, goalLeft: 10, reviewMinutes: 0, reason: 'full' })
    // 30 từ ôn ≈ 6 phút, còn 9 phút đủ cho 10 từ mới (7,5 phút).
    expect(adviseNewWords({ ...base, dueToday: 30 })).toMatchObject({ suggested: 10, reviewMinutes: 6, reason: 'full' })
  })

  it('nhiều từ cần ôn thì gợi ý ít từ mới hơn; ôn đã kín thời gian thì nên ôn trước', () => {
    // 60 từ ôn ≈ 12 phút, còn 3 phút → 4 từ mới.
    expect(adviseNewWords({ ...base, dueToday: 60 })).toEqual({ suggested: 4, goalLeft: 10, reviewMinutes: 12, reason: 'reduced' })
    expect(adviseNewWords({ ...base, dueToday: 80 })).toEqual({ suggested: 0, goalLeft: 10, reviewMinutes: 16, reason: 'review-first' })
  })

  it('tính theo phần mục tiêu còn thiếu hôm nay', () => {
    expect(adviseNewWords({ ...base, learnedToday: 6, dueToday: 60 })).toMatchObject({ suggested: 4, goalLeft: 4, reason: 'full' })
    expect(adviseNewWords({ ...base, learnedToday: 12 })).toMatchObject({ suggested: 0, goalLeft: 0, reason: 'goal-done' })
  })

  it('không đặt mục tiêu số phút thì không giảm', () => {
    expect(adviseNewWords({ ...base, goalMinutes: 0, dueToday: 500 })).toMatchObject({ suggested: 10, reason: 'no-time-goal' })
  })

  it('mục tiêu số phút ngắn hơn thời gian học đủ từ mới: chỉ lượng ôn mới làm giảm số từ', () => {
    expect(adviseNewWords({ ...base, goalMinutes: 5 })).toMatchObject({ suggested: 10, reason: 'full' })
    expect(adviseNewWords({ ...base, goalMinutes: 5, dueToday: 1 })).toMatchObject({ suggested: 9, reason: 'reduced' })
  })
})
