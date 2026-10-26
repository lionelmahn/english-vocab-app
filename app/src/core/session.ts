import { Rating, type Grade } from 'ts-fsrs'
import { withoutAudio } from './exercises'
import { affectsSchedule, gradeAttempt, type AttemptResult, type ExerciseKind, type SessionMode } from './grading'

/**
 * Bộ máy một buổi học/ôn (R4, R5.3, R5.5, R5.10, R6.12). Thuần, không đọc CSDL:
 * nhận hành động của người học, trả về kế hoạch mới và tác động cần ghi (lượt trả lời, lịch ôn).
 */

export type StepKind =
  | 'intro' // giới thiệu từ mới bằng flashcard (R4.2)
  | 'known_check' // kiểm tra nhanh khi người học báo "đã biết" (R4.8)
  | 'exercise' // bài kiểm tra/ôn — lần đầu tính lịch (R4.4, R5.3)
  | 'retry' // luyện lại sau khi sai — không đổi lịch (R5.5)

export interface Step {
  itemId: string
  kind: StepKind
  exercise: ExerciseKind
}

export interface ItemOutcome {
  /** Điểm của lần trả lời được tính lịch; null nếu chưa có. */
  grade: Grade | null
  wrong: number
  retries: number
  /** Người học báo đã biết và kiểm tra nhanh đúng (R4.8). */
  known: boolean
}

export interface SessionPlan {
  mode: SessionMode
  steps: Step[]
  cursor: number
  outcomes: Record<string, ItemOutcome>
  audioOff: boolean
  startedAt: number
  /** Thời gian học thực tế (mili-giây), không tính lúc tạm dừng hay bỏ máy. */
  activeMs?: number
  /** Bài kiểm tra có giới hạn thời gian (R6.6): hết giờ tính từ lúc bắt đầu thì kết thúc. */
  timeLimitMs?: number
  /** Bài luyện câu mới (R8.5): câu do AI soạn cho từng từ, dùng thay câu ví dụ quen thuộc ở bài điền từ. */
  contexts?: Record<string, { en: string; vi?: string }>
}

export type SessionAction =
  | { type: 'intro_next' }
  | { type: 'intro_known' }
  | { type: 'answer'; result: AttemptResult }
  /** "Không tiện nghe": đổi bài hiện tại và các bài nghe phía sau (R6.12). */
  | { type: 'no_audio' }

export interface AnswerEffect {
  /** Có ghi một lượt trả lời không. */
  log: boolean
  grade: Grade | null
  correct: boolean | null
  /** Cập nhật lịch ôn của từ này bằng `grade`. */
  schedule: boolean
  /** Đã xếp thêm một lượt luyện lại. */
  requeued: boolean
}

const NO_EFFECT: AnswerEffect = { log: false, grade: null, correct: null, schedule: false, requeued: false }

/** Thời gian tối đa tính cho một bước, để lúc bỏ máy không bị cộng vào thời gian học. */
export const MAX_STEP_MS = 120_000

/** Cộng thời gian của một bước vào thời gian học thực tế. */
export function addActiveTime(plan: SessionPlan, stepMs: number): SessionPlan {
  return { ...plan, activeMs: (plan.activeMs ?? 0) + Math.max(0, Math.min(stepMs, MAX_STEP_MS)) }
}

/** Số lượt luyện lại tối đa cho một từ trong một buổi. */
export const MAX_RETRIES = 2
/** Luyện lại sau bao nhiêu bước (để não có chút thời gian quên). */
export const RETRY_GAP = 3
/** Học từ mới: giới thiệu một từ rồi kiểm tra ngay từ đó (theo yêu cầu người học). */
export const LEARN_CHUNK = 1

function emptyOutcome(): ItemOutcome {
  return { grade: null, wrong: 0, retries: 0, known: false }
}

function initOutcomes(itemIds: readonly string[]): Record<string, ItemOutcome> {
  return Object.fromEntries(itemIds.map((id) => [id, emptyOutcome()]))
}

/** Buổi học mới: lật thẻ giới thiệu, rồi kiểm tra ngay từ vừa học (R4.2, R4.4). */
export function planLearn(itemIds: readonly string[], checkFor: (itemId: string) => ExerciseKind, startedAt: number): SessionPlan {
  const steps: Step[] = []
  for (let i = 0; i < itemIds.length; i += LEARN_CHUNK) {
    const chunk = itemIds.slice(i, i + LEARN_CHUNK)
    for (const id of chunk) steps.push({ itemId: id, kind: 'intro', exercise: 'flashcard' })
    for (const id of chunk) steps.push({ itemId: id, kind: 'exercise', exercise: checkFor(id) })
  }
  return { mode: 'learn', steps, cursor: 0, outcomes: initOutcomes(itemIds), audioOff: false, startedAt }
}

/** Buổi ôn theo lịch hoặc luyện tự do (R5.3, R5.7). */
export function planReview(
  itemIds: readonly string[],
  exerciseFor: (itemId: string) => ExerciseKind,
  startedAt: number,
  mode: SessionMode = 'review',
): SessionPlan {
  return {
    mode,
    steps: itemIds.map((id) => ({ itemId: id, kind: 'exercise' as const, exercise: exerciseFor(id) })),
    cursor: 0,
    outcomes: initOutcomes(itemIds),
    audioOff: false,
    startedAt,
  }
}

/**
 * Bài kiểm tra tùy chọn (R6.6): mỗi từ một câu, dạng bài đã chọn sẵn; không làm đổi lịch ôn, trả lời sai không có
 * lượt luyện lại. `timeLimitMs` = giới hạn thời gian (không có = không giới hạn).
 */
export function planTest(items: readonly { id: string; exercise: ExerciseKind }[], startedAt: number, timeLimitMs?: number): SessionPlan {
  return {
    mode: 'test',
    steps: items.map((i) => ({ itemId: i.id, kind: 'exercise' as const, exercise: i.exercise })),
    cursor: 0,
    outcomes: initOutcomes(items.map((i) => i.id)),
    audioOff: false,
    startedAt,
    ...(timeLimitMs ? { timeLimitMs } : {}),
  }
}

/** Thời gian còn lại của bài kiểm tra có giới hạn (mili-giây, không âm); null nếu không giới hạn. */
export function timeLeft(plan: SessionPlan, now: number): number | null {
  return plan.timeLimitMs ? Math.max(0, plan.startedAt + plan.timeLimitMs - now) : null
}

export function currentStep(plan: SessionPlan): Step | undefined {
  return plan.steps[plan.cursor]
}

export function isFinished(plan: SessionPlan): boolean {
  return plan.cursor >= plan.steps.length
}

export function progress(plan: SessionPlan): { done: number; total: number } {
  return { done: Math.min(plan.cursor, plan.steps.length), total: plan.steps.length }
}

function insertAt<T>(arr: T[], index: number, value: T): T[] {
  const out = [...arr]
  out.splice(Math.min(index, out.length), 0, value)
  return out
}

export function applyAction(plan: SessionPlan, action: SessionAction): { plan: SessionPlan; effect: AnswerEffect } {
  const step = currentStep(plan)
  if (!step) return { plan, effect: NO_EFFECT }
  const outcome = plan.outcomes[step.itemId] ?? emptyOutcome()

  switch (action.type) {
    case 'intro_next':
      return { plan: { ...plan, cursor: plan.cursor + 1 }, effect: NO_EFFECT }

    case 'intro_known': {
      // Kiểm tra nhanh bằng bài nhớ lại ngay sau thẻ giới thiệu.
      const steps = insertAt<Step>(plan.steps, plan.cursor + 1, { itemId: step.itemId, kind: 'known_check', exercise: 'recall_typing' })
      return { plan: { ...plan, steps, cursor: plan.cursor + 1 }, effect: NO_EFFECT }
    }

    case 'no_audio': {
      const steps = plan.steps.map((s, i) => (i >= plan.cursor ? { ...s, exercise: withoutAudio(s.exercise) } : s))
      return { plan: { ...plan, steps, audioOff: true }, effect: NO_EFFECT }
    }

    case 'answer': {
      if (action.result.kind === 'cannot_listen') return applyAction(plan, { type: 'no_audio' })
      const grade = gradeAttempt(action.result)
      const correct = grade !== null && grade !== Rating.Again
      let steps = plan.steps
      const next: ItemOutcome = { ...outcome }

      if (step.kind === 'known_check') {
        // Phải tự điền đúng, không gợi ý, không nhờ "Tính là đúng" (mức Khó), mới tính là đã biết và hẹn ôn xa.
        if (correct && grade !== Rating.Hard) {
          // Đã biết thật: lên lịch như "Dễ" và bỏ các bước còn lại của từ này.
          next.known = true
          next.grade = Rating.Easy
          steps = steps.filter((s, i) => i <= plan.cursor || s.itemId !== step.itemId)
          return {
            plan: { ...plan, steps, cursor: plan.cursor + 1, outcomes: { ...plan.outcomes, [step.itemId]: next } },
            effect: { log: true, grade: Rating.Easy, correct: true, schedule: true, requeued: false },
          }
        }
        // Chưa biết: không tính là quên, học tiếp như từ mới.
        return {
          plan: { ...plan, cursor: plan.cursor + 1 },
          effect: { log: true, grade: null, correct: false, schedule: false, requeued: false },
        }
      }

      const counts = step.kind === 'exercise' && next.grade === null && affectsSchedule(plan.mode, true)
      if (counts) next.grade = grade
      let requeued = false
      if (!correct) {
        next.wrong++
        // Bài kiểm tra không có lượt luyện lại.
        if (next.retries < MAX_RETRIES && plan.mode !== 'test') {
          next.retries++
          const retryExercise = plan.audioOff ? withoutAudio(step.exercise) : step.exercise
          steps = insertAt<Step>(steps, plan.cursor + 1 + RETRY_GAP, { itemId: step.itemId, kind: 'retry', exercise: retryExercise })
          requeued = true
        }
      }
      return {
        plan: { ...plan, steps, cursor: plan.cursor + 1, outcomes: { ...plan.outcomes, [step.itemId]: next } },
        effect: { log: true, grade, correct, schedule: counts && grade !== null, requeued },
      }
    }
  }
}

export interface SessionSummary {
  items: number
  correct: number
  wrong: number
  known: number
  /** Từ cần củng cố: sai hoặc chỉ nhớ được ở mức "Khó". */
  needWork: string[]
  durationMs: number
}

export function summarize(plan: SessionPlan, endedAt: number): SessionSummary {
  // Chỉ đếm từ đã làm tới (đã trả lời ít nhất một bước, không tính thẻ giới thiệu): kết thúc sớm thì từ chưa làm không tính.
  const reached = new Set(plan.steps.slice(0, plan.cursor).filter((s) => s.kind !== 'intro').map((s) => s.itemId))
  let correct = 0
  let wrong = 0
  let known = 0
  const needWork: string[] = []
  for (const [id, o] of Object.entries(plan.outcomes)) {
    if (!reached.has(id)) continue
    if (o.known) known++
    // Buổi luyện lại, luyện tự do, kiểm tra không tính lịch nên không có điểm: từ có trả lời sai là Quên, còn lại là Nhớ.
    const grade = o.grade ?? (plan.mode === 'retry' || plan.mode === 'practice' || plan.mode === 'test' ? (o.wrong > 0 ? Rating.Again : Rating.Good) : null)
    if (grade === null) continue
    if (grade === Rating.Again) wrong++
    else correct++
    if (grade === Rating.Again || grade === Rating.Hard || o.wrong > 0) needWork.push(id)
  }
  const durationMs = plan.activeMs ?? Math.max(0, endedAt - plan.startedAt)
  return { items: reached.size, correct, wrong, known, needWork, durationMs }
}
