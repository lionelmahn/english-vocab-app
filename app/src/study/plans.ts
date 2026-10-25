import type { FSRS } from 'ts-fsrs'
import { checkExercise, chooseExercise, distinctMeaningCount, MIN_CHOICES, pickTestExercise, shuffle, type ReviewStyle } from '../core/exercises'
import type { ExerciseKind } from '../core/grading'
import { itemLevel } from '../core/library'
import { contextSentence } from '../core/vocab'
import { planLearn, planReview, planTest, type SessionPlan } from '../core/session'
import { dueQueue, learnCandidates, studiedItems, type Library } from '../db/library'
import type { ID, VocabItem } from '../db/types'

/** Dựng kế hoạch buổi học/ôn từ dữ liệu sổ tay (R4.1, R5.3, R5.5, R5.6). */

export function canMultipleChoice(lib: Library): boolean {
  return distinctMeaningCount(lib.items.filter((i) => !i.archived)) >= MIN_CHOICES
}

export function buildLearnPlan(lib: Library, opts: { deckIds?: ID[]; count: number; now: number }): SessionPlan | null {
  const ids = learnCandidates(lib, opts.deckIds)
    .slice(0, opts.count)
    .map((i) => i.id)
  if (ids.length === 0) return null
  return planLearn(ids, () => checkExercise(), opts.now)
}

export function buildReviewPlan(
  lib: Library,
  scheduler: FSRS,
  opts: { deckIds?: ID[]; limit: number; now: number; style: ReviewStyle; audioAvailable: boolean },
): SessionPlan | null {
  const cards = dueQueue(lib, scheduler, opts.now, opts.limit, opts.deckIds)
  if (cards.length === 0) return null
  const byId = new Map(cards.map((c) => [c.id, c]))
  const mcq = canMultipleChoice(lib)
  return planReview(
    cards.map((c) => c.id),
    (id) => {
      const c = byId.get(id)!
      const item = lib.itemById.get(id)
      return chooseExercise(itemLevel(c), c.reps, { audioOff: !opts.audioAvailable, canMultipleChoice: mcq, style: opts.style, hasContext: !!item && !!contextSentence(item) })
    },
    opts.now,
  )
}

/** Phạm vi bài kiểm tra: mọi từ đã học, từ hay quên, hoặc một bộ. */
export type TestScope = { kind: 'all' } | { kind: 'hard' } | { kind: 'deck'; deckId: ID }

/** Từ đã học thuộc phạm vi (từ hay quên: đã quên ít nhất một lần, quên nhiều xếp trước). */
export function testCandidates(lib: Library, scope: TestScope): VocabItem[] {
  const studied = studiedItems(lib)
  if (scope.kind === 'deck') return studied.filter((i) => lib.members.get(i.id)?.has(scope.deckId))
  if (scope.kind === 'hard') {
    const lapses = (i: VocabItem) => lib.cards.get(i.id)?.lapses ?? 0
    return studied.filter((i) => lapses(i) > 0).sort((a, b) => lapses(b) - lapses(a))
  }
  return studied
}

/** Bài kiểm tra tùy chọn (R6.6): chọn ngẫu nhiên `count` từ trong phạm vi, mỗi từ một dạng bài trong các dạng đã chọn. */
export function buildTestPlan(
  lib: Library,
  opts: { scope: TestScope; kinds: readonly ExerciseKind[]; count: number; timeLimitMs?: number; audioAvailable: boolean; now: number; rand?: () => number },
): SessionPlan | null {
  const rand = opts.rand ?? Math.random
  const pool = testCandidates(lib, opts.scope)
  // Từ hay quên: lấy những từ quên nhiều nhất rồi mới xáo; phạm vi khác: xáo cả phạm vi.
  const picked = shuffle(opts.scope.kind === 'hard' ? pool.slice(0, opts.count) : shuffle(pool, rand).slice(0, opts.count), rand)
  if (picked.length === 0) return null
  const mcq = canMultipleChoice(lib)
  return planTest(
    picked.map((i) => ({ id: i.id, exercise: pickTestExercise(opts.kinds, { hasContext: !!contextSentence(i), canMultipleChoice: mcq, audio: opts.audioAvailable }, rand) })),
    opts.now,
    opts.timeLimitMs,
  )
}

/** Buổi luyện lại riêng các từ hay sai (R5.5): không đổi lịch ôn. */
export function buildRetryPlan(lib: Library, itemIds: ID[], now: number): SessionPlan | null {
  const ids = itemIds.filter((id) => lib.itemById.has(id))
  if (ids.length === 0) return null
  const mcq = canMultipleChoice(lib)
  return planReview(ids, (id) => (itemLevel(lib.cards.get(id)) <= 1 && mcq ? 'mcq_meaning' : 'recall_typing'), now, 'retry')
}
