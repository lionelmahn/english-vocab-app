import { Rating, type Grade } from 'ts-fsrs'

/**
 * Quy đổi kết quả bài làm sang điểm FSRS (kế hoạch mục 2.3a).
 * Quy tắc chung: không coi mọi câu đúng có giá trị như nhau.
 */

export type ExerciseKind =
  | 'flashcard' // R4.2 — người học tự đánh giá
  | 'mcq_meaning' // R6.1 trắc nghiệm nghĩa
  | 'recall_typing' // R6.2 gõ từ từ nghĩa
  | 'dictation' // R6.3 nghe và viết lại
  | 'cloze_typing' // R6.4 điền từ (gõ)
  | 'cloze_choice' // R6.4 điền từ (chọn)
  | 'matching' // R6.5 ghép từ và nghĩa
  | 'listen_choose' // R6.10 nghe và chọn nghĩa
  | 'audio_choice' // R6.11 chọn âm thanh theo nghĩa

/** Dạng nhận diện: có thể đoán đúng, nên tối đa chỉ được Good. */
export const RECOGNITION_KINDS: ReadonlySet<ExerciseKind> = new Set([
  'mcq_meaning',
  'cloze_choice',
  'matching',
  'listen_choose',
  'audio_choice',
])

export type SelfRating = 'again' | 'hard' | 'good' | 'easy'

export type AttemptResult =
  | { kind: 'self_rating'; rating: SelfRating } // R4.5
  | { kind: 'dont_know' } // R5.10 "Mình không thuộc từ này"
  | { kind: 'cannot_listen' } // R6.12 không tiện nghe — không phải quên
  | {
      kind: 'answer'
      exercise: ExerciseKind
      correct: boolean
      hintUsed?: boolean // R6.9
      hintLevel?: number // R6.9 số lần dùng gợi ý (lưu vào lịch sử)
      nearMatchAccepted?: boolean // sai 1 ký tự, người học chấp nhận
      upgradeToEasy?: boolean // người học tự nâng lên Dễ (chỉ dạng nhớ lại)
    }

const SELF_RATING_TO_GRADE: Record<SelfRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

/** Trả về điểm FSRS, hoặc null nếu lượt này không được chấm (ví dụ không tiện nghe). */
export function gradeAttempt(result: AttemptResult): Grade | null {
  switch (result.kind) {
    case 'self_rating':
      return SELF_RATING_TO_GRADE[result.rating]
    case 'dont_know':
      return Rating.Again
    case 'cannot_listen':
      return null
    case 'answer': {
      if (!result.correct) return Rating.Again
      if (result.hintUsed || result.nearMatchAccepted) return Rating.Hard
      if (RECOGNITION_KINDS.has(result.exercise)) return Rating.Good
      return result.upgradeToEasy ? Rating.Easy : Rating.Good
    }
  }
}

export type SessionMode =
  | 'learn' // R4 học mới
  | 'review' // R5.3 ôn theo lịch
  | 'retry' // R5.5 luyện lại sau khi sai
  | 'practice' // R5.7 ôn chủ động trước hạn
  | 'test' // R6.6 bài kiểm tra tùy chọn

/**
 * Một lượt trả lời có được tính vào lịch ôn không.
 * Mỗi từ chỉ có một lần chấm tính lịch trong một buổi: lần trả lời đầu tiên.
 * Luyện lại, ôn chủ động và kiểm tra chỉ ghi lịch sử, không đổi lịch.
 */
export function affectsSchedule(mode: SessionMode, isFirstAttemptForItemInSession: boolean): boolean {
  if (mode !== 'learn' && mode !== 'review') return false
  return isFirstAttemptForItemInSession
}
