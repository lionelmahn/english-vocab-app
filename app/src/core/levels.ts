import { State, type Card } from 'ts-fsrs'

/**
 * Năm cấp ghi nhớ (R5.9, R10.7, kế hoạch mục 2.3b).
 * Cấp chỉ dùng để trình bày tiến độ; suy ra từ độ bền trí nhớ (stability) của FSRS,
 * không gắn với khoảng ôn cố định.
 */

export type MemoryLevel = 0 | 1 | 2 | 3 | 4 | 5

/** Ngưỡng độ bền (ngày) để lên cấp 2, 3, 4, 5. */
export const LEVEL_THRESHOLDS_DAYS = [1, 7, 30, 90] as const

export const LEVEL_LABELS: Record<MemoryLevel, string> = {
  0: 'Chưa học',
  1: 'Mới làm quen',
  2: 'Đang nhớ',
  3: 'Nhớ khá',
  4: 'Nhớ tốt',
  5: 'Thuộc lâu',
}

export function memoryLevel(card: Pick<Card, 'state' | 'stability' | 'reps'>): MemoryLevel {
  if (card.state === State.New || card.reps === 0) return 0
  if (card.state === State.Learning || card.state === State.Relearning) return 1
  const [l2, l3, l4, l5] = LEVEL_THRESHOLDS_DAYS
  const s = card.stability
  if (s < l2) return 1
  if (s < l3) return 2
  if (s < l4) return 3
  if (s < l5) return 4
  return 5
}

/** Phân bố số từ theo cấp, dùng cho thống kê R10.7. */
export function levelDistribution(cards: Iterable<Pick<Card, 'state' | 'stability' | 'reps'>>): Record<MemoryLevel, number> {
  const out: Record<MemoryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const c of cards) out[memoryLevel(c)]++
  return out
}
