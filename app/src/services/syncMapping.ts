import type { CardStateRow, Deck, DeckItem, ReviewLogRow, SyncedTableName, VocabItem } from '../db/types'

/** Đổi dòng trên thiết bị (camelCase, mili-giây) sang dòng trên máy chủ (snake_case, ISO). */

const iso = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(ms).toISOString())
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v)
const INT_MAX = 2_147_483_647

export const REMOTE_TABLE: Record<Exclude<SyncedTableName, 'profiles'>, string> = {
  vocabItems: 'vocab_items',
  decks: 'decks',
  deckItems: 'deck_items',
  cardStates: 'card_states',
  reviewLogs: 'review_logs',
}

/** Thứ tự gửi để không vi phạm khóa ngoại (từ và bộ trước, liên kết và lịch ôn sau). */
export const PUSH_ORDER = ['vocabItems', 'decks', 'deckItems', 'cardStates', 'reviewLogs'] as const
export type PushTable = (typeof PUSH_ORDER)[number]

export function vocabItemToRemote(r: VocabItem) {
  return {
    id: r.id,
    term: r.term.slice(0, 200),
    term_key: r.termKey,
    part_of_speech: r.partOfSpeech,
    meaning_vi: r.meaningVi,
    meaning_en: orNull(r.meaningEn),
    ipa_uk: orNull(r.ipaUk),
    ipa_us: orNull(r.ipaUs),
    examples: r.examples,
    accepted_answers: r.acceptedAnswers,
    note: orNull(r.note),
    mnemonic: orNull(r.mnemonic),
    source: orNull(r.source),
    tags: r.tags,
    favorite: r.favorite,
    difficult: r.difficult,
    archived: r.archived,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

export function deckToRemote(r: Deck) {
  return {
    id: r.id,
    name: r.name.slice(0, 120),
    description: orNull(r.description),
    topic: orNull(r.topic),
    daily_goal: orNull(r.dailyGoal),
    active: r.active,
    archived: r.archived,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

export function deckItemToRemote(r: DeckItem) {
  return {
    id: r.id,
    deck_id: r.deckId,
    item_id: r.itemId,
    position: r.position,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

export function cardStateToRemote(r: CardStateRow) {
  return {
    id: r.id,
    due: iso(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    scheduled_days: Math.round(r.scheduledDays),
    learning_steps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: iso(r.lastReview),
    suspended: r.suspended,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

export function reviewLogToRemote(r: ReviewLogRow) {
  return {
    id: r.id,
    item_id: r.itemId,
    session_id: r.sessionId,
    reviewed_at: iso(r.reviewedAt),
    mode: r.mode,
    exercise: r.exercise,
    grade: r.grade,
    correct: r.correct,
    hint_level: r.hintLevel,
    response_ms: r.responseMs == null ? null : Math.min(INT_MAX, Math.max(0, Math.round(r.responseMs))),
    affects_schedule: r.affectsSchedule,
    device_id: r.deviceId,
    created_at: iso(r.createdAt),
  }
}

export function toRemote(table: PushTable, row: unknown): Record<string, unknown> {
  switch (table) {
    case 'vocabItems':
      return vocabItemToRemote(row as VocabItem)
    case 'decks':
      return deckToRemote(row as Deck)
    case 'deckItems':
      return deckItemToRemote(row as DeckItem)
    case 'cardStates':
      return cardStateToRemote(row as CardStateRow)
    case 'reviewLogs':
      return reviewLogToRemote(row as ReviewLogRow)
  }
}
