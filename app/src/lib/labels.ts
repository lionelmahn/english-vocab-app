import type { ExerciseKind, SessionMode } from '../core/grading'

export const EXERCISE_LABEL: Record<ExerciseKind, string> = {
  flashcard: 'Thẻ tự đánh giá',
  mcq_meaning: 'Trắc nghiệm nghĩa',
  recall_typing: 'Gõ từ theo nghĩa',
  dictation: 'Nghe và viết',
  cloze_typing: 'Gõ từ hợp với câu',
  cloze_choice: 'Chọn từ hợp với câu',
  matching: 'Ghép từ và nghĩa',
  listen_choose: 'Nghe chọn nghĩa',
  audio_choice: 'Chọn âm thanh',
}

export const GRADE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Quên',
  2: 'Khó',
  3: 'Nhớ',
  4: 'Dễ',
}

export const MODE_LABEL: Record<SessionMode, string> = {
  learn: 'Học từ mới',
  review: 'Ôn tập',
  retry: 'Luyện lại',
  practice: 'Luyện tự do',
  test: 'Kiểm tra',
}

/** Tên buổi trong câu ("Buổi … đang dở"). */
export const SESSION_NOUN: Record<SessionMode, string> = {
  learn: 'học',
  review: 'ôn',
  retry: 'luyện lại',
  practice: 'luyện',
  test: 'kiểm tra',
}
