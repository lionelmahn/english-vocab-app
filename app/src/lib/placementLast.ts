import type { SelfLevel } from '../core/profile'

/** Kết quả lần kiểm tra trình độ gần nhất trên máy này (R1.8), hiện lại ở Cá nhân. Không lưu được thì bỏ qua. */
const KEY = 'placement-last'

export interface PlacementLast {
  estimate: number
  level: SelfLevel
  at: number
}

export function savePlacementLast(value: PlacementLast) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Chế độ riêng tư hoặc bị chặn: chỉ không hiện lại ở Cá nhân.
  }
}

export function readPlacementLast(): PlacementLast | null {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as PlacementLast) : null
    return v && typeof v.estimate === 'number' && typeof v.at === 'number' ? v : null
  } catch {
    return null
  }
}
