import type { FSRS } from 'ts-fsrs'
import { checkExercise, chooseExercise, distinctMeaningCount, MIN_CHOICES, type ReviewStyle } from '../core/exercises'
import { itemLevel } from '../core/library'
import { contextSentence } from '../core/vocab'
import { planLearn, planReview, type SessionPlan } from '../core/session'
import { dueQueue, learnCandidates, type Library } from '../db/library'
import type { ID } from '../db/types'

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

/** Buổi luyện lại riêng các từ hay sai (R5.5): không đổi lịch ôn. */
export function buildRetryPlan(lib: Library, itemIds: ID[], now: number): SessionPlan | null {
  const ids = itemIds.filter((id) => lib.itemById.has(id))
  if (ids.length === 0) return null
  const mcq = canMultipleChoice(lib)
  return planReview(ids, (id) => (itemLevel(lib.cards.get(id)) <= 1 && mcq ? 'mcq_meaning' : 'recall_typing'), now, 'retry')
}
