import { useSyncExternalStore } from 'react'
import { LEARNING_DEFAULTS, LEARNING_KEYS, type LearningSettings, type SpeechSpeed } from '../core/profile'

/**
 * Cài đặt giao diện và trải nghiệm học (R14.1 một phần, R14.2).
 * - Cài đặt học (giọng, số từ, cách ôn…) đi theo hồ sơ người học và đồng bộ giữa các thiết bị (services/profile).
 * - Giọng máy đã chọn, phím tắt, hiệu ứng và âm thanh hiệu ứng là của riêng từng thiết bị.
 * Một bản đầy đủ được giữ trong localStorage để app mở lên là có ngay; trình duyệt chặn lưu trữ thì dùng mặc định.
 */

export type { SpeechSpeed }

export type ThemeChoice = 'system' | 'light' | 'dark'
export type TextSize = 'small' | 'normal' | 'large' | 'larger'

/** Cỡ chữ gốc của trang: cỡ chữ, khoảng cách và nút đều tính theo rem nên phóng to đều nhau. */
export const TEXT_SCALE: Record<TextSize, string> = { small: '93.75%', normal: '100%', large: '112.5%', larger: '125%' }

export interface DeviceSettings {
  /** Giao diện sáng/tối: theo hệ điều hành hoặc chọn cố định (R14.1). */
  theme: ThemeChoice
  textSize: TextSize
  reduceMotion: boolean
  soundEffects: boolean
  /** Giọng máy người học chọn (voiceURI); null = tự chọn giọng tốt nhất. */
  voiceUS: string | null
  voiceUK: string | null
  /** Phát âm thanh "Giọng iPhone" đã tạo bằng Phím tắt (ưu tiên trên hết). */
  useVoiceClips: boolean
  /** Tên phím tắt tạo giọng iPhone. */
  shortcutName: string
}

export type AppSettings = LearningSettings & DeviceSettings

/** Hệ số tốc độ cho Web Speech API (1 = tốc độ mặc định của máy). */
export const SPEECH_RATE: Record<SpeechSpeed, number> = { slower: 0.75, slow: 0.85, normal: 0.95, fast: 1.05 }

const STORAGE_KEY = 'ui-settings'
export const DEFAULT_SETTINGS: AppSettings = {
  ...LEARNING_DEFAULTS,
  theme: 'system',
  textSize: 'normal',
  reduceMotion: false,
  soundEffects: true,
  voiceUS: null,
  voiceUK: null,
  useVoiceClips: true,
  shortcutName: 'VocabVoice',
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

let current = load()
const listeners = new Set<() => void>()

function commitLocal(next: AppSettings) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Không lưu được (chế độ riêng tư…): vẫn áp dụng cho phiên hiện tại.
  }
  listeners.forEach((notify) => notify())
}

function pickLearning(source: Partial<AppSettings>): Partial<LearningSettings> {
  return Object.fromEntries(LEARNING_KEYS.filter((k) => k in source).map((k) => [k, source[k]])) as Partial<LearningSettings>
}

/** Ghi phần cài đặt học vào hồ sơ; services/profile gắn vào lúc app khởi động. */
let learningWriter: ((patch: Partial<LearningSettings>) => void) | null = null
export function setLearningWriter(write: (patch: Partial<LearningSettings>) => void): void {
  learningWriter = write
}

export function getSettings(): AppSettings {
  return current
}

export function updateSettings(patch: Partial<AppSettings>): void {
  commitLocal({ ...current, ...patch })
  const learning = pickLearning(patch)
  if (Object.keys(learning).length > 0) learningWriter?.(learning)
}

/** Nhận cài đặt học từ hồ sơ (vừa sửa ở đây, hoặc vừa đồng bộ về từ thiết bị khác). */
export function applyLearningSettings(learning: LearningSettings): void {
  if (LEARNING_KEYS.every((k) => current[k] === learning[k])) return
  commitLocal({ ...current, ...pickLearning(learning) })
}

/** Cài đặt học đang dùng trên thiết bị này. */
export function currentLearningSettings(): LearningSettings {
  return { ...LEARNING_DEFAULTS, ...pickLearning(current) }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, () => current)
}

/** Giọng máy và phím tắt là của riêng từng thiết bị, không mang theo bản sao lưu. */
const DEVICE_ONLY: readonly string[] = ['voiceUS', 'voiceUK', 'useVoiceClips', 'shortcutName']

/** Cài đặt mang sang thiết bị khác được (ghi vào bản sao lưu). */
export function portableSettings(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(current).filter(([k]) => !DEVICE_ONLY.includes(k)))
}

/** Áp dụng cài đặt từ bản sao lưu, bỏ qua mục lạ hoặc sai kiểu. Trả về số mục đã áp dụng. */
export function applyPortableSettings(raw: Record<string, unknown>): number {
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>
  const patch = Object.fromEntries(
    Object.entries(raw).filter(([k, v]) => k in defaults && !DEVICE_ONLY.includes(k) && typeof v === typeof defaults[k]),
  ) as Partial<AppSettings>
  updateSettings(patch)
  return Object.keys(patch).length
}
