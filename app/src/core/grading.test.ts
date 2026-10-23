import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { affectsSchedule, gradeAttempt } from './grading'

describe('gradeAttempt — bảng quy đổi mục 2.3a', () => {
  it('tự đánh giá Quên/Khó/Nhớ/Dễ', () => {
    expect(gradeAttempt({ kind: 'self_rating', rating: 'again' })).toBe(Rating.Again)
    expect(gradeAttempt({ kind: 'self_rating', rating: 'hard' })).toBe(Rating.Hard)
    expect(gradeAttempt({ kind: 'self_rating', rating: 'good' })).toBe(Rating.Good)
    expect(gradeAttempt({ kind: 'self_rating', rating: 'easy' })).toBe(Rating.Easy)
  })

  it('"Mình không thuộc từ này" là quên', () => {
    expect(gradeAttempt({ kind: 'dont_know' })).toBe(Rating.Again)
  })

  it('không tiện nghe thì không chấm', () => {
    expect(gradeAttempt({ kind: 'cannot_listen' })).toBeNull()
  })

  it('trả lời sai là quên, ở mọi dạng bài', () => {
    expect(gradeAttempt({ kind: 'answer', exercise: 'mcq_meaning', correct: false })).toBe(Rating.Again)
    expect(gradeAttempt({ kind: 'answer', exercise: 'recall_typing', correct: false })).toBe(Rating.Again)
  })

  it('dạng nhận diện đúng tối đa là Good, kể cả khi xin nâng lên Easy', () => {
    expect(gradeAttempt({ kind: 'answer', exercise: 'mcq_meaning', correct: true })).toBe(Rating.Good)
    expect(gradeAttempt({ kind: 'answer', exercise: 'matching', correct: true, upgradeToEasy: true })).toBe(Rating.Good)
  })

  it('dạng nhớ lại đúng là Good, người học được nâng lên Easy', () => {
    expect(gradeAttempt({ kind: 'answer', exercise: 'recall_typing', correct: true })).toBe(Rating.Good)
    expect(gradeAttempt({ kind: 'answer', exercise: 'dictation', correct: true, upgradeToEasy: true })).toBe(Rating.Easy)
  })

  it('đúng nhờ gợi ý hoặc gần đúng thì là Hard', () => {
    expect(gradeAttempt({ kind: 'answer', exercise: 'recall_typing', correct: true, hintUsed: true })).toBe(Rating.Hard)
    expect(
      gradeAttempt({ kind: 'answer', exercise: 'dictation', correct: true, nearMatchAccepted: true, upgradeToEasy: true }),
    ).toBe(Rating.Hard)
  })
})

describe('affectsSchedule — chỉ lần trả lời đầu tiên trong buổi học/ôn được tính lịch', () => {
  it('học mới và ôn theo lịch: chỉ lần đầu', () => {
    expect(affectsSchedule('review', true)).toBe(true)
    expect(affectsSchedule('review', false)).toBe(false)
    expect(affectsSchedule('learn', true)).toBe(true)
  })

  it('luyện lại, ôn chủ động, kiểm tra: không đổi lịch', () => {
    expect(affectsSchedule('retry', true)).toBe(false)
    expect(affectsSchedule('practice', true)).toBe(false)
    expect(affectsSchedule('test', true)).toBe(false)
  })
})
