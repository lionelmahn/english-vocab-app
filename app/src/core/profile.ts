import { studyDay } from './day'
import type { ReviewStyle } from './exercises'
import { REMINDER_DEFAULTS, sanitizeReminders, type ReminderPrefs } from './reminders'

/**
 * Hồ sơ người học (R1.4), mục tiêu (R1.5), lịch học (R9.2) và cài đặt học dùng chung (R14.2).
 * Một bản cho mỗi tài khoản, đồng bộ giữa các thiết bị. Giọng máy, phím tắt và hiệu ứng là của riêng từng máy.
 */

export type SelfLevel = 'beginner' | 'elementary' | 'intermediate' | 'upper_intermediate' | 'advanced'

export const SELF_LEVELS: readonly { value: SelfLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Mới bắt đầu', hint: 'A1 · biết vài trăm từ thông dụng' },
  { value: 'elementary', label: 'Sơ cấp', hint: 'A2 · đọc hiểu câu ngắn, giao tiếp đơn giản' },
  { value: 'intermediate', label: 'Trung cấp', hint: 'B1 · hiểu ý chính bài đọc, hội thoại quen thuộc' },
  { value: 'upper_intermediate', label: 'Trung cao cấp', hint: 'B2 · đọc báo, xem phim có phụ đề tiếng Anh' },
  { value: 'advanced', label: 'Nâng cao', hint: 'C1–C2 · dùng tiếng Anh thoải mái trong công việc' },
]

/** Mục đích học gợi ý (người học chọn nhiều, hoặc tự ghi). */
export const PURPOSES: readonly string[] = ['Giao tiếp hằng ngày', 'Công việc', 'Thi IELTS/TOEIC', 'Du học', 'Đọc tài liệu chuyên ngành', 'Du lịch']

export type SpeechSpeed = 'slower' | 'slow' | 'normal' | 'fast'

/** Cài đặt học dùng chung mọi thiết bị. */
export interface LearningSettings {
  /** Giọng đọc ưu tiên. */
  accent: 'us' | 'uk'
  /** Số từ mới mỗi ngày (mục tiêu R1.5, cũng là số từ mặc định mỗi buổi học). */
  dailyNewWords: number
  /** Tối đa số từ mỗi buổi ôn (R5.6). */
  reviewLimit: number
  /** Ôn bằng bài luyện (tự chấm) hay thẻ tự đánh giá. */
  reviewStyle: ReviewStyle
  /** Mặt trước của thẻ tự đánh giá khi ôn (học từ mới luôn tiếng Anh trước). */
  flashcardFront: 'term' | 'meaning'
  /** Hiện bản dịch câu ví dụ mặc định (R7.7). */
  showTranslations: boolean
  /** Tự phát âm khi hiện từ. */
  autoPlay: boolean
  /** Ưu tiên bản ghi giọng người thật (Wiktionary) cho từ và cụm ngắn. */
  preferRecordings: boolean
  /** Tốc độ giọng máy. */
  speechSpeed: SpeechSpeed
}

export const LEARNING_DEFAULTS: LearningSettings = {
  accent: 'us',
  dailyNewWords: 10,
  reviewLimit: 50,
  reviewStyle: 'exercises',
  flashcardFront: 'term',
  showTranslations: false,
  autoPlay: true,
  preferRecordings: true,
  speechSpeed: 'normal',
}

export const LEARNING_KEYS = Object.keys(LEARNING_DEFAULTS) as (keyof LearningSettings)[]

export interface ProfileFields {
  displayName: string
  /** Ảnh đại diện đã thu nhỏ (data URL JPEG), lưu thẳng trong hồ sơ. */
  avatarUrl?: string
  selfLevel?: SelfLevel
  /** Mục đích học, các mục cách nhau bởi dấu phẩy. */
  learningPurpose?: string
  /** Mục tiêu số phút học mỗi ngày (R1.5). */
  dailyMinutes: number
  /** Ngày học trong tuần: 0 = Chủ nhật … 6 = Thứ bảy (R9.2). */
  studyWeekdays: number[]
  /** Giờ học hằng ngày "HH:MM", dùng để nhắc ôn (R9.3). */
  studyTime?: string
  /** Múi giờ tính ngày học, chuỗi ngày và giờ nhắc. */
  timeZone: string
  /** Nhắc học, nhắc ôn và giờ yên lặng (R9.3, R9.4, R9.6). */
  reminders: ReminderPrefs
}

export type ProfileData = ProfileFields & LearningSettings

/** Mục chỉ có trên máy chủ ở ô `settings` (không có cột riêng). */
export const PROFILE_EXTRA_KEYS = ['reviewLimit', 'reviewStyle', 'flashcardFront', 'showTranslations', 'autoPlay', 'preferRecordings', 'speechSpeed', 'studyTime', 'reminders'] as const

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
  } catch {
    return 'Asia/Ho_Chi_Minh'
  }
}

export function profileDefaults(timeZone = deviceTimeZone()): ProfileData {
  return { displayName: '', dailyMinutes: 15, studyWeekdays: [...ALL_WEEKDAYS], timeZone, reminders: { ...REMINDER_DEFAULTS }, ...LEARNING_DEFAULTS }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

/**
 * Làm sạch hồ sơ đầy đủ (từ máy chủ, file sao lưu hoặc sau khi áp thay đổi), khớp ràng buộc của bảng `profiles`:
 * từ mới 0–200, phút 0–600, ngày học 0–6 không trùng, giờ dạng HH:MM, múi giờ hợp lệ.
 * Mục tùy chọn (ảnh, trình độ, mục đích, giờ học) thiếu hoặc sai thì để trống; mục bắt buộc thì lấy từ `base`.
 */
export function sanitizeProfile(raw: Partial<Record<keyof ProfileData, unknown>>, base: ProfileData = profileDefaults()): ProfileData {
  const days = Array.isArray(raw.studyWeekdays) ? raw.studyWeekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : base.studyWeekdays
  const time = typeof raw.studyTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.studyTime) ? raw.studyTime : undefined
  const tz = typeof raw.timeZone === 'string' && isValidTimeZone(raw.timeZone) ? raw.timeZone : base.timeZone
  const avatar = typeof raw.avatarUrl === 'string' && /^(data:image\/|https:\/\/)/.test(raw.avatarUrl) ? raw.avatarUrl : undefined
  return {
    displayName: typeof raw.displayName === 'string' ? raw.displayName.trim().slice(0, 50) : base.displayName,
    avatarUrl: avatar,
    selfLevel: SELF_LEVELS.some((l) => l.value === raw.selfLevel) ? (raw.selfLevel as SelfLevel) : undefined,
    learningPurpose: text(raw.learningPurpose, 200),
    dailyMinutes: clampInt(raw.dailyMinutes, 0, 600, base.dailyMinutes),
    studyWeekdays: [...new Set(days)].sort((a, b) => a - b),
    studyTime: time,
    timeZone: tz,
    reminders: sanitizeReminders(raw.reminders, base.reminders),
    accent: oneOf(raw.accent, ['us', 'uk'], base.accent),
    dailyNewWords: clampInt(raw.dailyNewWords, 0, 200, base.dailyNewWords),
    reviewLimit: clampInt(raw.reviewLimit, 1, 1000, base.reviewLimit),
    reviewStyle: oneOf(raw.reviewStyle, ['exercises', 'flashcard'], base.reviewStyle),
    flashcardFront: oneOf(raw.flashcardFront, ['term', 'meaning'], base.flashcardFront),
    showTranslations: bool(raw.showTranslations, base.showTranslations),
    autoPlay: bool(raw.autoPlay, base.autoPlay),
    preferRecordings: bool(raw.preferRecordings, base.preferRecordings),
    speechSpeed: oneOf(raw.speechSpeed, ['slower', 'slow', 'normal', 'fast'], base.speechSpeed),
  }
}

// ---- Hiển thị lịch học --------------------------------------------------------------------------

/** Thứ tự hiển thị kiểu Việt Nam: Thứ 2 → Chủ nhật. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** "Hằng ngày", "T2–T6", "T2, T4, T6", "Chưa chọn ngày". Dãy liên tiếp (theo thứ tự T2 → CN) được gộp. */
export function weekdaysLabel(days: readonly number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Hằng ngày'
  if (set.size === 0) return 'Chưa chọn ngày'
  const ordered = WEEK_ORDER.filter((d) => set.has(d))
  const runs: number[][] = []
  for (const d of ordered) {
    const last = runs[runs.length - 1]
    if (last && WEEK_ORDER.indexOf(d) === WEEK_ORDER.indexOf(last[last.length - 1]) + 1) last.push(d)
    else runs.push([d])
  }
  return runs.map((r) => (r.length >= 3 ? `${WEEKDAY_SHORT[r[0]]}–${WEEKDAY_SHORT[r[r.length - 1]]}` : r.map((d) => WEEKDAY_SHORT[d]).join(', '))).join(', ')
}

/** Ngày học (theo lịch R9.2) chứa thời điểm `at`; ngày học bắt đầu lúc 4:00 sáng như chuỗi ngày. */
export function isStudyDay(days: readonly number[], at: Date, timeZone: string): boolean {
  const [y, m, d] = studyDay(at, timeZone).split('-').map(Number)
  return days.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}

/** Hai tên của cùng một múi giờ ("Asia/Saigon" và "Asia/Ho_Chi_Minh") được coi là một. */
export function sameTimeZone(a: string, b: string): boolean {
  if (a === b) return true
  try {
    const canon = (tz: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone
    return canon(a) === canon(b)
  } catch {
    return false
  }
}

/** "GMT+7" cho một múi giờ (để người học nhận ra). */
export function timeZoneOffset(timeZone: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')
    return part?.value ?? ''
  } catch {
    return ''
  }
}
