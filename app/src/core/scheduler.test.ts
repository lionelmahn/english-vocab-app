import { describe, expect, it } from 'vitest'
import { default_w, Rating, State } from 'ts-fsrs'
import { applyReview, configureScheduler, createScheduler, intervalRatio, isDue, newCard, replayReviews, type ScheduledReview } from './scheduler'

const t0 = new Date('2026-10-01T08:00:00Z')
const at = (days: number, minutes = 0) => new Date(t0.getTime() + days * 86_400_000 + minutes * 60_000)

describe('scheduler', () => {
  const s = createScheduler()

  it('thẻ mới đến hạn ngay', () => {
    expect(isDue(newCard(t0), t0)).toBe(true)
  })

  it('nhớ (Good) thì lần ôn sau xa hơn quên (Again)', () => {
    const card = newCard(t0)
    const good = applyReview(s, card, Rating.Good, t0).card
    const again = applyReview(s, card, Rating.Again, t0).card
    expect(good.due.getTime()).toBeGreaterThan(again.due.getTime())
  })

  it('ôn đúng liên tiếp thì khoảng ôn tăng dần', () => {
    let card = newCard(t0)
    let now = t0
    const intervals: number[] = []
    for (let i = 0; i < 5; i++) {
      card = applyReview(s, card, Rating.Good, now).card
      intervals.push(card.due.getTime() - now.getTime())
      now = card.due
    }
    expect(card.state).toBe(State.Review)
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1])
  })

  it('quên khi đang ôn thì tăng số lần quên và chuyển sang học lại', () => {
    let card = newCard(t0)
    card = applyReview(s, card, Rating.Good, t0).card
    card = applyReview(s, card, Rating.Good, card.due).card
    card = applyReview(s, card, Rating.Good, card.due).card
    const lapsed = applyReview(s, card, Rating.Again, card.due).card
    expect(lapsed.lapses).toBe(card.lapses + 1)
    expect(lapsed.state).toBe(State.Relearning)
  })
})

describe('replayReviews — đồng bộ không mất lượt, không phụ thuộc thứ tự', () => {
  const s = createScheduler()
  const logs: ScheduledReview[] = [
    { id: 'a', reviewedAt: at(0), grade: Rating.Good },
    { id: 'b', reviewedAt: at(0, 10), grade: Rating.Good },
    { id: 'c', reviewedAt: at(3), grade: Rating.Hard },
    { id: 'd', reviewedAt: at(9), grade: Rating.Again },
    { id: 'e', reviewedAt: at(9, 5), grade: Rating.Good },
  ]

  it('cho cùng kết quả với ôn tuần tự', () => {
    let card = newCard(t0)
    for (const l of logs) card = applyReview(s, card, l.grade, l.reviewedAt).card
    expect(replayReviews(s, t0, logs)).toEqual(card)
  })

  it('đảo thứ tự nhận dữ liệu vẫn ra cùng kết quả', () => {
    const shuffled = [logs[3], logs[0], logs[4], logs[2], logs[1]]
    expect(replayReviews(s, t0, shuffled)).toEqual(replayReviews(s, t0, logs))
  })

  it('nhận trùng một lượt (gửi lại khi mạng chập chờn) không bị tính hai lần', () => {
    const withDup = [...logs, { ...logs[2] }]
    expect(replayReviews(s, t0, withDup)).toEqual(replayReviews(s, t0, logs))
  })
})

describe('mục tiêu ghi nhớ và tham số riêng (R5.13)', () => {
  it('đổi mục tiêu ghi nhớ trên bộ lập lịch đang dùng: mục tiêu thấp thì hẹn xa hơn', () => {
    const s = createScheduler()
    const review = () => {
      let card = newCard(t0)
      let now = t0
      for (let i = 0; i < 4; i++) {
        card = applyReview(s, card, Rating.Good, now).card
        now = card.due
      }
      return card.scheduled_days
    }
    const base = review()
    configureScheduler(s, { requestRetention: 0.8 })
    expect(review()).toBeGreaterThan(base)
    configureScheduler(s, { requestRetention: 0.95 })
    expect(review()).toBeLessThan(base)
    configureScheduler(s, { requestRetention: 0.9 })
    expect(review()).toBe(base)
  })

  it('dùng tham số riêng, rồi về lại mặc định', () => {
    const s = createScheduler()
    const w = [...default_w]
    w[0] = 2
    configureScheduler(s, { requestRetention: 0.9, weights: w })
    expect(s.parameters.w[0]).toBe(2)
    configureScheduler(s, { requestRetention: 0.9, weights: null })
    expect(s.parameters.w[0]).toBe(default_w[0])
  })

  it('tỷ lệ khoảng cách ôn so với 90%', () => {
    expect(intervalRatio(0.9)).toBeCloseTo(1, 6)
    expect(intervalRatio(0.85)).toBeGreaterThan(1.5)
    expect(intervalRatio(0.95)).toBeLessThan(0.6)
  })
})
