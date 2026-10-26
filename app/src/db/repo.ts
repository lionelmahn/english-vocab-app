import type { FSRS, Grade } from 'ts-fsrs'
import type { ExerciseKind } from '../core/grading'
import { applyReview, createScheduler, newCard } from '../core/scheduler'
import type { AnswerEffect, SessionPlan, Step } from '../core/session'
import { sameContent } from '../core/merge'
import { profileDefaults, sanitizeProfile, type ProfileData } from '../core/profile'
import { duplicateGroups, findDuplicates, meaningKey, termKey, type DuplicateCandidate, type DuplicateMatch } from '../core/vocab'
import { getDeviceId } from '../lib/device'
import { cardToRow, rowToCard } from './cards'
import { commit, db, notifyChange, type Change, type VocabDatabase } from './db'
import { PROFILE_ID, type CardStateRow, type Deck, type DeckItem, type Example, type ID, type LookupEntry, type PartOfSpeech, type Profile, type ReviewLogRow, type StudySessionRow, type VocabItem } from './types'

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

/** Số câu ví dụ tối đa của một mục học (khớp form thêm từ). */
export const MAX_EXAMPLES = 5

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

/** Gộp nhãn, bỏ nhãn trùng khác hoa thường (giữ cách viết gặp trước). */
function unionTags(tags: string[]): string[] {
  const out = new Map<string, string>()
  for (const t of tags) if (!out.has(t.toLowerCase())) out.set(t.toLowerCase(), t)
  return [...out.values()]
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

    /**
     * Lưu từ từ nguồn có sẵn (R2.8): kết quả tra từ, sau này là bài học và kho chung. Một hoặc nhiều mục.
     * Mục trùng hẳn (cùng từ, loại từ, nghĩa) với từ đã có hoặc với mục khác trong lần lưu (R2.5) không tạo thêm,
     * chỉ được thêm vào các bộ đã chọn.
     */
    async saveFromSource(inputs: ItemInput[], deckIds: ID[] = [], now = Date.now()): Promise<{ created: ID[]; existing: ID[] }> {
      const created: VocabItem[] = []
      const existing: ID[] = []
      for (const raw of inputs) {
        const v = normalizeInput(raw)
        const dup = [...(await repo.duplicatesOf(v)), ...findDuplicates(v, created)].find((m) => m.kind === 'exact')?.item
        if (dup) {
          if (!existing.includes(dup.id) && !created.includes(dup)) existing.push(dup.id)
          continue
        }
        // createdAt tăng dần để học theo đúng thứ tự đã chọn.
        created.push({ ...v, id: crypto.randomUUID(), termKey: termKey(v.term), archived: false, createdAt: now + created.length, updatedAt: now, deletedAt: null })
      }
      const links = await repo.membershipRows(deckIds, [...created.map((c) => c.id), ...existing], now)
      await save(
        [
          { table: 'vocabItems', rows: created },
          { table: 'deckItems', rows: links },
        ],
        now,
      )
      return { created: created.map((c) => c.id), existing }
    },

    /**
     * Thêm một bộ từ khởi đầu (R1.7) vào sổ tay: dùng lại bộ cùng tên nếu đã có, từ đã có thì chỉ đưa vào bộ.
     * Thêm lại lần nữa không tạo bản trùng.
     */
    async addStarterDeck(name: string, inputs: ItemInput[], now = Date.now()): Promise<{ deckId: ID; created: number; existing: number }> {
      const decks = (await database.decks.toArray()).filter((d) => d.deletedAt === null)
      const found = decks.find((d) => d.name.trim().toLowerCase() === name.trim().toLowerCase())
      const deckId = found?.id ?? (await repo.createDeck({ name }, now))
      const res = await repo.saveFromSource(inputs, [deckId], now)
      await repo.fillMissingIpa(inputs, now)
      return { deckId, created: res.created.length, existing: res.existing.length }
    },

    /**
     * Điền phiên âm còn trống cho từ đã có trong sổ tay từ dữ liệu soạn sẵn (bộ khởi đầu có phiên âm từ bản 0.12.2).
     * Chỉ điền vào ô trống, không sửa phiên âm người học đã có. Một từ khớp khi cùng từ và loại từ, và là từ của chính
     * nguồn đó (cùng `source`) hoặc trùng hẳn nghĩa. Trả về số từ được điền.
     */
    async fillMissingIpa(inputs: ItemInput[], now = Date.now()): Promise<number> {
      const byKey = new Map(inputs.map((i) => [`${termKey(i.term)}|${i.partOfSpeech}`, i]))
      const rows: VocabItem[] = []
      for (const item of await database.vocabItems.toArray()) {
        if (item.deletedAt !== null || (item.ipaUs && item.ipaUk)) continue
        const from = byKey.get(`${item.termKey}|${item.partOfSpeech}`)
        if (!from || (item.source !== from.source && meaningKey(item.meaningVi) !== meaningKey(from.meaningVi))) continue
        const ipaUs = item.ipaUs || clean(from.ipaUs)
        const ipaUk = item.ipaUk || clean(from.ipaUk)
        if (ipaUs !== item.ipaUs || ipaUk !== item.ipaUk) rows.push({ ...item, ipaUs, ipaUk, updatedAt: now })
      }
      if (rows.length > 0) await save([{ table: 'vocabItems', rows }], now)
      return rows.length
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

    /** Thêm một đáp án chấp nhận cho mục học (R6.13); bỏ qua nếu đã có (không phân biệt hoa thường). */
    async addAcceptedAnswer(id: ID, answer: string, now = Date.now()): Promise<boolean> {
      const current = await database.vocabItems.get(id)
      const text = answer.trim().replace(/\s+/g, ' ')
      if (!current || !text) return false
      const known = [current.term, ...current.acceptedAnswers].map((a) => a.toLowerCase())
      if (known.includes(text.toLowerCase())) return false
      await save([{ table: 'vocabItems', rows: [{ ...current, acceptedAnswers: [...current.acceptedAnswers, text], updatedAt: now }] }], now)
      return true
    },

    /** Đặt mẹo nhớ cho mục học (R8.4: nhận một mẹo AI gợi ý). Chuỗi trống thì bỏ mẹo nhớ. */
    async setMnemonic(id: ID, mnemonic: string, now = Date.now()): Promise<void> {
      const current = await database.vocabItems.get(id)
      if (!current) return
      await save([{ table: 'vocabItems', rows: [{ ...current, mnemonic: clean(mnemonic), updatedAt: now }] }], now)
    },

    /**
     * Thêm câu ví dụ cho mục học (R8.3), tối đa `MAX_EXAMPLES` câu; câu đã có (không phân biệt hoa thường, khoảng trắng)
     * thì bỏ qua. Trả về số câu đã thêm.
     */
    async addExamples(id: ID, examples: Example[], now = Date.now()): Promise<number> {
      const current = await database.vocabItems.get(id)
      if (!current) return 0
      const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
      const have = new Set(current.examples.map((e) => key(e.en)))
      const added: Example[] = []
      for (const e of examples) {
        if (current.examples.length + added.length >= MAX_EXAMPLES) break
        const en = e.en.trim().replace(/\s+/g, ' ')
        if (!en || have.has(key(en))) continue
        have.add(key(en))
        added.push({ en, vi: clean(e.vi) })
      }
      if (added.length > 0) await save([{ table: 'vocabItems', rows: [{ ...current, examples: [...current.examples, ...added], updatedAt: now }] }], now)
      return added.length
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
      // Hình minh họa (R2.6) bỏ theo từ; file trên kho được xóa ở lượt đồng bộ sau.
      const images = (await database.itemImages.where('itemId').anyOf(ids).toArray()).filter((x) => x.deletedAt === null)
      const gone = <T extends { deletedAt: number | null; updatedAt: number }>(r: T) => ({ ...r, deletedAt: now, updatedAt: now })
      await save(
        [
          { table: 'vocabItems', rows: items.map(gone) },
          { table: 'deckItems', rows: links.map(gone) },
          { table: 'cardStates', rows: cards.map(gone) },
          { table: 'itemImages', rows: images.map(gone) },
        ],
        now,
      )
    },

    /**
     * Học lại từ đầu (R5.8): bỏ lịch ôn hiện tại, từ trở về chưa học. Lượt trả lời cũ vẫn giữ trong lịch sử nhưng
     * không còn tính vào lịch ôn mới (thẻ mới có ngày tạo sau các lượt đó).
     */
    async resetProgress(ids: ID[], now = Date.now()): Promise<number> {
      const cards = (await database.cardStates.bulkGet(ids)).filter((c): c is CardStateRow => !!c && c.deletedAt === null)
      if (cards.length > 0) await save([{ table: 'cardStates', rows: cards.map((c) => ({ ...c, deletedAt: now, updatedAt: now })) }], now)
      return cards.length
    },

    /** Tạm dừng ôn (R5.8): từ không đến hạn, không vào buổi ôn hay ôn chủ động cho tới khi bỏ tạm dừng. */
    async setSuspended(ids: ID[], suspended: boolean, now = Date.now()): Promise<number> {
      const cards = (await database.cardStates.bulkGet(ids)).filter((c): c is CardStateRow => !!c && c.deletedAt === null && c.suspended !== suspended)
      if (cards.length > 0) await save([{ table: 'cardStates', rows: cards.map((c) => ({ ...c, suspended, updatedAt: now })) }], now)
      return cards.length
    },

    /**
     * Gộp từ trùng nội dung (R2.5, R11.4). Mỗi nhóm giữ mục có tiến độ cao nhất (rồi mục tạo sớm nhất),
     * bổ sung nhãn, ví dụ, ghi chú… còn thiếu từ các mục kia; các mục kia bị xóa (mềm) và bộ từ của chúng
     * chuyển sang mục giữ lại. Lịch sử trả lời được giữ nguyên.
     */
    async mergeDuplicates(now = Date.now()): Promise<{ groups: number; removed: number }> {
      const groups = duplicateGroups(await database.vocabItems.toArray())
      if (groups.length === 0) return { groups: 0, removed: 0 }
      const cards = new Map((await database.cardStates.toArray()).filter((c) => c.deletedAt === null).map((c) => [c.id, c]))
      const links = (await database.deckItems.toArray()).filter((d) => d.deletedAt === null)
      const reps = (i: VocabItem) => cards.get(i.id)?.reps ?? -1
      const items: VocabItem[] = []
      const cardRows: CardStateRow[] = []
      const linkRows: DeckItem[] = []
      let removed = 0
      for (const group of groups) {
        const [keep, ...rest] = [...group].sort((a, b) => reps(b) - reps(a) || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
        const fill = <K extends 'meaningEn' | 'ipaUk' | 'ipaUs' | 'note' | 'mnemonic' | 'source'>(k: K) => keep[k] ?? rest.find((r) => r[k])?.[k]
        const merged: VocabItem = {
          ...keep,
          meaningEn: fill('meaningEn'),
          ipaUk: fill('ipaUk'),
          ipaUs: fill('ipaUs'),
          note: fill('note'),
          mnemonic: fill('mnemonic'),
          source: fill('source'),
          examples: keep.examples.length > 0 ? keep.examples : (rest.find((r) => r.examples.length > 0)?.examples ?? []),
          acceptedAnswers: [...new Set([keep, ...rest].flatMap((i) => i.acceptedAnswers))],
          tags: unionTags([keep, ...rest].flatMap((i) => i.tags)),
          favorite: group.some((i) => i.favorite),
          difficult: group.some((i) => i.difficult),
          updatedAt: now,
        }
        if (!sameContent(merged, keep)) items.push(merged)
        const keepDecks = new Set(links.filter((l) => l.itemId === keep.id).map((l) => l.deckId))
        for (const r of rest) {
          removed++
          items.push({ ...r, deletedAt: now, updatedAt: now })
          const card = cards.get(r.id)
          if (card) cardRows.push({ ...card, deletedAt: now, updatedAt: now })
          for (const l of links.filter((x) => x.itemId === r.id)) {
            linkRows.push({ ...l, deletedAt: now, updatedAt: now })
            if (keepDecks.has(l.deckId)) continue
            keepDecks.add(l.deckId)
            linkRows.push({ id: crypto.randomUUID(), deckId: l.deckId, itemId: keep.id, position: l.position, createdAt: now, updatedAt: now, deletedAt: null })
          }
        }
      }
      await save(
        [
          { table: 'vocabItems', rows: items },
          { table: 'deckItems', rows: linkRows },
          { table: 'cardStates', rows: cardRows },
        ],
        now,
      )
      return { groups: groups.length, removed }
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

    /**
     * Sao chép bộ từ (R3.5): bộ mới cùng tên (thêm "bản sao"), mô tả, chủ đề và các từ theo đúng thứ tự.
     * Bộ mới dùng chung các từ (nội dung và tiến độ) với bộ gốc; thêm bớt từ ở bộ nào chỉ ảnh hưởng bộ đó.
     */
    async copyDeck(id: ID, now = Date.now()): Promise<ID | null> {
      const source = await database.decks.get(id)
      if (!source || source.deletedAt !== null) return null
      const links = (await database.deckItems.where('deckId').equals(id).toArray()).filter((d) => d.deletedAt === null).sort((a, b) => a.position - b.position)
      const live = new Set((await database.vocabItems.bulkGet(links.map((d) => d.itemId))).filter((i) => !!i && i.deletedAt === null).map((i) => i!.id))
      const copy: Deck = { ...source, id: crypto.randomUUID(), name: `${source.name} (bản sao)`.slice(0, 100), active: true, archived: false, createdAt: now, updatedAt: now, deletedAt: null }
      const rows: DeckItem[] = links
        .filter((d) => live.has(d.itemId))
        .map((d, position) => ({ id: crypto.randomUUID(), deckId: copy.id, itemId: d.itemId, position, createdAt: now, updatedAt: now, deletedAt: null }))
      await save(
        [
          { table: 'decks', rows: [copy] },
          { table: 'deckItems', rows },
        ],
        now,
      )
      return copy.id
    },

    // ---- Lịch sử tra từ (R15.4) ----------------------------------------------------------------

    /** Ghi một lần tra: từ đã có trong lịch sử thì cập nhật thời điểm, chưa có thì thêm. */
    async recordLookup(query: string, now = Date.now()): Promise<void> {
      const q = query.trim().replace(/\s+/g, ' ').slice(0, 200)
      if (!q) return
      const same = (await database.lookupHistory.where('query').equals(q).toArray()).filter((e) => e.deletedAt === null)
      const [keep, ...extra] = same.sort((a, b) => b.lookedUpAt - a.lookedUpAt)
      const rows: LookupEntry[] = [
        keep ? { ...keep, lookedUpAt: now, updatedAt: now } : { id: crypto.randomUUID(), query: q, lookedUpAt: now, updatedAt: now, deletedAt: null },
        // Hai máy cùng tra một từ khi chưa đồng bộ: giữ một dòng.
        ...extra.map((e) => ({ ...e, deletedAt: now, updatedAt: now })),
      ]
      await save([{ table: 'lookupHistory', rows }], now)
    },

    /** Xóa vài từ khỏi lịch sử tra, hoặc xóa hết khi không truyền `ids`. */
    async clearLookups(ids?: ID[], now = Date.now()): Promise<number> {
      const rows = (ids ? await database.lookupHistory.bulkGet(ids) : await database.lookupHistory.toArray()).filter((e): e is LookupEntry => !!e && e.deletedAt === null)
      if (rows.length > 0) await save([{ table: 'lookupHistory', rows: rows.map((e) => ({ ...e, deletedAt: now, updatedAt: now })) }], now)
      return rows.length
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

    // ---- Hồ sơ, mục tiêu, lịch học, cài đặt học (R1.4, R1.5, R9.2, R14.2) -------------------------

    /** Sửa hồ sơ. Thiết bị chưa có hồ sơ thì tạo từ giá trị mặc định. Trả về hồ sơ sau khi sửa. */
    async updateProfile(patch: Partial<ProfileData>, now = Date.now()): Promise<Profile> {
      const saved = await database.transaction('rw', [database.profiles, database.outbox, database.syncBase], async () => {
        let row = await database.profiles.get(PROFILE_ID)
        if (!row) {
          row = { id: PROFILE_ID, ...profileDefaults(), createdAt: now, updatedAt: now, deletedAt: null }
          // Thiết bị chưa từng đồng bộ hồ sơ: lấy giá trị mặc định làm bản gốc khi gộp (R11.7), để chỉ những mục
          // vừa sửa ở đây mới đè lên hồ sơ trên máy chủ; các mục khác vẫn lấy theo máy chủ.
          const baseKey = `profiles:${PROFILE_ID}`
          if (!(await database.syncBase.get(baseKey))) await database.syncBase.put({ key: baseKey, row })
        }
        const next: Profile = { ...row, ...sanitizeProfile({ ...row, ...patch }, row), updatedAt: now }
        if (sameContent(next, row)) return row
        await commit(database, [{ table: 'profiles', rows: [next] }], now)
        return next
      })
      notifyChange()
      return saved
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
