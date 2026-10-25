import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { termKey } from '../core/vocab'
import { commit, db, notifyChange, type VocabDatabase } from '../db/db'
import type { Accent, AudioAsset, ID, PartOfSpeech } from '../db/types'
import { getAuth } from './auth'
import { getSupabase } from './supabase'
import { clearClips, clipsChanged } from './voiceClips'

/**
 * Âm thanh của người học (R7.8, R13.8): bản tự ghi âm hoặc tải lên cho từng từ, bản Wiktionary được chọn
 * hoặc bị báo đọc sai, và Giọng iPhone. Danh sách đồng bộ như dữ liệu học; file nằm trong kho "audio"
 * của Supabase (gói miễn phí 1 GB), mỗi tài khoản một thư mục riêng.
 */

export const AUDIO_BUCKET = 'audio'
/** Giới hạn mỗi file, khớp với kho trên máy chủ. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024
/** Số file tải lên/tải về mỗi lượt đồng bộ, để một lượt không kéo quá lâu. */
const TRANSFER_BATCH = 30

/** Kho file: Supabase Storage khi chạy thật, bộ nhớ khi test. */
export interface AudioStorage {
  upload(path: string, data: ArrayBuffer, mime: string): Promise<void>
  download(path: string): Promise<ArrayBuffer>
  remove(paths: string[]): Promise<void>
}

export function supabaseStorage(client: SupabaseClient): AudioStorage {
  const bucket = () => client.storage.from(AUDIO_BUCKET)
  return {
    async upload(path, data, mime) {
      const { error } = await bucket().upload(path, new Blob([data], { type: mime }), { contentType: mime, upsert: true })
      if (error) throw new Error(`audio: ${error.message}`)
    },
    async download(path) {
      const { data, error } = await bucket().download(path)
      if (error || !data) throw new Error(`audio: ${error?.message ?? 'không tải được file'}`)
      return data.arrayBuffer()
    },
    async remove(paths) {
      const { error } = await bucket().remove(paths)
      if (error) throw new Error(`audio: ${error.message}`)
    },
  }
}

/** "audio/webm;codecs=opus" → "audio/webm" (kho chỉ nhận loại file không kèm tham số). */
export function baseMime(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase() || 'audio/mp4'
}

const EXT: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/x-caf': 'caf',
  'audio/aiff': 'aiff',
}

export function audioPath(userId: string, asset: Pick<AudioAsset, 'id' | 'mime'>): string {
  return `${userId}/${asset.id}.${EXT[asset.mime ?? ''] ?? 'audio'}`
}

// ---- Chọn bản để phát ------------------------------------------------------------------------

const isOwnChoice = (a: AudioAsset) => a.deletedAt === null && a.status === 'active' && a.source !== 'tts'

/** Bản người học chọn cho từ: đúng giọng trước, không có thì giọng còn lại; bản mới nhất thắng. */
export function pickChosen(assets: readonly AudioAsset[], accent: Accent): AudioAsset | null {
  const own = assets.filter(isOwnChoice).sort((a, b) => b.updatedAt - a.updatedAt)
  return own.find((a) => a.accent === accent) ?? own[0] ?? null
}

/** Bản Wiktionary người học đã báo đọc sai (không phát nữa). */
export function flaggedUrls(assets: readonly AudioAsset[]): Set<string> {
  return new Set(assets.filter((a) => a.deletedAt === null && a.status === 'flagged' && a.remoteUrl).map((a) => a.remoteUrl!))
}

export async function wordAssets(term: string, database: VocabDatabase = db): Promise<AudioAsset[]> {
  const key = termKey(term)
  if (!key) return []
  return (await database.audioAssets.where('key').equals(key).toArray()).filter((a) => a.deletedAt === null && a.source !== 'tts')
}

/** Âm thanh của một từ trong giao diện (cập nhật khi đổi hoặc khi đồng bộ về). */
export function useWordAssets(term: string): AudioAsset[] | undefined {
  return useLiveQuery(() => wordAssets(term), [term])
}

const urls = new Map<ID, string>()
const downloading = new Map<ID, Promise<boolean>>()

async function blobUrl(id: ID): Promise<string | null> {
  const cached = urls.get(id)
  if (cached) return cached
  const blob = await db.audioBlobs.get(id)
  if (!blob) return null
  const url = URL.createObjectURL(new Blob([blob.data], { type: blob.mime }))
  urls.set(id, url)
  return url
}

async function currentStorage(): Promise<{ storage: AudioStorage; userId: string } | null> {
  const auth = getAuth()
  const client = getSupabase()
  if (auth.status !== 'signed_in' || !client) return null
  return { storage: supabaseStorage(await client), userId: auth.userId }
}

/** Tải file của bản ghi từ kho về máy (một lần cho mỗi bản). */
function fetchBlob(asset: AudioAsset): Promise<boolean> {
  const running = downloading.get(asset.id)
  if (running) return running
  const p = (async () => {
    try {
      const cloud = await currentStorage()
      if (!cloud || !asset.storagePath) return false
      const data = await cloud.storage.download(asset.storagePath)
      await db.audioBlobs.put({ id: asset.id, data, mime: asset.mime ?? 'audio/mp4' })
      return true
    } catch {
      return false
    } finally {
      downloading.delete(asset.id)
    }
  })()
  downloading.set(asset.id, p)
  return p
}

/** Đường dẫn phát được của một bản; file chưa có trên máy thì tải từ kho, chờ tối đa `waitMs`. */
export async function assetUrl(asset: AudioAsset, waitMs = 4000): Promise<string | null> {
  if (asset.source === 'dictionary') return asset.remoteUrl ?? null
  const local = await blobUrl(asset.id)
  if (local || !asset.storagePath) return local
  const ok = await Promise.race([fetchBlob(asset), new Promise<false>((r) => setTimeout(() => r(false), waitMs))])
  return ok ? blobUrl(asset.id) : null
}

/** Bản người học chọn cho từ này (đường dẫn phát được) và các bản Wiktionary bị báo sai. */
export async function learnerAudio(term: string, accent: Accent): Promise<{ url: string | null; flagged: Set<string> }> {
  const assets = await wordAssets(term)
  const chosen = pickChosen(assets, accent)
  return { url: chosen ? await assetUrl(chosen, 2500) : null, flagged: flaggedUrls(assets) }
}

// ---- Thay đổi của người học --------------------------------------------------------------------

export interface WordRef {
  term: string
  partOfSpeech: PartOfSpeech
}

/** Mỗi từ chỉ giữ một bản người học chọn cho mỗi giọng: bỏ các bản cũ. */
function retire(assets: readonly AudioAsset[], accent: Accent, now: number): AudioAsset[] {
  return assets.filter((a) => isOwnChoice(a) && a.accent === accent).map((a) => ({ ...a, deletedAt: now, updatedAt: now }))
}

async function forget(ids: ID[], database: VocabDatabase) {
  await database.audioBlobs.bulkDelete(ids)
  for (const id of ids) {
    const url = urls.get(id)
    if (url) URL.revokeObjectURL(url)
    urls.delete(id)
  }
}

function newAsset(word: WordRef, accent: Accent, fields: Pick<AudioAsset, 'source' | 'status'> & Partial<AudioAsset>, now: number): AudioAsset {
  return { id: crypto.randomUUID(), key: termKey(word.term), partOfSpeech: word.partOfSpeech, accent, createdAt: now, updatedAt: now, deletedAt: null, ...fields }
}

/** Lưu bản tự ghi âm hoặc file tải lên làm âm thanh của từ (thay bản đang chọn ở giọng này). */
export async function saveWordAudio(
  word: WordRef,
  accent: Accent,
  source: 'recording' | 'upload',
  file: { data: ArrayBuffer; mime: string },
  database: VocabDatabase = db,
  now = Date.now(),
): Promise<AudioAsset> {
  const mime = baseMime(file.mime)
  const asset = newAsset(word, accent, { source, status: 'active', mime, license: 'Của người học' }, now)
  const old = retire(await wordAssets(word.term, database), accent, now)
  await database.audioBlobs.put({ id: asset.id, data: file.data, mime })
  await commit(database, [{ table: 'audioAssets', rows: [...old, asset] }], now)
  await forget(old.map((a) => a.id), database)
  notifyChange()
  return asset
}

/** Dùng một bản Wiktionary cụ thể cho từ này ở giọng này. */
export async function chooseDictionary(word: WordRef, accent: Accent, url: string, file: string, database: VocabDatabase = db, now = Date.now()): Promise<void> {
  const assets = await wordAssets(word.term, database)
  const old = retire(assets, accent, now)
  // Đã báo sai bản này mà giờ chọn lại: bỏ báo sai.
  const unflag = assets.filter((a) => a.status === 'flagged' && a.remoteUrl === url).map((a) => ({ ...a, deletedAt: now, updatedAt: now }))
  const asset = newAsset(word, accent, { source: 'dictionary', status: 'active', remoteUrl: url, attribution: `Wikimedia Commons: ${file}` }, now)
  await commit(database, [{ table: 'audioAssets', rows: [...old, ...unflag, asset] }], now)
  await forget(old.map((a) => a.id), database)
  notifyChange()
}

/** Báo một bản Wiktionary đọc sai: không phát bản này nữa, trên mọi máy. */
export async function flagDictionary(word: WordRef, accent: Accent, url: string, file?: string, database: VocabDatabase = db, now = Date.now()): Promise<void> {
  const assets = await wordAssets(word.term, database)
  if (assets.some((a) => a.status === 'flagged' && a.remoteUrl === url)) return
  const unchoose = assets.filter((a) => isOwnChoice(a) && a.remoteUrl === url).map((a) => ({ ...a, deletedAt: now, updatedAt: now }))
  const asset = newAsset(word, accent, { source: 'dictionary', status: 'flagged', remoteUrl: url, attribution: file ? `Wikimedia Commons: ${file}` : undefined }, now)
  await commit(database, [{ table: 'audioAssets', rows: [...unchoose, asset] }], now)
  notifyChange()
}

/** Bỏ một bản người học đã lưu/chọn, hoặc bỏ báo sai; từ đó quay về nguồn mặc định. */
export async function removeAsset(asset: AudioAsset, database: VocabDatabase = db, now = Date.now()): Promise<void> {
  await commit(database, [{ table: 'audioAssets', rows: [{ ...asset, deletedAt: now, updatedAt: now }] }], now)
  await forget([asset.id], database)
  notifyChange()
}

// ---- Giọng iPhone giữa các máy -----------------------------------------------------------------

/** Khóa và thời điểm tạo của từng Giọng iPhone trên máy, đọc từ chỉ mục (không đọc dữ liệu âm thanh). */
async function clipVersions(database: VocabDatabase): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  await database.voiceClips.orderBy('createdAt').eachKey((createdAt, cursor) => {
    out.set(cursor.primaryKey as string, createdAt as number)
  })
  return out
}

interface ClipGroup {
  /** Bản đang dùng (mới nhất) và các bản trùng khóa cần bỏ. */
  winner: AudioAsset | null
  extras: AudioAsset[]
  /** Lần xóa gần nhất. */
  deletedAt: number
}

function groupClips(assets: readonly AudioAsset[]): Map<string, ClipGroup> {
  const out = new Map<string, ClipGroup>()
  for (const a of assets) {
    if (a.source !== 'tts') continue
    const g = out.get(a.key) ?? { winner: null, extras: [], deletedAt: 0 }
    if (a.deletedAt !== null) g.deletedAt = Math.max(g.deletedAt, a.deletedAt)
    else if (!g.winner) g.winner = a
    else if (a.updatedAt > g.winner.updatedAt || (a.updatedAt === g.winner.updatedAt && a.id > g.winner.id)) {
      g.extras.push(g.winner)
      g.winner = a
    } else g.extras.push(a)
    out.set(a.key, g)
  }
  return out
}

/**
 * Đưa Giọng iPhone trên máy vào danh sách đồng bộ: mỗi khóa một dòng. Bản tạo lại sau lần tải lên trước
 * thành dòng mới (dòng cũ bỏ đi, file cũ bị xóa khỏi kho): giữ dòng cũ thì đường dẫn file không đổi, dòng chỉ khác
 * thời điểm sửa và có thể bị đồng bộ coi là không đổi, máy khác không tải bản mới.
 * Bản đã xóa ở máy khác (sau khi tạo) thì bỏ qua. Hai máy cùng tạo một khóa thì giữ một dòng.
 */
export async function ensureClipAssets(database: VocabDatabase, accent: Accent, now = Date.now()): Promise<number> {
  const versions = await clipVersions(database)
  const groups = groupClips(await database.audioAssets.toArray())
  const rows: AudioAsset[] = []
  const fresh: string[] = []
  for (const g of groups.values()) rows.push(...g.extras.map((a) => ({ ...a, deletedAt: now, updatedAt: now })))
  for (const [key, createdAt] of versions) {
    const g = groups.get(key)
    if (g?.winner) {
      if (createdAt > g.winner.updatedAt && g.winner.storagePath) {
        rows.push({ ...g.winner, deletedAt: now, updatedAt: now })
        fresh.push(key)
      }
    } else if (createdAt > (g?.deletedAt ?? 0)) fresh.push(key)
  }
  for (const clip of await database.voiceClips.bulkGet(fresh)) {
    if (!clip) continue
    rows.push({
      id: crypto.randomUUID(),
      key: clip.key,
      text: clip.text,
      partOfSpeech: 'other',
      accent,
      source: 'tts',
      status: 'active',
      mime: baseMime(clip.mime),
      license: 'Giọng đọc của iPhone',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
  }
  await commit(database, [{ table: 'audioAssets', rows }], now)
  return rows.length
}

/** Tải lên kho các file chưa có trên máy chủ, và xóa file của các bản đã bỏ. Trả về số dòng đã đổi. */
export async function uploadPendingAudio(database: VocabDatabase, storage: AudioStorage, userId: string, now = Date.now(), limit = TRANSFER_BATCH): Promise<number> {
  const all = await database.audioAssets.toArray()
  const changed: AudioAsset[] = []
  const pending = all.filter((a) => a.deletedAt === null && !a.storagePath && a.source !== 'dictionary')
  for (const a of pending) {
    if (changed.length >= limit) break
    const file = a.source === 'tts' ? await database.voiceClips.get(a.key) : await database.audioBlobs.get(a.id)
    // File nằm ở máy khác (chưa tải lên): máy đó sẽ tải lên.
    if (!file) continue
    const mime = baseMime(file.mime)
    const path = audioPath(userId, { id: a.id, mime })
    await storage.upload(path, file.data, mime)
    changed.push({ ...a, mime, storagePath: path, updatedAt: now })
  }
  const trash = all.filter((a) => a.deletedAt !== null && a.storagePath)
  if (trash.length > 0) {
    await storage.remove(trash.map((a) => a.storagePath!))
    changed.push(...trash.map((a) => ({ ...a, storagePath: undefined, updatedAt: now })))
  }
  await commit(database, [{ table: 'audioAssets', rows: changed }], now)
  // Giọng iPhone vừa tải lên: đánh dấu bản trên máy là bản mới nhất, để không tải về lại.
  for (const a of changed) if (a.source === 'tts' && a.deletedAt === null) await database.voiceClips.update(a.key, { createdAt: now })
  return changed.length
}

/** Giọng iPhone từ máy khác: tải bản mới về máy này; bản đã xóa ở máy khác thì xóa ở đây. Trả về các khóa đã đổi. */
export async function materializeClips(database: VocabDatabase, storage: AudioStorage, limit = TRANSFER_BATCH): Promise<string[]> {
  const versions = await clipVersions(database)
  const removed: string[] = []
  const wanted: AudioAsset[] = []
  for (const [key, g] of groupClips(await database.audioAssets.toArray())) {
    const have = versions.get(key)
    if (g.winner) {
      if (g.winner.storagePath && (have === undefined || have < g.winner.updatedAt)) wanted.push(g.winner)
    } else if (have !== undefined && have <= g.deletedAt) removed.push(key)
  }
  await database.voiceClips.bulkDelete(removed)
  const added: string[] = []
  for (const a of wanted.slice(0, limit)) {
    const data = await storage.download(a.storagePath!)
    await database.voiceClips.put({ key: a.key, text: a.text ?? a.key, data, mime: a.mime ?? 'audio/mp4', createdAt: a.updatedAt })
    added.push(a.key)
  }
  return [...removed, ...added]
}

/**
 * Phần âm thanh của một lượt đồng bộ (sau khi đã đồng bộ dữ liệu): tải file lên, rồi tải Giọng iPhone về.
 * Trả về true nếu có dòng mới cần gửi lên máy chủ.
 */
export async function syncAudio(client: SupabaseClient, userId: string, accent: Accent): Promise<boolean> {
  const storage = supabaseStorage(client)
  const added = await ensureClipAssets(db, accent)
  const uploaded = await uploadPendingAudio(db, storage, userId)
  const changed = await materializeClips(db, storage)
  if (changed.length > 0) await clipsChanged(changed)
  return added + uploaded > 0
}

/** Xóa mọi Giọng iPhone trên máy này và, khi đồng bộ, trên các máy khác. */
export async function retireClipAssets(database: VocabDatabase, now = Date.now()): Promise<number> {
  const live = (await database.audioAssets.toArray()).filter((a) => a.source === 'tts' && a.deletedAt === null)
  await commit(database, [{ table: 'audioAssets', rows: live.map((a) => ({ ...a, deletedAt: now, updatedAt: now })) }], now)
  await database.voiceClips.clear()
  return live.length
}

/** Nút "Xóa giọng iPhone": xóa trên máy này và các máy cùng tài khoản. */
export async function clearAllClips(): Promise<void> {
  const retired = await retireClipAssets(db)
  await clearClips()
  if (retired > 0) notifyChange()
}
