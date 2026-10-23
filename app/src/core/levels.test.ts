import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import { levelDistribution, memoryLevel } from './levels'

const card = (state: State, stability: number, reps = 3) => ({ state, stability, reps })

describe('memoryLevel — mục 2.3b', () => {
  it('chưa học là cấp 0', () => {
    expect(memoryLevel(card(State.New, 0, 0))).toBe(0)
  })

  it('đang học hoặc học lại là cấp 1', () => {
    expect(memoryLevel(card(State.Learning, 0.5))).toBe(1)
    expect(memoryLevel(card(State.Relearning, 40))).toBe(1)
  })

  it('ôn tập: chia cấp theo độ bền trí nhớ', () => {
    expect(memoryLevel(card(State.Review, 0.8))).toBe(1)
    expect(memoryLevel(card(State.Review, 1))).toBe(2)
    expect(memoryLevel(card(State.Review, 6.9))).toBe(2)
    expect(memoryLevel(card(State.Review, 7))).toBe(3)
    expect(memoryLevel(card(State.Review, 30))).toBe(4)
    expect(memoryLevel(card(State.Review, 89))).toBe(4)
    expect(memoryLevel(card(State.Review, 90))).toBe(5)
  })

  it('đếm phân bố theo cấp', () => {
    const dist = levelDistribution([card(State.New, 0, 0), card(State.Review, 10), card(State.Review, 12), card(State.Review, 200)])
    expect(dist).toEqual({ 0: 1, 1: 0, 2: 0, 3: 2, 4: 0, 5: 1 })
  })
})
