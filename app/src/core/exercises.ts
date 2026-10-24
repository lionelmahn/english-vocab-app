import type { ExerciseKind } from './grading'
import type { MemoryLevel } from './levels'
import type { PartOfSpeech } from './pos'
import { meaningKey } from './vocab'

/** Chọn dạng bài và tạo phương án trắc nghiệm (R6.1–R6.3, R6.12). */

export type ReviewStyle = 'exercises' | 'flashcard'

export interface ExerciseOptions {
  /** Đang tắt âm thanh (không tiện nghe) hoặc thiết bị không đọc được. */
  audioOff: boolean
  /** Sổ tay có đủ nghĩa khác để làm phương án nhiễu. */
  canMultipleChoice: boolean
  style: ReviewStyle
}

/** Dạng bài cần nghe. */
export const AUDIO_EXERCISES: ReadonlySet<ExerciseKind> = new Set(['dictation', 'listen_choose', 'audio_choice'])

/**
 * Từ còn mới: nhận diện (trắc nghiệm, nghe chọn nghĩa). Nhớ khá trở lên: nhớ lại (điền từ, nghe viết)
 * xen với chọn âm thanh. `reps` (số lần đã ôn) dùng để luân phiên dạng bài giữa các lần ôn.
 */
export function chooseExercise(level: MemoryLevel, reps: number, opts: ExerciseOptions): ExerciseKind {
  if (opts.style === 'flashcard') return 'flashcard'
  let cycle: ExerciseKind[]
  if (level <= 1) cycle = ['mcq_meaning', 'listen_choose', 'recall_typing']
  else if (level <= 3) cycle = ['recall_typing', 'audio_choice', 'mcq_meaning', 'dictation']
  else cycle = ['recall_typing', 'dictation', 'audio_choice']
  let pick = cycle[reps % cycle.length]
  if (opts.audioOff) pick = withoutAudio(pick)
  if (!opts.canMultipleChoice && CHOICE_EXERCISES.has(pick)) pick = 'recall_typing'
  return pick
}

/** Bài kiểm tra ngay sau khi học từ mới (R4.4). */
export function checkExercise(opts: Pick<ExerciseOptions, 'canMultipleChoice'>): ExerciseKind {
  return opts.canMultipleChoice ? 'mcq_meaning' : 'recall_typing'
}

/** Dạng bài chọn phương án (cần đủ từ trong sổ tay để làm phương án nhiễu). */
export const CHOICE_EXERCISES: ReadonlySet<ExerciseKind> = new Set(['mcq_meaning', 'listen_choose', 'audio_choice', 'cloze_choice', 'matching'])

/** Thay dạng bài cần nghe bằng dạng không cần âm thanh, giữ độ khó tương đương (R6.12). */
export function withoutAudio(kind: ExerciseKind): ExerciseKind {
  if (kind === 'listen_choose') return 'mcq_meaning'
  return AUDIO_EXERCISES.has(kind) ? 'recall_typing' : kind
}

export const MIN_CHOICES = 4

export interface ChoiceSource {
  id: string
  meaningVi: string
  partOfSpeech: PartOfSpeech
}

/** Bộ sinh số ngẫu nhiên có hạt giống, để test lặp lại được. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Phương án cho trắc nghiệm nghĩa: 1 đúng + 3 nghĩa khác (ưu tiên cùng loại từ để khó đoán hơn).
 * Trả về null nếu không đủ nghĩa khác nhau.
 */
export function buildMeaningChoices(
  target: ChoiceSource,
  pool: readonly ChoiceSource[],
  rand: () => number = Math.random,
  count = MIN_CHOICES,
): ChoiceSource[] | null {
  const targetKey = meaningKey(target.meaningVi)
  const seen = new Set([targetKey])
  const candidates: ChoiceSource[] = []
  for (const c of pool) {
    const k = meaningKey(c.meaningVi)
    if (c.id === target.id || !k || seen.has(k)) continue
    seen.add(k)
    candidates.push(c)
  }
  if (candidates.length < count - 1) return null
  const samePos = shuffle(
    candidates.filter((c) => c.partOfSpeech === target.partOfSpeech),
    rand,
  )
  const others = shuffle(
    candidates.filter((c) => c.partOfSpeech !== target.partOfSpeech),
    rand,
  )
  const distractors = [...samePos, ...others].slice(0, count - 1)
  return shuffle([target, ...distractors], rand)
}

export interface TermSource extends ChoiceSource {
  term: string
}

/**
 * Phương án cho "chọn âm thanh đúng" (R6.11): 1 từ đúng + từ khác (khác mặt chữ, ưu tiên cùng loại từ).
 * Trả về null nếu không đủ từ khác nhau.
 */
export function buildTermChoices<T extends TermSource>(target: T, pool: readonly T[], rand: () => number = Math.random, count = 3): T[] | null {
  const seen = new Set([target.term.trim().toLowerCase()])
  const candidates: T[] = []
  for (const c of pool) {
    const k = c.term.trim().toLowerCase()
    if (c.id === target.id || !k || seen.has(k)) continue
    seen.add(k)
    candidates.push(c)
  }
  if (candidates.length < count - 1) return null
  const samePos = shuffle(
    candidates.filter((c) => c.partOfSpeech === target.partOfSpeech),
    rand,
  )
  const others = shuffle(
    candidates.filter((c) => c.partOfSpeech !== target.partOfSpeech),
    rand,
  )
  return shuffle([target, ...[...samePos, ...others].slice(0, count - 1)], rand)
}

/** Đếm số nghĩa khác nhau trong sổ tay, để biết có làm được trắc nghiệm không. */
export function distinctMeaningCount(pool: readonly { meaningVi: string }[]): number {
  return new Set(pool.map((p) => meaningKey(p.meaningVi)).filter(Boolean)).size
}

/** Gợi ý chữ cái (dùng cho R6.9 về sau; giai đoạn 1 dùng để hiện độ dài đáp án). */
export function answerMask(answer: string): string {
  return answer.replace(/[A-Za-zÀ-ỹ]/g, '_')
}
