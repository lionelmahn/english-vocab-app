import type { Card } from 'ts-fsrs'
import type { CardStateRow, ID } from './types'

/** Chuyển giữa dòng lưu trên thiết bị và đối tượng thẻ của ts-fsrs. */

export function rowToCard(row: CardStateRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    // Trường cũ của ts-fsrs, thư viện tự tính lại từ last_review.
    elapsed_days: 0,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.lastReview === null ? undefined : new Date(row.lastReview),
  }
}

export function cardToRow(
  itemId: ID,
  card: Card,
  now: number,
  previous?: Pick<CardStateRow, 'createdAt' | 'suspended'>,
): CardStateRow {
  return {
    id: itemId,
    itemId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardStateRow['state'],
    lastReview: card.last_review ? card.last_review.getTime() : null,
    suspended: previous?.suspended ?? false,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
  }
}
