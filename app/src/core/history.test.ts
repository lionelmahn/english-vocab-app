import { describe, expect, it } from 'vitest'
import { sessionAnswers, sessionHistory, type HistoryLog } from './history'

const T0 = Date.parse('2026-10-25T12:00:00Z')
let n = 0
const log = (sessionId: string, itemId: string, sec: number, extra: Partial<HistoryLog> = {}): HistoryLog => ({
  id: `l${n++}`,
  itemId,
  sessionId,
  reviewedAt: T0 + sec * 1000,
  mode: 'review',
  exercise: 'mcq_meaning',
  correct: true,
  affectsSchedule: true,
  responseMs: 3000,
  ...extra,
})

describe('lịch sử bài làm (R6.8)', () => {
  const logs = [
    // Buổi ôn: a sai rồi luyện lại đúng, b đúng.
    log('s1', 'a', 0, { correct: false }),
    log('s1', 'b', 10),
    log('s1', 'a', 20, { affectsSchedule: false }),
    // Buổi kiểm tra sau đó: 3 câu, 2 đúng.
    log('s2', 'a', 600, { mode: 'test', affectsSchedule: false }),
    log('s2', 'b', 615, { mode: 'test', affectsSchedule: false, correct: false }),
    log('s2', 'c', 630, { mode: 'test', affectsSchedule: false }),
  ]

  it('mỗi buổi một dòng, mới nhất trước; đúng/sai theo câu trả lời đầu tiên của mỗi từ', () => {
    const [test, review] = sessionHistory(logs)
    expect(test).toMatchObject({ sessionId: 's2', mode: 'test', items: 3, correct: 2, wrong: 1, answers: 3 })
    expect(review).toMatchObject({ sessionId: 's1', mode: 'review', items: 2, correct: 1, wrong: 1, answers: 3, startedAt: T0, endedAt: T0 + 20_000 })
    // Câu đầu tính thời gian trả lời (3 giây), các câu sau tính khoảng cách tới câu trước.
    expect(review.durationMs).toBe(3000 + 10_000 + 10_000)
  })

  it('các câu của một buổi theo thứ tự làm, đánh dấu lượt luyện lại', () => {
    expect(sessionAnswers(logs, 's1').map((a) => [a.log.itemId, a.attempt])).toEqual([
      ['a', 0],
      ['b', 0],
      ['a', 1],
    ])
    expect(sessionAnswers(logs, 'không có')).toEqual([])
  })
})
