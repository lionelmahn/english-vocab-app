import Dexie, { type EntityTable } from 'dexie'
import type {
  AudioCacheEntry,
  CardStateRow,
  Deck,
  DeckItem,
  DictionaryCacheEntry,
  MetaEntry,
  OutboxEntry,
  Profile,
  ReviewLogRow,
  StudySessionRow,
  SyncBaseEntry,
  SyncedTableName,
  VocabItem,
  VoiceClip,
} from './types'

/**
 * Cơ sở dữ liệu trên thiết bị (IndexedDB qua Dexie).
 * Mọi thao tác ghi đi vào đây trước, rồi được đồng bộ lên Supabase khi có mạng.
 */
export class VocabDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  vocabItems!: EntityTable<VocabItem, 'id'>
  decks!: EntityTable<Deck, 'id'>
  deckItems!: EntityTable<DeckItem, 'id'>
  cardStates!: EntityTable<CardStateRow, 'id'>
  reviewLogs!: EntityTable<ReviewLogRow, 'id'>
  studySessions!: EntityTable<StudySessionRow, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  meta!: EntityTable<MetaEntry, 'key'>
  audioCache!: EntityTable<AudioCacheEntry, 'key'>
  voiceClips!: EntityTable<VoiceClip, 'key'>
  syncBase!: EntityTable<SyncBaseEntry, 'key'>
  dictionary!: EntityTable<DictionaryCacheEntry, 'key'>

  constructor(name = 'english-vocab') {
    super(name)
    this.version(1).stores({
      profiles: 'id, updatedAt',
      vocabItems: 'id, termKey, updatedAt, *tags',
      decks: 'id, updatedAt',
      deckItems: 'id, deckId, itemId, [deckId+itemId], updatedAt',
      cardStates: 'id, due, state, updatedAt',
      reviewLogs: 'id, itemId, sessionId, reviewedAt',
      studySessions: 'id, status, startedAt',
      outbox: '++seq, [table+rowId]',
      meta: 'key',
    })
    // Phiên bản 2: bộ nhớ đệm bản ghi phát âm (giọng người thật) theo từ.
    this.version(2).stores({ audioCache: 'key' })
    this.version(3).stores({ voiceClips: 'key' })
    // Phiên bản 4: bản đã đồng bộ của từng dòng, làm gốc khi gộp thay đổi từ nhiều thiết bị (R11.7).
    this.version(4).stores({ syncBase: 'key' })
    // Phiên bản 5: kết quả tra từ điển (R15).
    this.version(5).stores({ dictionary: 'key' })
  }
}

export const db = new VocabDatabase()

interface TableRows {
  profiles: Profile
  vocabItems: VocabItem
  decks: Deck
  deckItems: DeckItem
  cardStates: CardStateRow
  reviewLogs: ReviewLogRow
}

/** Một nhóm dòng cùng bảng cần ghi; kiểu dòng khớp với bảng. */
export type Change = { [K in SyncedTableName]: { table: K; rows: TableRows[K][] } }[SyncedTableName]

/**
 * Ghi nhiều bảng và xếp các dòng vào hàng đợi đồng bộ trong cùng một giao dịch,
 * để không có thay đổi nào bị bỏ sót khi gửi lên máy chủ.
 */
export async function commit(database: VocabDatabase, changes: Change[], now = Date.now()): Promise<void> {
  const live = changes.filter((c) => c.rows.length > 0)
  if (live.length === 0) return
  const tables = [...new Set(live.map((c) => c.table))].map((t) => database.table(t))
  await database.transaction('rw', [...tables, database.outbox], async () => {
    for (const c of live) {
      await database.table(c.table).bulkPut(c.rows)
      await database.outbox.bulkAdd(c.rows.map((r) => ({ table: c.table, rowId: r.id, at: now })))
    }
  })
}

/** Ghi một bảng kèm hàng đợi đồng bộ. */
export async function writeWithOutbox<K extends SyncedTableName>(
  database: VocabDatabase,
  table: K,
  rows: TableRows[K][],
  now = Date.now(),
): Promise<void> {
  await commit(database, [{ table, rows } as Change], now)
}

/** Sau khi gửi lên máy chủ, `notifyChange` báo cho bộ đồng bộ biết có thay đổi mới. */
let changeListener: (() => void) | null = null
export function onLocalChange(listener: () => void): () => void {
  changeListener = listener
  return () => {
    if (changeListener === listener) changeListener = null
  }
}
export function notifyChange(): void {
  changeListener?.()
}
