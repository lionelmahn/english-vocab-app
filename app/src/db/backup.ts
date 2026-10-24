import type { FSRS } from 'ts-fsrs'
import type { SessionMode } from '../core/grading'
import { sameContent } from '../core/merge'
import { POS_ORDER } from '../core/pos'
import { sanitizeProfile, type ProfileData } from '../core/profile'
import { findDuplicates, termKey } from '../core/vocab'
import { healCards } from './cards'
import { commit, type Change, type VocabDatabase } from './db'
import type { CardStateRow, Deck, DeckItem, ID, ReviewLogRow, VocabItem } from './types'

/**
 * Sao lưu ra file có cả tiến độ (R11.3) và khôi phục từ file (R11.4):
 * kiểm tra bản sao, chọn cách khôi phục, xử lý dữ liệu trùng.
 * Mọi thay đổi khi khôi phục đi qua hàng đợi đồng bộ, nên các thiết bị khác cũng nhận được.
 */

export const BACKUP_FORMAT = 'english-vocab-backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  vocabItems: VocabItem[]
  decks: Deck[]
  deckItems: DeckItem[]
  cardStates: CardStateRow[]
  reviewLogs: ReviewLogRow[]
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** ISO 8601 */
  exportedAt: string
  appVersion: string
  /** Cài đặt học của người dùng lúc sao lưu (tùy chọn khôi phục). */
  settings?: Record<string, unknown>
  /** Hồ sơ, mục tiêu, lịch học và cài đặt học (từ bản 0.8.0). */
  profile?: ProfileData
  data: BackupData
}

const live = <T extends { deletedAt: number | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null)

/** Bản sao lưu gồm mọi từ, bộ từ, lịch ôn và lịch sử trả lời đang dùng (không gồm mục đã xóa). */
export async function createBackup(
  database: VocabDatabase,
  meta: { appVersion: string; settings?: Record<string, unknown>; profile?: ProfileData; now?: number },
): Promise<BackupFile> {
  const items = live(await database.vocabItems.toArray())
  const itemIds = new Set(items.map((i) => i.id))
  const decks = live(await database.decks.toArray())
  const deckIds = new Set(decks.map((d) => d.id))
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(meta.now ?? Date.now()).toISOString(),
    appVersion: meta.appVersion,
    settings: meta.settings,
    profile: meta.profile,
    data: {
      vocabItems: items,
      decks,
      deckItems: live(await database.deckItems.toArray()).filter((l) => deckIds.has(l.deckId) && itemIds.has(l.itemId)),
      cardStates: live(await database.cardStates.toArray()).filter((c) => itemIds.has(c.id)),
      reviewLogs: (await database.reviewLogs.toArray()).filter((l) => itemIds.has(l.itemId)),
    },
  }
}

/** Tên file gợi ý: tu-vung-sao-luu-2026-10-24.json */
export function backupFileName(now = Date.now()): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `tu-vung-sao-luu-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
}

// ---- Kiểm tra bản sao ---------------------------------------------------------------------

type Raw = Record<string, unknown>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isStr = (v: unknown): v is string => typeof v === 'string'
const text = (v: unknown): string | undefined => (isStr(v) && v.trim() ? v : undefined)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : [])
const SMALLINT = 32_767
const INT_MAX = 2_147_483_647
const MODES: readonly SessionMode[] = ['learn', 'review', 'retry', 'practice', 'test']

function cleanItem(r: Raw): VocabItem | null {
  if (!isId(r.id) || !isStr(r.term) || !r.term.trim() || !isStr(r.meaningVi) || !isTime(r.createdAt) || !isTime(r.updatedAt) || r.deletedAt != null) return null
  const term = r.term.trim().replace(/\s+/g, ' ').slice(0, 200)
  const examples = Array.isArray(r.examples)
    ? (r.examples as Raw[]).filter((e) => e && isStr(e.en) && e.en.trim()).map((e) => ({ en: e.en as string, vi: text(e.vi) }))
    : []
  return {
    id: r.id.toLowerCase(),
    term,
    termKey: termKey(term),
    partOfSpeech: POS_ORDER.includes(r.partOfSpeech as VocabItem['partOfSpeech']) ? (r.partOfSpeech as VocabItem['partOfSpeech']) : 'other',
    meaningVi: r.meaningVi,
    meaningEn: text(r.meaningEn),
    ipaUk: text(r.ipaUk),
    ipaUs: text(r.ipaUs),
    examples,
    acceptedAnswers: strings(r.acceptedAnswers),
    note: text(r.note),
    mnemonic: text(r.mnemonic),
    source: text(r.source),
    tags: strings(r.tags),
    favorite: r.favorite === true,
    difficult: r.difficult === true,
    archived: r.archived === true,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  }
}

function cleanDeck(r: Raw): Deck | null {
  if (!isId(r.id) || !isStr(r.name) || !r.name.trim() || !isTime(r.createdAt) || !isTime(r.updatedAt) || r.deletedAt != null) return null
  return {
    id: r.id.toLowerCase(),
    name: r.name.trim().slice(0, 120),
    description: text(r.description),
    topic: text(r.topic),
    dailyGoal: isInt(r.dailyGoal, 0, INT_MAX) ? r.dailyGoal : undefined,
    active: r.active !== false,
    archived: r.archived === true,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  }
}

function cleanDeckItem(r: Raw): DeckItem | null {
  if (!isId(r.id) || !isId(r.deckId) || !isId(r.itemId) || !isTime(r.createdAt) || !isTime(r.updatedAt) || r.deletedAt != null) return null
  return {
    id: r.id.toLowerCase(),
    deckId: r.deckId.toLowerCase(),
    itemId: r.itemId.toLowerCase(),
    position: isInt(r.position, -INT_MAX, INT_MAX) ? r.position : 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  }
}

function cleanCard(r: Raw): CardStateRow | null {
  if (!isId(r.id) || !isTime(r.due) || !isNum(r.stability) || !isNum(r.difficulty) || !isNum(r.scheduledDays)) return null
  if (!isInt(r.learningSteps, 0, INT_MAX) || !isInt(r.reps, 0, INT_MAX) || !isInt(r.lapses, 0, INT_MAX) || !isInt(r.state, 0, 3)) return null
  if (!(r.lastReview === null || isTime(r.lastReview)) || !isTime(r.createdAt) || !isTime(r.updatedAt) || r.deletedAt != null) return null
  const id = r.id.toLowerCase()
  return {
    id,
    itemId: id,
    due: r.due,
    stability: r.stability,
    difficulty: r.difficulty,
    scheduledDays: Math.round(r.scheduledDays),
    learningSteps: r.learningSteps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as CardStateRow['state'],
    lastReview: r.lastReview,
    suspended: r.suspended === true,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: null,
  }
}

function cleanLog(r: Raw): ReviewLogRow | null {
  if (!isId(r.id) || !isId(r.itemId) || !isId(r.sessionId) || !isTime(r.reviewedAt) || !isTime(r.createdAt)) return null
  if (!MODES.includes(r.mode as SessionMode) || !isStr(r.exercise) || !(r.grade === null || isInt(r.grade, 1, 4))) return null
  if (!(r.correct === null || typeof r.correct === 'boolean') || typeof r.affectsSchedule !== 'boolean' || !isStr(r.deviceId)) return null
  return {
    id: r.id.toLowerCase(),
    itemId: r.itemId.toLowerCase(),
    sessionId: r.sessionId.toLowerCase(),
    reviewedAt: r.reviewedAt,
    mode: r.mode as SessionMode,
    exercise: r.exercise as ReviewLogRow['exercise'],
    grade: r.grade as ReviewLogRow['grade'],
    correct: r.correct as boolean | null,
    hintLevel: isInt(r.hintLevel, 0, SMALLINT) ? r.hintLevel : 0,
    responseMs: isNum(r.responseMs) ? Math.min(INT_MAX, Math.max(0, Math.round(r.responseMs))) : null,
    affectsSchedule: r.affectsSchedule,
    deviceId: r.deviceId,
    createdAt: r.createdAt,
  }
}

function cleanAll<T extends { id: string }>(raw: unknown, clean: (r: Raw) => T | null): { rows: T[]; invalid: number } {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const rows: T[] = []
  for (const r of list) {
    const row = r && typeof r === 'object' ? clean(r as Raw) : null
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  return { rows, invalid: list.length - rows.length }
}

export type ReadResult = { ok: true; backup: BackupFile; invalid: number } | { ok: false; error: string }

/** Đọc và kiểm tra file sao lưu. Dòng hỏng hoặc trỏ tới dữ liệu không có trong file bị bỏ qua và được đếm. */
export function readBackup(textContent: string): ReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(textContent)
  } catch {
    return { ok: false, error: 'File không đọc được (không phải JSON). Hãy chọn file .json do app xuất ra.' }
  }
  const f = parsed as Raw | null
  if (!f || typeof f !== 'object' || f.format !== BACKUP_FORMAT) return { ok: false, error: 'File này không phải bản sao lưu của app Ôn từ vựng.' }
  if (!isInt(f.version, 1, Number.MAX_SAFE_INTEGER)) return { ok: false, error: 'Bản sao lưu bị hỏng (thiếu phiên bản định dạng).' }
  if (f.version > BACKUP_VERSION) return { ok: false, error: 'Bản sao lưu được tạo bởi phiên bản app mới hơn. Hãy cập nhật app rồi thử lại.' }
  const data = f.data as Raw | undefined
  if (!data || typeof data !== 'object') return { ok: false, error: 'Bản sao lưu bị hỏng (không có dữ liệu).' }

  const items = cleanAll(data.vocabItems, cleanItem)
  const decks = cleanAll(data.decks, cleanDeck)
  const itemIds = new Set(items.rows.map((i) => i.id))
  const deckIds = new Set(decks.rows.map((d) => d.id))
  const links = cleanAll(data.deckItems, cleanDeckItem)
  const cards = cleanAll(data.cardStates, cleanCard)
  const logs = cleanAll(data.reviewLogs, cleanLog)
  const deckItems = links.rows.filter((l) => deckIds.has(l.deckId) && itemIds.has(l.itemId))
  const cardStates = cards.rows.filter((c) => itemIds.has(c.id))
  const reviewLogs = logs.rows.filter((l) => itemIds.has(l.itemId))
  if (items.rows.length === 0 && decks.rows.length === 0) return { ok: false, error: 'Bản sao lưu không có từ hay bộ từ nào dùng được.' }

  const invalid =
    items.invalid + decks.invalid + links.invalid + cards.invalid + logs.invalid +
    (links.rows.length - deckItems.length) + (cards.rows.length - cardStates.length) + (logs.rows.length - reviewLogs.length)
  return {
    ok: true,
    invalid,
    backup: {
      format: BACKUP_FORMAT,
      version: f.version,
      exportedAt: isStr(f.exportedAt) ? f.exportedAt : '',
      appVersion: isStr(f.appVersion) ? f.appVersion : '',
      settings: f.settings && typeof f.settings === 'object' ? (f.settings as Record<string, unknown>) : undefined,
      profile: f.profile && typeof f.profile === 'object' ? sanitizeProfile(f.profile as Record<string, unknown>) : undefined,
      data: { vocabItems: items.rows, decks: decks.rows, deckItems, cardStates, reviewLogs },
    },
  }
}

// ---- Xem trước và khôi phục -----------------------------------------------------------------

export interface RestorePreview {
  /** Từ chưa có trên thiết bị này. */
  newItems: number
  /** Từ đã xóa trên thiết bị này (sẽ được lấy lại). */
  deletedHere: number
  /** Từ đang có (cùng mục học). */
  existing: number
  /** Từ chưa có nhưng trùng nội dung (cùng từ, loại từ, nghĩa) với một từ đang có. */
  duplicates: number
  /** Từ đang có trên thiết bị nhưng không có trong bản sao lưu. */
  onlyHere: number
  /** Lượt trả lời chưa có trên thiết bị. */
  newLogs: number
}

async function currentState(database: VocabDatabase) {
  const items = await database.vocabItems.toArray()
  return {
    items: new Map(items.map((i) => [i.id, i])),
    liveItems: live(items),
    decks: new Map((await database.decks.toArray()).map((d) => [d.id, d])),
    deckItems: await database.deckItems.toArray(),
    cards: new Map((await database.cardStates.toArray()).map((c) => [c.id, c])),
    logIds: new Set(await database.reviewLogs.toCollection().primaryKeys()),
  }
}

function isDuplicate(item: VocabItem, liveItems: VocabItem[]): boolean {
  return findDuplicates(item, liveItems, item.id).some((d) => d.kind === 'exact')
}

export async function previewRestore(database: VocabDatabase, backup: BackupFile): Promise<RestorePreview> {
  const cur = await currentState(database)
  const p: RestorePreview = { newItems: 0, deletedHere: 0, existing: 0, duplicates: 0, onlyHere: 0, newLogs: 0 }
  for (const b of backup.data.vocabItems) {
    const l = cur.items.get(b.id)
    if (!l) {
      if (isDuplicate(b, cur.liveItems)) p.duplicates++
      else p.newItems++
    } else if (l.deletedAt !== null) p.deletedHere++
    else p.existing++
  }
  const inBackup = new Set(backup.data.vocabItems.map((i) => i.id))
  p.onlyHere = cur.liveItems.filter((i) => !inBackup.has(i.id)).length
  p.newLogs = backup.data.reviewLogs.filter((l) => !cur.logIds.has(l.id)).length
  return p
}

export interface RestoreOptions {
  /**
   * merge: thêm phần còn thiếu, lấy lại mục đã xóa, mục có ở cả hai nơi thì giữ bản sửa sau.
   * replace: từ vựng và bộ từ trở về đúng như bản sao lưu; mục không có trong bản sao lưu bị xóa.
   * Cả hai cách đều không làm mất lượt học: giữ toàn bộ lịch sử trả lời và lịch ôn tính đủ các lượt đó.
   */
  mode: 'merge' | 'replace'
  /** Từ trùng nội dung với từ đang có (khác mục học): bỏ qua, hay vẫn thêm thành mục riêng. Chỉ dùng khi gộp. */
  duplicates: 'skip' | 'keep'
}

export interface RestoreResult {
  added: number
  restored: number
  updated: number
  skipped: number
  removed: number
  logs: number
  replayed: number
}

export async function restoreBackup(database: VocabDatabase, backup: BackupFile, opts: RestoreOptions, scheduler: FSRS, now = Date.now()): Promise<RestoreResult> {
  const cur = await currentState(database)
  const res: RestoreResult = { added: 0, restored: 0, updated: 0, skipped: 0, removed: 0, logs: 0, replayed: 0 }
  const fresh = <T extends { updatedAt: number; deletedAt: number | null }>(r: T): T => ({ ...r, updatedAt: now, deletedAt: null })
  const gone = <T extends { updatedAt: number; deletedAt: number | null }>(r: T): T => ({ ...r, updatedAt: now, deletedAt: now })
  const replace = opts.mode === 'replace'

  // Từ: mục nào được đưa vào (để quyết định liên kết, lịch ôn, lượt trả lời đi kèm).
  const items: VocabItem[] = []
  const included = new Set<ID>()
  for (const b of backup.data.vocabItems) {
    const l = cur.items.get(b.id)
    if (!l) {
      if (!replace && opts.duplicates === 'skip' && isDuplicate(b, cur.liveItems)) {
        res.skipped++
        continue
      }
      items.push(fresh(b))
      res.added++
    } else if (l.deletedAt !== null) {
      items.push(fresh(b))
      res.restored++
    } else if (replace ? !sameContent(b, l) : b.updatedAt > l.updatedAt && !sameContent(b, l)) {
      items.push(fresh(b))
      res.updated++
    }
    included.add(b.id)
  }

  // Bộ từ: khi gộp, bộ chưa có (hoặc đã xóa) mà trùng tên với bộ đang có thì dùng chung bộ đó.
  const decks: Deck[] = []
  const deckMap = new Map<ID, ID>()
  const liveDeckByName = new Map([...cur.decks.values()].filter((d) => d.deletedAt === null).map((d) => [d.name.trim().toLowerCase(), d.id]))
  for (const b of backup.data.decks) {
    const l = cur.decks.get(b.id)
    deckMap.set(b.id, b.id)
    if (l && l.deletedAt === null) {
      if (replace ? !sameContent(b, l) : b.updatedAt > l.updatedAt && !sameContent(b, l)) decks.push(fresh(b))
      continue
    }
    const same = replace ? undefined : liveDeckByName.get(b.name.trim().toLowerCase())
    if (same) deckMap.set(b.id, same)
    else decks.push(fresh(b))
  }

  // Liên kết bộ–từ: không tạo liên kết trùng với liên kết đang có.
  const deckItems: DeckItem[] = []
  const livePairs = new Set(cur.deckItems.filter((d) => d.deletedAt === null).map((d) => `${d.deckId}|${d.itemId}`))
  const linkById = new Map(cur.deckItems.map((d) => [d.id, d]))
  const keptLinks = new Set<ID>()
  for (const b of backup.data.deckItems) {
    if (!included.has(b.itemId)) continue
    const deckId = deckMap.get(b.deckId)!
    const pair = `${deckId}|${b.itemId}`
    const l = linkById.get(b.id)
    if (l && l.deletedAt === null && l.deckId === deckId) {
      keptLinks.add(l.id)
      continue
    }
    if (livePairs.has(pair)) {
      for (const d of cur.deckItems) if (d.deletedAt === null && `${d.deckId}|${d.itemId}` === pair) keptLinks.add(d.id)
      continue
    }
    const id = deckId === b.deckId ? b.id : crypto.randomUUID()
    deckItems.push(fresh({ ...b, id, deckId }))
    livePairs.add(pair)
    keptLinks.add(id)
  }

  // Lịch ôn (cả hai cách khôi phục đều không làm mất tiến độ): mục chưa có lịch, hoặc đã đặt lại, nhận lịch
  // trong bản sao lưu; có ở cả hai nơi thì giữ bản mới hơn. Sau đó lịch nào thiếu lượt trả lời được tính lại.
  const cards: CardStateRow[] = []
  for (const b of backup.data.cardStates) {
    if (!included.has(b.id)) continue
    const l = cur.cards.get(b.id)
    if (!l || l.deletedAt !== null || (b.updatedAt > l.updatedAt && !sameContent(b, l))) cards.push(fresh(b))
  }
  const withCard = new Set(cards.map((c) => c.id))
  for (const c of cur.cards.values()) if (c.deletedAt === null && included.has(c.id)) withCard.add(c.id)

  const logs = backup.data.reviewLogs.filter((l) => included.has(l.itemId) && !cur.logIds.has(l.id))
  res.logs = logs.length

  // Thay thế: xóa (mềm) những gì không có trong bản sao lưu.
  const removedItems: VocabItem[] = []
  const removedDecks: Deck[] = []
  const removedLinks: DeckItem[] = []
  const removedCards: CardStateRow[] = []
  if (replace) {
    const backupDecks = new Set(backup.data.decks.map((d) => d.id))
    for (const i of cur.liveItems) if (!included.has(i.id)) removedItems.push(gone(i))
    for (const d of cur.decks.values()) if (d.deletedAt === null && !backupDecks.has(d.id)) removedDecks.push(gone(d))
    for (const d of cur.deckItems) if (d.deletedAt === null && !keptLinks.has(d.id)) removedLinks.push(gone(d))
    for (const c of cur.cards.values()) if (c.deletedAt === null && !included.has(c.id)) removedCards.push(gone(c))
    res.removed = removedItems.length
  }

  // Thứ tự ghi = thứ tự gửi lên máy chủ: từ và bộ trước, rồi liên kết, lượt trả lời, lịch ôn.
  const changes: Change[] = [
    { table: 'vocabItems', rows: [...items, ...removedItems] },
    { table: 'decks', rows: [...decks, ...removedDecks] },
    { table: 'deckItems', rows: [...deckItems, ...removedLinks] },
    { table: 'reviewLogs', rows: logs },
    { table: 'cardStates', rows: [...cards, ...removedCards] },
  ]
  await commit(database, changes, now)
  res.replayed = await healCards(database, [...withCard], scheduler, now)
  return res
}
