import { useSyncExternalStore } from 'react'

/**
 * Cài đặt giao diện riêng của từng thiết bị (giảm hiệu ứng, âm thanh hiệu ứng).
 * Lưu trong localStorage; nếu trình duyệt chặn lưu trữ thì dùng giá trị mặc định.
 */

export interface UiSettings {
  reduceMotion: boolean
  soundEffects: boolean
}

const STORAGE_KEY = 'ui-settings'
const DEFAULTS: UiSettings = { reduceMotion: false, soundEffects: true }

function load(): UiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UiSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function updateSettings(patch: Partial<UiSettings>): void {
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

export function useSettings(): UiSettings {
  return useSyncExternalStore(subscribe, () => current)
}
