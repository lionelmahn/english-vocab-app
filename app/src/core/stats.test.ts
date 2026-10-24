import { describe, expect, it } from 'vitest'
import { accuracy, buckets, dailyActivity, dayGoalState, lastDays, studyTimeByLog, totals, weekdayOf, weekGoal, weekStart, type StatLog } from './stats'

const TZ = 'Asia/Ho_Chi_Minh'
/** Giờ Việt Nam → mili-giây. */
const vn = (iso: string) => Date.parse(`${iso}+07:00`)

let n = 0
const log = (at: string, extra: Partial<StatLog> = {}): StatLog => ({
  itemId: `item-${n++}`,
  sessionId: 's1',
  reviewedAt: vn(at),
  mode: 'review',
  correct: true,
  affectsSchedule: true,
  responseMs: 4000,
  ...extra,
})

describe('studyTimeByLog — thời gian học ước tính', () => {
  it('câu đầu tính thời gian trả lời, câu sau tính khoảng cách; có giới hạn khi bỏ dở', () => {
    const a = log('2026-10-20T20:00:00', { responseMs: 5000 })
    const b = log('2026-10-20T20:00:30')
    const c = log('2026-10-20T21:00:00') // bỏ đi một tiếng rồi quay lại
    const d = log('2026-10-20T20:05:00', { sessionId: 's2', responseMs: 999_999 })
    const t = studyTimeByLog([c, a, b, d])
    expect([t.get(a), t.get(b), t.get(c), t.get(d)]).toEqual([5000, 30_000, 180_000, 120_000])
  })
})

describe('dailyActivity — hoạt động theo ngày học (R10.2)', () => {
  it('đếm lượt học mới/ôn, từ mới (mỗi từ một lần), tỷ lệ đúng; 2 giờ sáng tính cho hôm trước', () => {
    const logs = [
      log('2026-10-20T20:00:00', { mode: 'learn', itemId: 'run' }),
      log('2026-10-20T20:00:20', { mode: 'learn', itemId: 'run', affectsSchedule: false, correct: false }),
      log('2026-10-20T20:00:40', { mode: 'learn', itemId: 'walk', correct: null }),
      log('2026-10-21T02:00:00', { sessionId: 's3' }), // khuya: vẫn là ngày 20
      log('2026-10-21T19:00:00', { sessionId: 's4', mode: 'retry', correct: false }),
    ]
    const days = dailyActivity(logs, TZ)
    expect(days.get('2026-10-20')).toMatchObject({ learnAnswers: 3, reviewAnswers: 1, newWords: 2, graded: 3, correct: 2 })
    expect(days.get('2026-10-21')).toMatchObject({ learnAnswers: 0, reviewAnswers: 1, newWords: 0, graded: 1, correct: 0 })
  })
})

describe('khoảng thời gian', () => {
  it('lastDays, weekStart (thứ Hai), weekdayOf', () => {
    expect(lastDays('2026-11-01', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // Chủ nhật thuộc tuần bắt đầu thứ Hai 19/10
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekdayOf('2026-10-24')).toBe(6)
  })

  it('gộp theo ngày và theo tuần, tổng khớp nhau', () => {
    const logs = [log('2026-10-18T20:00:00'), log('2026-10-19T20:00:00', { sessionId: 'a' }), log('2026-10-25T20:00:00', { sessionId: 'b', mode: 'learn' })]
    const activity = dailyActivity(logs, TZ)
    const days = lastDays('2026-10-25', 8)
    const weekly = buckets(activity, days, true)
    expect(weekly.map((b) => [b.start, b.days.length, b.learnAnswers + b.reviewAnswers])).toEqual([
      ['2026-10-12', 1, 1],
      ['2026-10-19', 7, 2],
    ])
    expect(totals(weekly)).toEqual(totals(buckets(activity, days)))
    expect(accuracy(0, 0)).toBeNull()
    expect(accuracy(4, 3)).toBe(0.75)
  })
})

describe('mục tiêu (R10.4)', () => {
  const goals = { dailyNewWords: 10, dailyMinutes: 10, studyWeekdays: [1, 2, 3, 4, 5] }

  it('trạng thái từng ngày: đạt, chưa đủ, bỏ lỡ, nghỉ, hôm nay chưa học, chưa tới', () => {
    const full = { day: '2026-10-20', learnAnswers: 5, reviewAnswers: 20, newWords: 5, graded: 25, correct: 20, timeMs: 11 * 60_000 }
    const short = { ...full, timeMs: 3 * 60_000 }
    const today = '2026-10-22'
    expect(dayGoalState(full, '2026-10-20', today, goals)).toBe('met')
    expect(dayGoalState(short, '2026-10-20', today, goals)).toBe('partial')
    expect(dayGoalState(undefined, '2026-10-21', today, goals)).toBe('missed')
    expect(dayGoalState(undefined, '2026-10-18', today, goals)).toBe('rest') // Chủ nhật
    expect(dayGoalState(undefined, today, today, goals)).toBe('pending')
    expect(dayGoalState(undefined, '2026-10-23', today, goals)).toBe('future')
    expect(dayGoalState(short, '2026-10-18', today, { ...goals, dailyMinutes: 0 })).toBe('met')
  })

  it('tuần hiện tại: thứ Hai → Chủ nhật, đếm ngày theo lịch và ngày đạt', () => {
    const logs = [
      ...Array.from({ length: 12 }, (_, i) => log(`2026-10-19T20:${String(i).padStart(2, '0')}:00`, { sessionId: 'mon' })),
      log('2026-10-21T20:00:00', { sessionId: 'wed' }),
    ]
    const w = weekGoal(dailyActivity(logs, TZ), '2026-10-22', goals)
    expect(w.days.map((d) => d.state)).toEqual(['met', 'missed', 'partial', 'pending', 'future', 'future', 'future'])
    expect([w.scheduled, w.met]).toEqual([5, 1])
  })
})
