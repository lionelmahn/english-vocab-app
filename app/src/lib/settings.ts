import { useSyncExternalStore } from 'react'
import type { ReviewStyle } from '../core/exercises'

/**
 * Cài đặt giao diện và trải nghiệm học (R14.1 một phần, R14.2) của từng thiết bị.
 * Lưu trong localStorage; nếu trình duyệt chặn lưu trữ thì dùng giá trị mặc định.
 * Sẽ đồng bộ theo hồ sơ người học ở giai đoạn 2.
 */

export interface AppSettings {
  reduceMotion: boolean
  soundEffects: boolean
  /** Giọng đọc ưu tiên. */
  accent: 'us' | 'uk'
  /** Tự phát âm khi hiện từ. */
  autoPlay: boolean
  /** Mặt trước của thẻ tự đánh giá khi ôn: từ tiếng Anh hay nghĩa tiếng Việt (học từ mới luôn tiếng Anh trước). */
  flashcardFront: 'term' | 'meaning'
  /** Hiện bản dịch câu ví dụ mặc định (R7.7). */
  showTranslations: boolean
  /** Số từ mới mỗi buổi/ngày. */
  dailyNewWords: number
  /** Tối đa số từ mỗi buổi ôn (R5.6). */
  reviewLimit: number
  /** Ôn bằng bài luyện (tự chấm) hay thẻ tự đánh giá. */
  reviewStyle: ReviewStyle
  /** Ưu tiên bản ghi giọng người thật (Wiktionary) cho từ và cụm ngắn. */
  preferRecordings: boolean
  /** Giọng máy người học chọn (voiceURI); null = tự chọn giọng tốt nhất. */
  voiceUS: string | null
  voiceUK: string | null
  /** Tốc độ giọng máy (bản ghi giọng người thật giữ tốc độ gốc). */
  speechSpeed: SpeechSpeed
  /** Phát âm thanh "Giọng iPhone" đã tạo bằng Phím tắt (ưu tiên trên hết). */
  useVoiceClips: boolean
  /** Tên phím tắt tạo giọng iPhone. */
  shortcutName: string
}

export type SpeechSpeed = 'slower' | 'slow' | 'normal' | 'fast'
/** Hệ số tốc độ cho Web Speech API (1 = tốc độ mặc định của máy). */
export const SPEECH_RATE: Record<SpeechSpeed, number> = { slower: 0.75, slow: 0.85, normal: 0.95, fast: 1.05 }

const STORAGE_KEY = 'ui-settings'
export const DEFAULT_SETTINGS: AppSettings = {
  reduceMotion: false,
  soundEffects: true,
  accent: 'us',
  autoPlay: true,
  flashcardFront: 'term',
  showTranslations: false,
  dailyNewWords: 10,
  reviewLimit: 50,
  reviewStyle: 'exercises',
  preferRecordings: true,
  voiceUS: null,
  voiceUK: null,
  speechSpeed: 'normal',
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

export function getSettings(): AppSettings {
  return current
}

export function updateSettings(patch: Partial<AppSettings>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Không lưu được (chế độ riêng tư…): vẫn áp dụng cho phiên hiện tại.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, () => current)
}
