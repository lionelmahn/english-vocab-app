import { PROFILE_EXTRA_KEYS, profileDefaults, sanitizeProfile } from '../core/profile'
import { PROFILE_ID, type AudioAsset, type CardStateRow, type Deck, type DeckItem, type Example, type Profile, type ReviewLogRow, type SyncedTableName, type VocabItem } from '../db/types'

/** Đổi dòng trên thiết bị (camelCase, mili-giây) sang dòng trên máy chủ (snake_case, ISO) và ngược lại. */

const iso = (ms: number | null | undefined): string | null => (ms == null ? null : new Date(ms).toISOString())
const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v)
const INT_MAX = 2_147_483_647

export const REMOTE_TABLE: Record<SyncedTableName, string> = {
  profiles: 'profiles',
  vocabItems: 'vocab_items',
  decks: 'decks',
  deckItems: 'deck_items',
  cardStates: 'card_states',
  reviewLogs: 'review_logs',
  audioAssets: 'audio_assets',
}

/**
 * Thứ tự gửi và kéo: từ và bộ trước, liên kết sau (khóa ngoại).
 * Lượt trả lời đi trước lịch ôn, để máy chủ không bao giờ có lịch ôn mà thiếu lượt trả lời tạo ra nó.
 */
export const PUSH_ORDER = ['profiles', 'vocabItems', 'decks', 'deckItems', 'reviewLogs', 'cardStates', 'audioAssets'] as const

/**
 * Bảng cần chạy thêm SQL trên Supabase (âm thanh, 20261025000000_audio_storage.sql). Chưa chạy thì bảng này
 * tạm bỏ qua khi đồng bộ, các bảng khác vẫn đồng bộ bình thường.
 */
export const OPTIONAL_TABLES: ReadonlySet<PushTable> = new Set(['audioAssets'])
export type PushTable = (typeof PUSH_ORDER)[number]

/** Cột khóa trên máy chủ: hồ sơ có một dòng cho mỗi tài khoản, khóa là user_id. */
export function remoteIdColumn(table: PushTable): string {
  return table === 'profiles' ? 'user_id' : 'id'
}

/** Hồ sơ: các cài đặt không có cột riêng được gói vào ô `settings` (jsonb). */
export function profileToRemote(r: Profile, userId: string) {
  return {
    user_id: userId,
    display_name: r.displayName,
    avatar_url: orNull(r.avatarUrl),
    self_level: orNull(r.selfLevel),
    learning_purpose: orNull(r.learningPurpose),
    daily_new_words: r.dailyNewWords,
    daily_minutes: r.dailyMinutes,
    study_weekdays: r.studyWeekdays,
    time_zone: r.timeZone,
    preferred_accent: r.accent,
    settings: Object.fromEntries(PROFILE_EXTRA_KEYS.filter((k) => r[k] !== undefined).map((k) => [k, r[k]])),
    fsrs_params: r.fsrs ?? null,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

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

export function audioAssetToRemote(r: AudioAsset, userId: string) {
  return {
    id: r.id,
    owner_id: userId,
    term_key: r.key,
    part_of_speech: r.partOfSpeech,
    accent: r.accent,
    source: r.source,
    status: r.status,
    text: orNull(r.text),
    mime: orNull(r.mime),
    storage_path: orNull(r.storagePath),
    remote_url: orNull(r.remoteUrl),
    license: orNull(r.license),
    attribution: orNull(r.attribution),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: iso(r.deletedAt),
  }
}

/** `userId` cần cho hồ sơ và âm thanh (cột user_id / owner_id trên máy chủ). */
export function toRemote(table: PushTable, row: unknown, userId = ''): Record<string, unknown> {
  switch (table) {
    case 'profiles':
      return profileToRemote(row as Profile, userId)
    case 'audioAssets':
      return audioAssetToRemote(row as AudioAsset, userId)
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

// ---- Máy chủ → thiết bị ------------------------------------------------------------------

type RemoteRow = Record<string, unknown>

/** Mốc thời gian của máy chủ (ISO, có thể tới micro giây) sang mili-giây. */
export function toMs(s: string): number {
  return Date.parse(s.replace(/(\.\d{3})\d+/, '$1'))
}
const ms = (v: unknown): number => toMs(v as string)
const msOrNull = (v: unknown): number | null => (v == null ? null : toMs(v as string))
const text = (v: unknown): string | undefined => (v == null ? undefined : (v as string))

export function vocabItemFromRemote(r: RemoteRow): VocabItem {
  return {
    id: r.id as string,
    term: r.term as string,
    termKey: r.term_key as string,
    partOfSpeech: r.part_of_speech as VocabItem['partOfSpeech'],
    meaningVi: r.meaning_vi as string,
    meaningEn: text(r.meaning_en),
    ipaUk: text(r.ipa_uk),
    ipaUs: text(r.ipa_us),
    examples: ((r.examples as Example[] | null) ?? []).map((e) => ({ en: e.en, vi: text(e.vi) })),
    acceptedAnswers: (r.accepted_answers as string[] | null) ?? [],
    note: text(r.note),
    mnemonic: text(r.mnemonic),
    source: text(r.source),
    tags: (r.tags as string[] | null) ?? [],
    favorite: r.favorite as boolean,
    difficult: r.difficult as boolean,
    archived: r.archived as boolean,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deletedAt: msOrNull(r.deleted_at),
  }
}

export function deckFromRemote(r: RemoteRow): Deck {
  return {
    id: r.id as string,
    name: r.name as string,
    description: text(r.description),
    topic: text(r.topic),
    dailyGoal: r.daily_goal == null ? undefined : (r.daily_goal as number),
    active: r.active as boolean,
    archived: r.archived as boolean,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deletedAt: msOrNull(r.deleted_at),
  }
}

export function deckItemFromRemote(r: RemoteRow): DeckItem {
  return {
    id: r.id as string,
    deckId: r.deck_id as string,
    itemId: r.item_id as string,
    position: r.position as number,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deletedAt: msOrNull(r.deleted_at),
  }
}

export function cardStateFromRemote(r: RemoteRow): CardStateRow {
  return {
    id: r.id as string,
    itemId: r.id as string,
    due: ms(r.due),
    stability: r.stability as number,
    difficulty: r.difficulty as number,
    scheduledDays: r.scheduled_days as number,
    learningSteps: r.learning_steps as number,
    reps: r.reps as number,
    lapses: r.lapses as number,
    state: r.state as CardStateRow['state'],
    lastReview: msOrNull(r.last_review),
    suspended: r.suspended as boolean,
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deletedAt: msOrNull(r.deleted_at),
  }
}

export function reviewLogFromRemote(r: RemoteRow): ReviewLogRow {
  return {
    id: r.id as string,
    itemId: r.item_id as string,
    sessionId: r.session_id as string,
    reviewedAt: ms(r.reviewed_at),
    mode: r.mode as ReviewLogRow['mode'],
    exercise: r.exercise as ReviewLogRow['exercise'],
    grade: (r.grade ?? null) as ReviewLogRow['grade'],
    correct: (r.correct ?? null) as boolean | null,
    hintLevel: r.hint_level as number,
    responseMs: (r.response_ms ?? null) as number | null,
    affectsSchedule: r.affects_schedule as boolean,
    deviceId: r.device_id as string,
    createdAt: ms(r.created_at),
  }
}

export function profileFromRemote(r: RemoteRow): Profile {
  const extra = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>
  const data = sanitizeProfile(
    {
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      selfLevel: r.self_level,
      learningPurpose: r.learning_purpose,
      dailyNewWords: r.daily_new_words,
      dailyMinutes: r.daily_minutes,
      studyWeekdays: r.study_weekdays,
      timeZone: r.time_zone,
      accent: r.preferred_accent,
      fsrs: r.fsrs_params,
      ...Object.fromEntries(PROFILE_EXTRA_KEYS.map((k) => [k, extra[k]])),
    },
    profileDefaults(),
  )
  return { id: PROFILE_ID, ...data, createdAt: ms(r.created_at), updatedAt: ms(r.updated_at), deletedAt: msOrNull(r.deleted_at) }
}

export function audioAssetFromRemote(r: RemoteRow): AudioAsset {
  return {
    id: r.id as string,
    key: r.term_key as string,
    partOfSpeech: (r.part_of_speech as AudioAsset['partOfSpeech']) ?? 'other',
    accent: r.accent === 'uk' ? 'uk' : 'us',
    source: r.source as AudioAsset['source'],
    status: r.status === 'flagged' ? 'flagged' : 'active',
    text: text(r.text),
    mime: text(r.mime),
    storagePath: text(r.storage_path),
    remoteUrl: text(r.remote_url),
    license: text(r.license),
    attribution: text(r.attribution),
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
    deletedAt: msOrNull(r.deleted_at),
  }
}

export interface PushRows {
  profiles: Profile
  audioAssets: AudioAsset
  vocabItems: VocabItem
  decks: Deck
  deckItems: DeckItem
  cardStates: CardStateRow
  reviewLogs: ReviewLogRow
}

export function fromRemote<K extends PushTable>(table: K, row: RemoteRow): PushRows[K]
export function fromRemote(table: PushTable, row: RemoteRow): PushRows[PushTable] {
  switch (table) {
    case 'profiles':
      return profileFromRemote(row)
    case 'audioAssets':
      return audioAssetFromRemote(row)
    case 'vocabItems':
      return vocabItemFromRemote(row)
    case 'decks':
      return deckFromRemote(row)
    case 'deckItems':
      return deckItemFromRemote(row)
    case 'cardStates':
      return cardStateFromRemote(row)
    case 'reviewLogs':
      return reviewLogFromRemote(row)
  }
}
