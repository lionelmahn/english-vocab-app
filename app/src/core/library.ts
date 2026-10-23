import { State } from 'ts-fsrs'
import { memoryLevel, type MemoryLevel } from './levels'

/**
 * Tính trạng thái từ và phạm vi học từ dữ liệu sổ tay (R2.1, R3.1, R3.6, R5.2).
 * Hàm thuần, không đọc CSDL, để dễ test.
 */

export interface LibItem {
  id: string
  archived: boolean
  deletedAt: number | null
}
export interface LibDeck {
  id: string
  active: boolean
  archived: boolean
  deletedAt: number | null
}
export interface LibDeckItem {
  deckId: string
  itemId: string
  deletedAt: number | null
}
export interface LibCard {
  id: string
  due: number
  state: 0 | 1 | 2 | 3
  stability: number
  reps: number
  suspended: boolean
  deletedAt: number | null
}

export type ItemStatus = 'new' | 'learning' | 'review' | 'due' | 'suspended' | 'archived'

export const STATUS_LABEL: Record<ItemStatus, string> = {
  new: 'Chưa học',
  learning: 'Đang học',
  review: 'Đã học',
  due: 'Đến hạn ôn',
  suspended: 'Tạm dừng',
  archived: 'Đã lưu trữ',
}

/** Từ → các bộ đang chứa nó (bỏ qua liên kết đã xóa). */
export function membership(deckItems: readonly LibDeckItem[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const di of deckItems) {
    if (di.deletedAt !== null) continue
    let set = map.get(di.itemId)
    if (!set) map.set(di.itemId, (set = new Set()))
    set.add(di.deckId)
  }
  return map
}

/**
 * Từ có tham gia kế hoạch học không (R3.6):
 * - từ không thuộc bộ nào: có;
 * - từ thuộc ít nhất một bộ đang bật (chưa lưu trữ, chưa xóa): có;
 * - chỉ thuộc các bộ đã tắt: không.
 */
export function inStudyPlan(itemId: string, members: Map<string, Set<string>>, decks: Map<string, LibDeck>): boolean {
  const ids = members.get(itemId)
  if (!ids || ids.size === 0) return true
  let anyLiveDeck = false
  for (const id of ids) {
    const d = decks.get(id)
    if (!d || d.deletedAt !== null) continue
    anyLiveDeck = true
    if (d.active && !d.archived) return true
  }
  return !anyLiveDeck
}

export function liveCard<T extends LibCard>(card: T | undefined): T | undefined {
  return card && card.deletedAt === null ? card : undefined
}

export function itemStatus(item: LibItem, card: LibCard | undefined, now: number): ItemStatus {
  if (item.archived) return 'archived'
  const c = liveCard(card)
  if (!c) return 'new'
  if (c.suspended) return 'suspended'
  if (c.due <= now) return 'due'
  if (c.state === State.Learning || c.state === State.Relearning) return 'learning'
  return 'review'
}

export function itemLevel(card: LibCard | undefined): MemoryLevel {
  const c = liveCard(card)
  return c ? memoryLevel(c) : 0
}

export interface DeckStats {
  total: number
  learned: number
  due: number
  newCount: number
}

export function deckStats(
  deckId: string,
  items: Map<string, LibItem>,
  members: Map<string, Set<string>>,
  cards: Map<string, LibCard>,
  now: number,
): DeckStats {
  const stats: DeckStats = { total: 0, learned: 0, due: 0, newCount: 0 }
  for (const [itemId, decks] of members) {
    if (!decks.has(deckId)) continue
    const item = items.get(itemId)
    if (!item || item.deletedAt !== null || item.archived) continue
    stats.total++
    const status = itemStatus(item, cards.get(itemId), now)
    if (status === 'new') stats.newCount++
    else stats.learned++
    if (status === 'due') stats.due++
  }
  return stats
}
