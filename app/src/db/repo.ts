import type { FSRS, Grade } from 'ts-fsrs'
import type { ExerciseKind } from '../core/grading'
import { applyReview, createScheduler, newCard } from '../core/scheduler'
import type { AnswerEffect, SessionPlan, Step } from '../core/session'
import { findDuplicates, termKey, type DuplicateCandidate, type DuplicateMatch } from '../core/vocab'
import { getDeviceId } from '../lib/device'
import { cardToRow, rowToCard } from './cards'
import { commit, db, notifyChange, type Change, type VocabDatabase } from './db'
import type { CardStateRow, Deck, DeckItem, Example, ID, PartOfSpeech, ReviewLogRow, StudySessionRow, VocabItem } from './types'

/** Nội dung người dùng nhập cho một mục học (R2.2, R2.3). */
export interface ItemInput {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
  meaningEn?: string
  ipaUk?: string
  ipaUs?: string
  examples: Example[]
  acceptedAnswers: string[]
  note?: string
  mnemonic?: string
  source?: string
  tags: string[]
  favorite: boolean
  difficult: boolean
}

export interface DeckInput {
  name: string
  description?: string
  topic?: string
  dailyGoal?: number
}

function clean(s: string | undefined): string | undefined {
  const t = s?.trim()
  return t ? t : undefined
}

function normalizeInput(input: ItemInput): ItemInput {
  return {
    ...input,
    term: input.term.trim().replace(/\s+/g, ' '),
    meaningVi: input.meaningVi.trim(),
    meaningEn: clean(input.meaningEn),
    ipaUk: clean(input.ipaUk),
    ipaUs: clean(input.ipaUs),
    note: clean(input.note),
    mnemonic: clean(input.mnemonic),
    source: clean(input.source),
    examples: input.examples.map((e) => ({ en: e.en.trim(), vi: clean(e.vi) })).filter((e) => e.en),
    acceptedAnswers: input.acceptedAnswers.map((a) => a.trim()).filter(Boolean),
  }
}

export function createRepo(database: VocabDatabase, scheduler: FSRS = createScheduler()) {
  async function save(changes: Change[], now = Date.now()) {
    await commit(database, changes, now)
    notifyChange()
  }

  async function liveDeckItemsOf(itemId: ID): Promise<DeckItem[]> {
    return (await database.deckItems.where('itemId').equals(itemId).toArray()).filter((d) => d.deletedAt === null)
  }

  const repo = {
    // ---- Mục học -------------------------------------------------------------------------

    async duplicatesOf(candidate: DuplicateCandidate, excludeId?: ID): Promise<DuplicateMatch<VocabItem>[]> {
      const same = await database.vocabItems.where('termKey').equals(termKey(candidate.term)).toArray()
      return findDuplicates(candidate, same, excludeId)
    },

    async createItem(input: ItemInput, deckIds: ID[] = [], now = Date.now()): Promise<ID> {
      const v = normalizeInput(input)
      const id = crypto.randomUUID()
      const item: VocabItem = { ...v, id, termKey: termKey(v.term), archived: false, createdAt: now, updatedAt: now, deletedAt: null }
      const links = await repo.membershipRows(deckIds, [id], now)
      await save([{ table: 'vocabItems', rows: [item] }, { table: 'deckItems', rows: links }], now)
      return id
    },

    /** Sửa mục học; `resetProgress` = học lại từ đầu (R2.3). */
    async updateItem(id: ID, input: ItemInput, opts: { resetProgress?: boolean; deckIds?: ID[] } = {}, now = Date.now()): Promise<void> {
      const current = await database.vocabItems.get(id)
      if (!current) return
      const v = normalizeInput(input)
      const changes: Change[] = [{ table: 'vocabItems', rows: [{ ...current, ...v, termKey: termKey(v.term), updatedAt: now }] }]
      if (opts.resetProgress) {
        const card = await database.cardStates.get(id)
        if (card && card.deletedAt === null) changes.push({ table: 'cardStates', rows: [{ ...card, deletedAt: now, updatedAt: now }] })
      }
      if (opts.deckIds) {
        const existing = await liveDeckItemsOf(id)
        const want = new Set(opts.deckIds)
        const have = new Set(existing.map((d) => d.deckId))
        const removed = existing.filter((d) => !want.has(d.deckId)).map((d) => ({ ...d, deletedAt: now, updatedAt: now }))
        const added = await repo.membershipRows(
          opts.deckIds.filter((d) => !have.has(d)),
          [id],
          now,
        )
        changes.push({ table: 'deckItems', rows: [...removed, ...added] })
      }
      await save(changes, now)
    },

    async setItemFlags(id: ID, patch: Partial<Pick<VocabItem, 'favorite' | 'difficult' | 'archived' | 'tags'>>, now = Date.now()) {
      const current = await database.vocabItems.get(id)
      if (!current) return
      await save([{ table: 'vocabItems', rows: [{ ...current, ...patch, updatedAt: now }] }], now)
    },

    /** Xóa (mềm) mục học cùng liên kết bộ từ và lịch ôn. Lịch sử trả lời được giữ (R2.4). */
    async deleteItems(ids: ID[], now = Date.now()) {
      const items = (await database.vocabItems.bulkGet(ids)).filter((x): x is VocabItem => !!x && x.deletedAt === null)
      const links = (await database.deckItems.where('itemId').anyOf(ids).toArray()).filter((d) => d.deletedAt === null)
      const cards = (await database.cardStates.bulkGet(ids)).filter((x): x is CardStateRow => !!x && x.deletedAt === null)
      const gone = <T extends { deletedAt: number | null; updatedAt: number }>(r: T) => ({ ...r, deletedAt: now, updatedAt: now })
      await save(
        [
          { table: 'vocabItems', rows: items.map(gone) },
          { table: 'deckItems', rows: links.map(gone) },
          { table: 'cardStates', rows: cards.map(gone) },
        ],
        now,
      )
    },

    async resetProgress(id: ID, now = Date.now()) {
      const card = await database.cardStates.get(id)
      if (!card || card.deletedAt !== null) return
      await save([{ table: 'cardStates', rows: [{ ...card, deletedAt: now, updatedAt: now }] }], now)
    },

    async setSuspended(id: ID, suspended: boolean, now = Date.now()) {
      const card = await database.cardStates.get(id)
      if (!card || card.deletedAt !== null) return
      await save([{ table: 'cardStates', rows: [{ ...card, suspended, updatedAt: now }] }], now)
    },

    /**
     * Nhập hàng loạt (R11.2) trong một giao dịch: tạo từ, tạo bộ theo tên nếu cần, gắn từ vào bộ.
     * `deckName` của từng dòng được so khớp không phân biệt hoa thường với bộ có sẵn.
     */
    async importItems(
      entries: { input: ItemInput; deckName?: string }[],
      target: { kind: 'perRow' } | { kind: 'deck'; deckId: ID } | { kind: 'newDeck'; name: string } | { kind: 'none' },
      now = Date.now(),
    ): Promise<{ items: number; decks: number }> {
      const existingDecks = (await database.decks.toArray()).filter((d) => d.deletedAt === null)
      const byName = new Map(existingDecks.map((d) => [d.name.trim().toLowerCase(), d.id]))
      const newDecks: Deck[] = []
      const deckFor = (name: string): ID => {
        const key = name.trim().toLowerCase()
        const found = byName.get(key)
        if (found) return found
        const id = crypto.randomUUID()
        newDecks.push({ id, name: name.trim().slice(0, 120), active: true, archived: false, createdAt: now, updatedAt: now, deletedAt: null })
        byName.set(key, id)
        return id
      }
      const fixedDeck = target.kind === 'deck' ? target.deckId : target.kind === 'newDeck' ? deckFor(target.name) : null

      const items: VocabItem[] = []
      const pairs: [ID, ID][] = []
      entries.forEach((e, i) => {
        const v = normalizeInput(e.input)
        const id = crypto.randomUUID()
        // createdAt tăng dần để giữ đúng thứ tự trong file khi học.
        items.push({ ...v, id, termKey: termKey(v.term), archived: false, createdAt: now + i, updatedAt: now, deletedAt: null })
        const deckId = fixedDeck ?? (target.kind === 'perRow' && e.deckName ? deckFor(e.deckName) : null)
        if (deckId) pairs.push([deckId, id])
      })

      const links: DeckItem[] = []
      const nextPos = new Map<ID, number>()
      for (const [deckId, itemId] of pairs) {
        if (!nextPos.has(deckId)) {
          const existing = await database.deckItems.where('deckId').equals(deckId).toArray()
          nextPos.set(deckId, existing.reduce((m, d) => Math.max(m, d.position), -1) + 1)
        }
        const position = nextPos.get(deckId)!
        nextPos.set(deckId, position + 1)
        links.push({ id: crypto.randomUUID(), deckId, itemId, position, createdAt: now, updatedAt: now, deletedAt: null })
      }

      await save(
        [
          { table: 'decks', rows: newDecks },
          { table: 'vocabItems', rows: items },
          { table: 'deckItems', rows: links },
        ],
        now,
      )
      return { items: items.length, decks: newDecks.length }
    },

    // ---- Bộ từ ---------------------------------------------------------------------------

    async createDeck(input: DeckInput, now = Date.now()): Promise<ID> {
      const id = crypto.randomUUID()
      const deck: Deck = {
        id,
        name: input.name.trim(),
        description: clean(input.description),
        topic: clean(input.topic),
        dailyGoal: input.dailyGoal,
        active: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      await save([{ table: 'decks', rows: [deck] }], now)
      return id
    },

    async updateDeck(id: ID, patch: Partial<DeckInput & Pick<Deck, 'active' | 'archived'>>, now = Date.now()) {
      const current = await database.decks.get(id)
      if (!current) return
      const next: Deck = {
        ...current,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() : current.name,
        description: patch.description !== undefined ? clean(patch.description) : current.description,
        topic: patch.topic !== undefined ? clean(patch.topic) : current.topic,
        updatedAt: now,
      }
      await save([{ table: 'decks', rows: [next] }], now)
    },

    /** Xóa bộ từ: các từ bên trong vẫn còn trong sổ tay (R3.3). */
    async deleteDeck(id: ID, now = Date.now()) {
      const deck = await database.decks.get(id)
      if (!deck) return
      const links = (await database.deckItems.where('deckId').equals(id).toArray()).filter((d) => d.deletedAt === null)
      await save(
        [
          { table: 'decks', rows: [{ ...deck, deletedAt: now, updatedAt: now }] },
          { table: 'deckItems', rows: links.map((d) => ({ ...d, deletedAt: now, updatedAt: now })) },
        ],
        now,
      )
    },

    /** Dòng liên kết mới cho các cặp (bộ, từ) chưa có (R3.4). Không tự ghi. */
    async membershipRows(deckIds: ID[], itemIds: ID[], now: number): Promise<DeckItem[]> {
      const rows: DeckItem[] = []
      for (const deckId of deckIds) {
        const existing = await database.deckItems.where('deckId').equals(deckId).toArray()
        const live = new Set(existing.filter((d) => d.deletedAt === null).map((d) => d.itemId))
        let position = existing.reduce((max, d) => Math.max(max, d.position), -1) + 1
        for (const itemId of itemIds) {
          if (live.has(itemId)) continue
          live.add(itemId)
          rows.push({ id: crypto.randomUUID(), deckId, itemId, position: position++, createdAt: now, updatedAt: now, deletedAt: null })
        }
      }
      return rows
    },

    async addToDeck(deckId: ID, itemIds: ID[], now = Date.now()) {
      await save([{ table: 'deckItems', rows: await repo.membershipRows([deckId], itemIds, now) }], now)
    },

    async removeFromDeck(deckId: ID, itemIds: ID[], now = Date.now()) {
      const set = new Set(itemIds)
      const links = (await database.deckItems.where('deckId').equals(deckId).toArray()).filter((d) => d.deletedAt === null && set.has(d.itemId))
      await save([{ table: 'deckItems', rows: links.map((d) => ({ ...d, deletedAt: now, updatedAt: now })) }], now)
    },

    async moveToDeck(fromDeckId: ID, toDeckId: ID, itemIds: ID[], now = Date.now()) {
      const set = new Set(itemIds)
      const links = (await database.deckItems.where('deckId').equals(fromDeckId).toArray()).filter((d) => d.deletedAt === null && set.has(d.itemId))
      const added = await repo.membershipRows([toDeckId], itemIds, now)
      await save([{ table: 'deckItems', rows: [...links.map((d) => ({ ...d, deletedAt: now, updatedAt: now })), ...added] }], now)
    },

    // ---- Buổi học --------------------------------------------------------------------------

    async startSession(plan: SessionPlan, now = Date.now()): Promise<StudySessionRow> {
      const active = await database.studySessions.where('status').equals('active').toArray()
      const row: StudySessionRow = { id: crypto.randomUUID(), mode: plan.mode, startedAt: plan.startedAt, endedAt: null, status: 'active', plan, updatedAt: now }
      await database.transaction('rw', database.studySessions, async () => {
        for (const s of active) await database.studySessions.put({ ...s, status: 'abandoned', endedAt: now, updatedAt: now })
        await database.studySessions.put(row)
      })
      return row
    },

    async activeSession(): Promise<StudySessionRow | undefined> {
      const rows = await database.studySessions.where('status').equals('active').toArray()
      return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0]
    },

    async endSession(id: ID, status: 'completed' | 'abandoned', plan?: SessionPlan, now = Date.now()) {
      const row = await database.studySessions.get(id)
      if (!row) return
      await database.studySessions.put({ ...row, plan: plan ?? row.plan, status, endedAt: now, updatedAt: now })
    },

    /**
     * Ghi kết quả một bước: lượt trả lời (chỉ thêm) và lịch ôn mới của từ (nếu bước này được tính lịch),
     * rồi lưu tiến trình buổi để tiếp tục được khi bị gián đoạn.
     */
    async recordStep(
      session: StudySessionRow,
      step: Step,
      effect: AnswerEffect,
      nextPlan: SessionPlan,
      meta: { at: number; responseMs: number | null; hintLevel?: number; exercise?: ExerciseKind },
    ): Promise<{ card: CardStateRow | null }> {
      const { at } = meta
      const changes: Change[] = []
      let card: CardStateRow | null = null
      if (effect.log) {
        const log: ReviewLogRow = {
          id: crypto.randomUUID(),
          itemId: step.itemId,
          sessionId: session.id,
          reviewedAt: at,
          mode: session.mode,
          exercise: meta.exercise ?? step.exercise,
          grade: effect.grade as ReviewLogRow['grade'],
          correct: effect.correct,
          hintLevel: meta.hintLevel ?? 0,
          responseMs: meta.responseMs,
          affectsSchedule: effect.schedule,
          deviceId: getDeviceId(),
          createdAt: at,
        }
        changes.push({ table: 'reviewLogs', rows: [log] })
      }
      if (effect.schedule && effect.grade !== null) {
        card = await repo.scheduledCard(step.itemId, effect.grade, at)
        changes.push({ table: 'cardStates', rows: [card] })
      }
      await database.transaction('rw', [database.reviewLogs, database.cardStates, database.outbox, database.studySessions], async () => {
        await commit(database, changes, at)
        await database.studySessions.put({ ...session, plan: nextPlan, updatedAt: at })
      })
      notifyChange()
      return { card }
    },

    /** Lịch ôn mới của từ sau một lượt có điểm (R5.1, R5.4). Không tự ghi. */
    async scheduledCard(itemId: ID, grade: Grade, at: number): Promise<CardStateRow> {
      const prev = await database.cardStates.get(itemId)
      const live = prev && prev.deletedAt === null ? prev : undefined
      const base = live ? rowToCard(live) : newCard(new Date(at))
      const next = applyReview(scheduler, base, grade, new Date(at)).card
      return cardToRow(itemId, next, at, live)
    },
  }
  return repo
}

/** Bộ lập lịch dùng chung cả app (tham số mặc định; tối ưu theo người học ở R5.13). */
export const appScheduler = createScheduler()
export const repo = createRepo(db, appScheduler)
export type Repo = ReturnType<typeof createRepo>
