import type { ExerciseKind } from '../core/grading'

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
