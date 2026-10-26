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

/** Từ đã học, trừ từ đang tạm dừng ôn (R5.8). */
function activeStudied(lib: Library): VocabItem[] {
  return studiedItems(lib).filter((i) => !lib.cards.get(i.id)?.suspended)
}

/** Từ hay quên: đã quên ít nhất một lần, quên nhiều xếp trước. */
function hardFirst(lib: Library, items: VocabItem[]): VocabItem[] {
  const lapses = (i: VocabItem) => lib.cards.get(i.id)?.lapses ?? 0
  return items.filter((i) => lapses(i) > 0).sort((a, b) => lapses(b) - lapses(a))
}

/** Từ đã học thuộc phạm vi (từ hay quên: đã quên ít nhất một lần, quên nhiều xếp trước). */
export function testCandidates(lib: Library, scope: TestScope): VocabItem[] {
  const studied = activeStudied(lib)
  if (scope.kind === 'deck') return studied.filter((i) => lib.members.get(i.id)?.has(scope.deckId))
  if (scope.kind === 'hard') return hardFirst(lib, studied)
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

/**
 * Phạm vi ôn chủ động (R5.7): từ sắp đến hạn (chưa tới hạn, gần hạn nhất trước), từ hay quên, mọi từ đã học,
 * một bộ, hoặc các từ đã chọn sẵn (kể cả từ đang tạm dừng).
 */
export type PracticeScope = { kind: 'soon' } | { kind: 'hard' } | { kind: 'all' } | { kind: 'deck'; deckId: ID } | { kind: 'picked'; itemIds: ID[] }

export function practiceCandidates(lib: Library, scope: PracticeScope, now: number): VocabItem[] {
  if (scope.kind === 'picked') {
    const studied = new Set(studiedItems(lib).map((i) => i.id))
    return [...new Set(scope.itemIds)].filter((id) => studied.has(id)).map((id) => lib.itemById.get(id)!)
  }
  const pool = activeStudied(lib)
  if (scope.kind === 'deck') return pool.filter((i) => lib.members.get(i.id)?.has(scope.deckId))
  if (scope.kind === 'hard') return hardFirst(lib, pool)
  if (scope.kind === 'soon') {
    const due = (i: VocabItem) => lib.cards.get(i.id)!.due
    return pool.filter((i) => due(i) > now).sort((a, b) => due(a) - due(b))
  }
  return pool
}

/**
 * Buổi ôn chủ động (R5.7): luyện các từ đã học ngoài lịch, không đổi lịch ôn. Dạng bài theo cấp ghi nhớ như ôn tập,
 * nhưng đổi ngẫu nhiên giữa các lần luyện. Sắp đến hạn và hay quên lấy theo thứ tự ưu tiên; phạm vi khác lấy ngẫu nhiên.
 */
export function buildPracticePlan(
  lib: Library,
  opts: { scope: PracticeScope; count: number; now: number; style: ReviewStyle; audioAvailable: boolean; rand?: () => number },
): SessionPlan | null {
  const rand = opts.rand ?? Math.random
  const picked = pickPractice(lib, opts.scope, opts.count, opts.now, rand)
  if (picked.length === 0) return null
  const mcq = canMultipleChoice(lib)
  return planReview(
    picked.map((i) => i.id),
    (id) => {
      const card = lib.cards.get(id)
      const item = lib.itemById.get(id)
      const turn = (card?.reps ?? 0) + Math.floor(rand() * 6)
      return chooseExercise(itemLevel(card), turn, { audioOff: !opts.audioAvailable, canMultipleChoice: mcq, style: opts.style, hasContext: !!item && !!contextSentence(item) })
    },
    opts.now,
    'practice',
  )
}

/** Các từ cho một buổi ôn chủ động: sắp đến hạn và hay quên theo thứ tự ưu tiên, phạm vi khác lấy ngẫu nhiên. */
export function pickPractice(lib: Library, scope: PracticeScope, count: number, now: number, rand: () => number = Math.random): VocabItem[] {
  const pool = practiceCandidates(lib, scope, now)
  const ordered = scope.kind === 'soon' || scope.kind === 'hard' ? pool : shuffle(pool, rand)
  return shuffle(ordered.slice(0, count), rand)
}

/**
 * Bài luyện câu mới (R8.5): từ có câu do AI soạn thì làm bài điền từ trong câu đó, xen kẽ chọn từ và gõ từ; từ không có
 * câu thì dạng bài như ôn chủ động. Không đổi lịch ôn.
 */
export function buildFreshPracticePlan(
  lib: Library,
  itemIds: readonly ID[],
  contexts: Record<ID, { en: string; vi?: string }>,
  opts: { now: number; style: ReviewStyle; audioAvailable: boolean },
): SessionPlan | null {
  const ids = itemIds.filter((id) => lib.itemById.has(id))
  if (ids.length === 0) return null
  const mcq = canMultipleChoice(lib)
  let n = 0
  const plan = planReview(
    ids,
    (id) => {
      if (contexts[id]) return n++ % 2 === 0 && mcq ? 'cloze_choice' : 'cloze_typing'
      const item = lib.itemById.get(id)
      return chooseExercise(itemLevel(lib.cards.get(id)), lib.cards.get(id)?.reps ?? 0, { audioOff: !opts.audioAvailable, canMultipleChoice: mcq, style: opts.style, hasContext: !!item && !!contextSentence(item) })
    },
    opts.now,
    'practice',
  )
  return { ...plan, contexts: Object.fromEntries(ids.filter((id) => contexts[id]).map((id) => [id, contexts[id]])) }
}

/** Buổi luyện lại riêng các từ hay sai (R5.5): không đổi lịch ôn. */
export function buildRetryPlan(lib: Library, itemIds: ID[], now: number): SessionPlan | null {
  const ids = itemIds.filter((id) => lib.itemById.has(id))
  if (ids.length === 0) return null
  const mcq = canMultipleChoice(lib)
  return planReview(ids, (id) => (itemLevel(lib.cards.get(id)) <= 1 && mcq ? 'mcq_meaning' : 'recall_typing'), now, 'retry')
}
