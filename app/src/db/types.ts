import type { ExerciseKind, SessionMode } from '../core/grading'
import type { PartOfSpeech } from '../core/pos'
import type { SessionPlan } from '../core/session'

export type { PartOfSpeech }

/**
 * Kiểu dữ liệu lưu trên thiết bị (kế hoạch mục 3.4).
 * Mốc thời gian lưu dạng số mili-giây để so sánh khi đồng bộ (mục 3.5).
 */

export type ID = string

/** Bản ghi đồng bộ được: mã tạo trên thiết bị, sửa mới nhất thắng, xóa mềm. */
export interface Synced {
  id: ID
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export type Accent = 'uk' | 'us'

export interface Example {
  en: string
  vi?: string
}

export interface Profile extends Synced {
  displayName: string
  avatarUrl?: string
  selfLevel?: 'beginner' | 'elementary' | 'intermediate' | 'upper_intermediate' | 'advanced'
  learningPurpose?: string
  dailyNewWords: number
  dailyMinutes: number
  /** 0 = Chủ nhật … 6 = Thứ bảy */
  studyWeekdays: number[]
  timeZone: string
  preferredAccent: Accent
}

/** Mục học: một từ/cụm từ với một nghĩa xác định (quy tắc "đơn vị ghi nhớ"). */
export interface VocabItem extends Synced {
  term: string
  /** Từ đã chuẩn hóa, dùng để tìm kiếm và phát hiện trùng (R2.5). */
  termKey: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
  meaningEn?: string
  ipaUk?: string
  ipaUs?: string
  examples: Example[]
  /** Đáp án được chấp nhận thêm, ví dụ biến thể Anh–Anh/Anh–Mỹ (R6.7, R6.13). */
  acceptedAnswers: string[]
  note?: string
  mnemonic?: string
  source?: string
  tags: string[]
  favorite: boolean
  difficult: boolean
  archived: boolean
}

export interface Deck extends Synced {
  name: string
  description?: string
  topic?: string
  dailyGoal?: number
  /** Bộ đang tham gia kế hoạch học (R3.6). */
  active: boolean
  archived: boolean
}

export interface DeckItem extends Synced {
  deckId: ID
  itemId: ID
  position: number
}

/** Trạng thái FSRS — một dòng cho mỗi mục học, dùng chung khi từ nằm trong nhiều bộ. `id` = `itemId`. */
export interface CardStateRow extends Synced {
  itemId: ID
  due: number
  stability: number
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  /** 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: 0 | 1 | 2 | 3
  lastReview: number | null
  /** Tạm dừng ôn mục này (R5.8). */
  suspended: boolean
}

/** Lượt trả lời — chỉ thêm, không sửa. */
export interface ReviewLogRow {
  id: ID
  itemId: ID
  sessionId: ID
  reviewedAt: number
  mode: SessionMode
  exercise: ExerciseKind
  /** 1 Again, 2 Hard, 3 Good, 4 Easy; null khi không chấm. */
  grade: 1 | 2 | 3 | 4 | null
  correct: boolean | null
  hintLevel: number
  responseMs: number | null
  /** Có tính vào lịch ôn không (chỉ lần trả lời đầu tiên trong buổi học/ôn). */
  affectsSchedule: boolean
  deviceId: string
  createdAt: number
}

/** Buổi học/ôn — lưu trên thiết bị để tiếp tục khi bị gián đoạn (R4.6). */
export interface StudySessionRow {
  id: ID
  mode: SessionMode
  startedAt: number
  endedAt: number | null
  status: 'active' | 'completed' | 'abandoned'
  plan: SessionPlan
  updatedAt: number
}

export type SyncedTableName = 'profiles' | 'vocabItems' | 'decks' | 'deckItems' | 'cardStates' | 'reviewLogs'

/** Hàng đợi thay đổi chờ gửi lên máy chủ. */
export interface OutboxEntry {
  seq?: number
  table: SyncedTableName
  rowId: ID
  at: number
}

export interface MetaEntry {
  key: string
  value: unknown
}

/** Bản ghi phát âm giọng người thật tìm được cho một từ (đường dẫn phát được trên trình duyệt). */
export interface WordAudio {
  us?: string
  uk?: string
  other?: string
}

export interface AudioCacheEntry {
  /** Từ đã chuẩn hóa. */
  key: string
  /** null: đã tìm nhưng không có bản ghi. */
  audio: WordAudio | null
  fetchedAt: number
}

/** Âm thanh "Giọng iPhone" do app Phím tắt tạo (chỉ lưu trên máy này, không đồng bộ). */
export interface VoiceClip {
  /** Văn bản đã chuẩn hóa (clipKey). */
  key: string
  text: string
  data: ArrayBuffer
  mime: string
  createdAt: number
}
