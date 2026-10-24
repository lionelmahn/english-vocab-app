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

/**
 * Từ chưa học theo thứ tự học (R4.1), xen kẽ đều: mỗi bộ trong phạm vi là một hàng (theo thứ tự trong bộ),
 * từ không thuộc bộ nào là một hàng nữa (thêm trước học trước). Lấy lần lượt từ đầu mỗi hàng, bộ tạo trước đứng trước;
 * từ nằm trong nhiều bộ chỉ lấy một lần. Nhờ vậy từ tự lưu không phải chờ học hết các bộ, bộ thêm sau không bị học dồn.
 */
export function learnCandidates(lib: Library, deckIds?: readonly ID[]): VocabItem[] {
  const scoped = !!deckIds && deckIds.length > 0
  const candidates = lib.items.filter((i) => !i.archived && !liveCard(lib.cards.get(i.id)) && inScope(lib, i.id, deckIds))
  const isCandidate = new Set(candidates.map((i) => i.id))
  const decks = lib.decks
    .filter((d) => (scoped ? deckIds.includes(d.id) : d.active && !d.archived))
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const byDeck = new Map<ID, DeckItem[]>(decks.map((d) => [d.id, []]))
  const inDeckQueue = new Set<ID>()
  for (const di of lib.deckItems) {
    const queue = byDeck.get(di.deckId)
    if (!queue || !isCandidate.has(di.itemId)) continue
    queue.push(di)
    inDeckQueue.add(di.itemId)
  }
  const created = (id: ID) => lib.itemById.get(id)?.createdAt ?? 0
  const queues: ID[][] = decks.map((d) =>
    byDeck
      .get(d.id)!
      .sort((a, b) => a.position - b.position || created(a.itemId) - created(b.itemId))
      .map((di) => di.itemId),
  )
  queues.push(
    candidates
      .filter((i) => !inDeckQueue.has(i.id))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((i) => i.id),
  )

  const out: VocabItem[] = []
  const taken = new Set<ID>()
  const next = queues.map(() => 0)
  for (let progressed = true; progressed; ) {
    progressed = false
    queues.forEach((queue, q) => {
      while (next[q] < queue.length && taken.has(queue[next[q]])) next[q]++
      if (next[q] >= queue.length) return
      const id = queue[next[q]++]
      taken.add(id)
      out.push(lib.itemById.get(id)!)
      progressed = true
    })
  }
  return out
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
