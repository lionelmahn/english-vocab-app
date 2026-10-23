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
  /** Mặt trước của flashcard: từ tiếng Anh hay nghĩa tiếng Việt. */
  flashcardFront: 'term' | 'meaning'
  /** Hiện bản dịch câu ví dụ mặc định (R7.7). */
  showTranslations: boolean
  /** Số từ mới mỗi buổi/ngày. */
  dailyNewWords: number
  /** Tối đa số từ mỗi buổi ôn (R5.6). */
  reviewLimit: number
  /** Ôn bằng bài luyện (tự chấm) hay thẻ tự đánh giá. */
  reviewStyle: ReviewStyle
}

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
