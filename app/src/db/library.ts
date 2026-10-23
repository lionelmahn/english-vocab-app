import type { FSRS } from 'ts-fsrs'
import { inStudyPlan, liveCard, membership } from '../core/library'
import { retrievability } from '../core/scheduler'
import { rowToCard } from './cards'
import type { VocabDatabase } from './db'
import type { CardStateRow, Deck, DeckItem, ID, VocabItem } from './types'

/** Ảnh chụp toàn bộ sổ tay để tính trên bộ nhớ (đủ nhanh với vài nghìn từ). */
export interface Library {
  items: VocabItem[]
  itemById: Map<ID, VocabItem>
  decks: Deck[]
  deckById: Map<ID, Deck>
  deckItems: DeckItem[]
  members: Map<ID, Set<ID>>
  cards: Map<ID, CardStateRow>
}

export async function loadLibrary(database: VocabDatabase): Promise<Library> {
  const [allItems, allDecks, allLinks, allCards] = await Promise.all([
    database.vocabItems.toArray(),
    database.decks.toArray(),
    database.deckItems.toArray(),
    database.cardStates.toArray(),
  ])
  const items = allItems.filter((i) => i.deletedAt === null)
  const decks = allDecks.filter((d) => d.deletedAt === null)
  const deckItems = allLinks.filter((d) => d.deletedAt === null)
  return {
    items,
    itemById: new Map(items.map((i) => [i.id, i])),
    decks,
    deckById: new Map(decks.map((d) => [d.id, d])),
    deckItems,
    members: membership(deckItems),
    cards: new Map(allCards.filter((c) => c.deletedAt === null).map((c) => [c.id, c])),
  }
}

function inScope(lib: Library, itemId: ID, deckIds?: readonly ID[]): boolean {
  if (deckIds && deckIds.length > 0) {
    const m = lib.members.get(itemId)
    return !!m && deckIds.some((d) => m.has(d))
  }
  return inStudyPlan(itemId, lib.members, lib.deckById)
}

/** Từ chưa học, theo thứ tự trong bộ rồi theo ngày thêm (R4.1). */
export function learnCandidates(lib: Library, deckIds?: readonly ID[]): VocabItem[] {
  const position = new Map<ID, number>()
  for (const di of lib.deckItems) {
    if (deckIds && deckIds.length > 0 && !deckIds.includes(di.deckId)) continue
    position.set(di.itemId, Math.min(position.get(di.itemId) ?? Infinity, di.position))
  }
  return lib.items
    .filter((i) => !i.archived && !liveCard(lib.cards.get(i.id)) && inScope(lib, i.id, deckIds))
    .sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.createdAt - b.createdAt)
}

function reviewable(lib: Library, card: CardStateRow, deckIds?: readonly ID[]): boolean {
  const item = lib.itemById.get(card.id)
  return !!item && !item.archived && !card.suspended && inScope(lib, card.id, deckIds)
}

/**
 * Từ đến hạn ôn (R5.2), ưu tiên từ dễ quên nhất (xác suất nhớ thấp), rồi từ hay quên.
 * Giới hạn số từ mỗi buổi để xử lý lượng ôn tồn đọng (R5.6).
 */
export function dueQueue(lib: Library, scheduler: FSRS, now: number, limit = Infinity, deckIds?: readonly ID[]): CardStateRow[] {
  const at = new Date(now)
  return [...lib.cards.values()]
    .filter((c) => c.due <= now && reviewable(lib, c, deckIds))
    .map((c) => ({ c, r: retrievability(scheduler, rowToCard(c), at) }))
    .sort((a, b) => a.r - b.r || b.c.lapses - a.c.lapses)
    .slice(0, limit)
    .map((x) => x.c)
}

export function dueCount(lib: Library, now: number): number {
  let n = 0
  for (const c of lib.cards.values()) if (c.due <= now && reviewable(lib, c)) n++
  return n
}

/** Thời điểm sớm nhất có từ đến hạn tiếp theo (R5.11). */
export function nextDueAt(lib: Library, now: number): number | null {
  let next: number | null = null
  for (const c of lib.cards.values()) {
    if (c.due > now && reviewable(lib, c) && (next === null || c.due < next)) next = c.due
  }
  return next
}

/** Từ đã học, dùng cho luyện tự do (R5.7 — giai đoạn 4) và phương án trắc nghiệm. */
export function studiedItems(lib: Library): VocabItem[] {
  return lib.items.filter((i) => !i.archived && liveCard(lib.cards.get(i.id)))
}
