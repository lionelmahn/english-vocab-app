import { matchingAudioFiles, pickAudioFiles, type AccentTag, type AudioFileMatch } from '../core/wordAudio'
import { termKey } from '../core/vocab'
import { db } from '../db/db'
import type { WordAudio } from '../db/types'

/**
 * Bản ghi phát âm giọng người thật từ Wiktionary / Wikimedia Commons (giấy phép mở CC BY-SA, CC BY hoặc PD).
 * Mỗi từ chỉ tra một lần rồi lưu trên máy; từ không có bản ghi thì dùng giọng đọc của thiết bị.
 */

const WIKTIONARY = 'https://en.wiktionary.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'
/** Không có bản ghi: thử tra lại sau 14 ngày (Wiktionary được bổ sung dần). */
const RETRY_MISSING_MS = 14 * 86_400_000

const memory = new Map<string, WordAudio | null>()
const inflight = new Map<string, Promise<WordAudio | null>>()

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

function canPlay(type: string): boolean {
  try {
    return typeof document !== 'undefined' && document.createElement('audio').canPlayType(type) !== ''
  } catch {
    return false
  }
}

interface CommonsFile {
  title: string
  videoinfo?: { url?: string; derivatives?: { type?: string; src?: string }[] }[]
}

/** Các file trên trang Wiktionary của từ. */
async function pageFiles(term: string): Promise<string[]> {
  const pageTitle = term.trim().toLowerCase()
  const imgs = (await getJson(`${WIKTIONARY}?action=query&titles=${encodeURIComponent(pageTitle)}&prop=images&imlimit=100&format=json&formatversion=2&origin=*`, 6000)) as {
    query?: { pages?: { images?: { title: string }[] }[] }
  }
  return imgs.query?.pages?.[0]?.images?.map((i) => i.title) ?? []
}

/** Đường dẫn phát được của từng file trên Commons: bản MP3 nếu có (iPhone không phát .ogg). */
async function playableUrls(files: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (files.length === 0) return out
  const info = (await getJson(
    `${COMMONS}?action=query&titles=${encodeURIComponent(files.map((f) => `File:${f}`).join('|'))}&prop=videoinfo&viprop=url|derivatives&format=json&formatversion=2&origin=*`,
    6000,
  )) as { query?: { pages?: CommonsFile[]; normalized?: { from: string; to: string }[] } }
  const pages = info.query?.pages ?? []
  const normalized = new Map((info.query?.normalized ?? []).map((n) => [n.from, n.to]))
  const oggOk = canPlay('audio/ogg; codecs="vorbis"')
  for (const file of files) {
    const title = normalized.get(`File:${file}`) ?? `File:${file}`
    const vi = pages.find((p) => p.title === title)?.videoinfo?.[0]
    if (!vi) continue
    const mp3 = vi.derivatives?.find((d) => d.type?.startsWith('audio/mpeg'))?.src
    const original = vi.url?.split('?')[0]
    const originalOk = original && (/\.(mp3|wav)$/i.test(original) || (oggOk && /\.(ogg|oga)$/i.test(original)))
    const url = mp3 ?? (originalOk ? original : undefined)
    if (url) out.set(file, url)
  }
  return out
}

/** Tra Wiktionary → mỗi giọng một file → đường dẫn phát được. */
async function lookup(term: string): Promise<WordAudio | null> {
  const entries = Object.entries(pickAudioFiles(term, await pageFiles(term))) as [AccentTag, string][]
  const urls = await playableUrls(entries.map(([, f]) => f))
  const out: WordAudio = {}
  for (const [accent, file] of entries) {
    const url = urls.get(file)
    if (url) out[accent] = url
  }
  return Object.keys(out).length > 0 ? out : null
}

export interface WiktionaryRecording {
  file: string
  accent: AccentTag
  url: string
  pos?: AudioFileMatch['pos']
}

/** Mọi bản ghi tiếng Anh của từ trên Wiktionary, để người học nghe và chọn bản khác (R7.8). */
export async function listWordRecordings(term: string): Promise<WiktionaryRecording[]> {
  const files = matchingAudioFiles(term, await pageFiles(term)).slice(0, 20)
  const urls = await playableUrls(files.map((f) => f.name))
  return files.flatMap((f) => {
    const url = urls.get(f.name)
    return url ? [{ file: f.name, accent: f.accent, url, pos: f.pos }] : []
  })
}

/** Bản ghi của một từ (từ bộ nhớ, rồi từ máy, rồi tra mạng). Lỗi mạng thì trả null và thử lại lần sau. */
export async function resolveWordAudio(term: string): Promise<WordAudio | null> {
  const key = termKey(term)
  if (!key) return null
  if (memory.has(key)) return memory.get(key)!
  const pending = inflight.get(key)
  if (pending) return pending
  const p = (async () => {
    try {
      const cached = await db.audioCache.get(key)
      if (cached && (cached.audio || Date.now() - cached.fetchedAt < RETRY_MISSING_MS)) {
        memory.set(key, cached.audio)
        return cached.audio
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
      const audio = await lookup(term)
      memory.set(key, audio)
      await db.audioCache.put({ key, audio, fetchedAt: Date.now() })
      return audio
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

/** Bản ghi đã có sẵn trong bộ nhớ (không chờ mạng); `undefined` = chưa tra. */
export function cachedWordAudio(term: string): WordAudio | null | undefined {
  const key = termKey(term)
  return memory.has(key) ? memory.get(key) : undefined
}

/** Số trang Wiktionary và số file Commons mỗi lần gọi khi tra nhiều từ. */
const PAGE_BATCH = 20
const FILE_BATCH = 50

/** Các file trên trang Wiktionary của nhiều từ một lượt (tiêu đề trang là từ viết thường). */
async function pagesFiles(titles: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(titles.map((t) => [t, []]))
  let cont = ''
  for (let round = 0; round < 10; round++) {
    const json = (await getJson(`${WIKTIONARY}?action=query&titles=${encodeURIComponent(titles.join('|'))}&prop=images&imlimit=max&format=json&formatversion=2&origin=*${cont}`, 10000)) as {
      continue?: Record<string, string>
      query?: { normalized?: { from: string; to: string }[]; pages?: { title: string; images?: { title: string }[] }[] }
    }
    const back = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]))
    for (const p of json.query?.pages ?? []) {
      const list = out.get(back.get(p.title) ?? p.title)
      list?.push(...(p.images ?? []).map((i) => i.title))
    }
    if (!json.continue) break
    cont = Object.entries(json.continue)
      .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
      .join('')
  }
  return out
}

/**
 * Tra bản ghi cho nhiều từ (tải âm thanh để dùng ngoại tuyến): gộp 20 trang Wiktionary và 50 file Commons mỗi
 * lần gọi, thay vì hai lần gọi cho mỗi từ. Từ đã tra rồi thì bỏ qua. Kết quả lưu trên máy như khi tra từng từ.
 */
export async function resolveManyWordAudio(terms: readonly string[], signal?: AbortSignal): Promise<void> {
  const byTitle = new Map<string, string>()
  for (const term of terms) {
    const key = termKey(term)
    if (!key || memory.has(key) || byTitle.has(term.trim().toLowerCase())) continue
    const cached = await db.audioCache.get(key)
    if (cached && (cached.audio || Date.now() - cached.fetchedAt < RETRY_MISSING_MS)) {
      memory.set(key, cached.audio)
      continue
    }
    byTitle.set(term.trim().toLowerCase(), term)
  }
  const titles = [...byTitle.keys()]
  for (let i = 0; i < titles.length; i += PAGE_BATCH) {
    if (signal?.aborted) return
    const batch = titles.slice(i, i + PAGE_BATCH)
    const files = await pagesFiles(batch)
    const picked = new Map(batch.map((t) => [t, Object.entries(pickAudioFiles(byTitle.get(t)!, files.get(t) ?? [])) as [AccentTag, string][]]))
    const all = [...new Set([...picked.values()].flatMap((e) => e.map(([, f]) => f)))]
    const urls = new Map<string, string>()
    for (let j = 0; j < all.length; j += FILE_BATCH) for (const [f, u] of await playableUrls(all.slice(j, j + FILE_BATCH))) urls.set(f, u)
    const rows = batch.map((t) => {
      const audio: WordAudio = {}
      for (const [accent, file] of picked.get(t)!) if (urls.has(file)) audio[accent] = urls.get(file)
      const key = termKey(byTitle.get(t)!)
      const value = Object.keys(audio).length > 0 ? audio : null
      memory.set(key, value)
      return { key, audio: value, fetchedAt: Date.now() }
    })
    await db.audioCache.bulkPut(rows)
  }
}

/** Tra trước bản ghi cho các từ sắp học, để bấm loa là phát ngay. */
export async function prefetchWordAudio(terms: readonly string[]): Promise<void> {
  const queue = [...new Set(terms)]
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) await resolveWordAudio(t)
  }
  await Promise.all([worker(), worker()])
}
