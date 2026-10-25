import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { planWordAudio, summarize, type OfflineSummary, type WordAudioPlan } from '../core/offlineAudio'
import { clipKey } from '../core/voiceClips'
import { termKey } from '../core/vocab'
import { db } from '../db/db'
import type { AudioAsset } from '../db/types'
import { resolveManyWordAudio } from './audio'
import { fetchBlob, flaggedUrls, pickChosen } from './audioStore'

/**
 * Âm thanh dùng khi không có mạng (R11.6, R11.8): tải file bản ghi Wiktionary về máy theo bộ từ, phát từ máy khi có,
 * xóa khi không cần. Bản người học ghi âm, Giọng iPhone và giọng máy vốn đã nằm trên máy.
 */

type Accent = 'us' | 'uk'

/** Các file đã tải (chỉ đường dẫn), nạp một lần để kiểm tra nhanh khi phát. */
let savedUrls: Set<string> | null = null
const objectUrls = new Map<string, string>()

async function saved(): Promise<Set<string>> {
  savedUrls ??= new Set((await db.offlineAudio.toCollection().primaryKeys()) as string[])
  return savedUrls
}

/** Bản trên máy của một file bản ghi (để phát khi không có mạng); null nếu chưa tải. */
export async function offlineAudioUrl(url: string): Promise<string | null> {
  if (!/^https?:/.test(url) || !(await saved()).has(url)) return null
  const ready = objectUrls.get(url)
  if (ready) return ready
  const file = await db.offlineAudio.get(url)
  if (!file) return null
  const objectUrl = URL.createObjectURL(new Blob([file.data], { type: file.mime }))
  objectUrls.set(url, objectUrl)
  return objectUrl
}

interface Word {
  term: string
}

/** Kế hoạch âm thanh ngoại tuyến cho từng từ, đọc trạng thái hiện tại trên máy. */
async function planWords(words: readonly Word[], accent: Accent, preferRecordings: boolean): Promise<WordAudioPlan[]> {
  const keys = words.map((w) => termKey(w.term))
  const [assets, clips, blobs, cached, fileKeys] = await Promise.all([
    db.audioAssets.where('key').anyOf(keys).toArray(),
    db.voiceClips.toCollection().primaryKeys(),
    db.audioBlobs.toCollection().primaryKeys(),
    db.audioCache.bulkGet(keys),
    // Đọc thẳng bảng (không dùng bản nạp sẵn) để trang tình trạng tự cập nhật khi tải/xóa.
    db.offlineAudio.toCollection().primaryKeys(),
  ])
  const files = (savedUrls = new Set(fileKeys as string[]))
  const byKey = new Map<string, AudioAsset[]>()
  for (const a of assets) if (a.deletedAt === null && a.source !== 'tts') byKey.set(a.key, [...(byKey.get(a.key) ?? []), a])
  const clipSet = new Set(clips as string[])
  const blobSet = new Set(blobs as string[])
  return words.map((w, i) => {
    const mine = byKey.get(keys[i]) ?? []
    const own = pickChosen(mine, accent)
    return planWordAudio({
      term: w.term,
      accent,
      own,
      ownLocal: !!own && blobSet.has(own.id),
      flagged: flaggedUrls(mine),
      hasClip: clipSet.has(clipKey(w.term)),
      recordings: cached[i] ? cached[i]!.audio : undefined,
      preferRecordings,
      saved: files,
    })
  })
}

/** Tình trạng âm thanh ngoại tuyến của một nhóm từ, tự cập nhật. */
export function useOfflineSummary(words: readonly Word[] | undefined, accent: Accent, preferRecordings: boolean): OfflineSummary | undefined {
  const terms = words?.map((w) => w.term).join('\n')
  return useLiveQuery(
    async () => (words ? summarize(await planWords(words, accent, preferRecordings)) : undefined),
    // Đọc lại khi danh sách từ, giọng hoặc các bảng liên quan đổi (useLiveQuery tự theo dõi bảng).
    [terms, accent, preferRecordings],
  )
}

export interface DownloadProgress {
  /** looking: đang tra bản ghi; downloading: đang tải file. */
  phase: 'looking' | 'downloading'
  done: number
  total: number
  failed: number
}

const PARALLEL = 3

/**
 * Tải âm thanh cho một nhóm từ: tra bản ghi Wiktionary còn thiếu, rồi tải file bản ghi (và bản ghi âm của người học
 * nằm trên kho máy chủ) về máy. Dừng được giữa chừng; file đã tải vẫn giữ. Trả về số file tải được và số lỗi.
 */
export async function downloadAudio(words: readonly Word[], accent: Accent, preferRecordings: boolean, onProgress: (p: DownloadProgress) => void, signal: AbortSignal): Promise<{ saved: number; failed: number }> {
  onProgress({ phase: 'looking', done: 0, total: words.length, failed: 0 })
  if (preferRecordings) await resolveManyWordAudio(words.map((w) => w.term), signal)
  const plans = await planWords(words, accent, preferRecordings)
  const tasks = plans.filter((p) => p.state === 'missing')
  const urlTasks = [...new Set(tasks.flatMap((p) => (p.url ? [p.url] : [])))]
  const ownIds = tasks.flatMap((p) => (p.ownId ? [p.ownId] : []))
  const total = urlTasks.length + ownIds.length
  let done = 0
  let failed = 0
  let savedCount = 0
  const report = () => onProgress({ phase: 'downloading', done, total, failed })
  report()
  const files = await saved()
  const queue: (() => Promise<boolean>)[] = [
    ...urlTasks.map((url) => async () => {
      const res = await fetch(url, { signal })
      if (!res.ok) return false
      const data = await res.arrayBuffer()
      await db.offlineAudio.put({ url, data, mime: res.headers.get('content-type')?.split(';')[0] || 'audio/mpeg', size: data.byteLength, savedAt: Date.now() })
      files.add(url)
      return true
    }),
    ...ownIds.map((id) => async () => {
      const asset = await db.audioAssets.get(id)
      return !!asset && (await fetchBlob(asset))
    }),
  ]
  const worker = async () => {
    for (let task = queue.shift(); task && !signal.aborted; task = queue.shift()) {
      try {
        if (await task()) savedCount++
        else failed++
      } catch {
        if (signal.aborted) return
        failed++
      }
      done++
      report()
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  return { saved: savedCount, failed }
}

// ---- Lượt tải đang chạy (giữ khi rời trang, để quay lại vẫn thấy tiến độ) -----------------------

export interface DownloadJob {
  /** Nhóm từ đang tải (mã bộ từ, hoặc 'all' cho mọi từ). */
  id: string
  progress: DownloadProgress
  /** Kết quả khi xong. */
  result?: { saved: number; failed: number; stopped: boolean }
}

let job: DownloadJob | null = null
let controller: AbortController | null = null
const listeners = new Set<() => void>()

function setJob(next: DownloadJob | null) {
  job = next
  listeners.forEach((l) => l())
}

export function useDownloadJob(): DownloadJob | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => job,
  )
}

/** Bắt đầu tải âm thanh cho một nhóm từ; mỗi lúc chỉ một lượt. */
export function startDownload(id: string, words: readonly Word[], accent: Accent, preferRecordings: boolean): void {
  if (job && !job.result) return
  controller = new AbortController()
  const signal = controller.signal
  setJob({ id, progress: { phase: 'looking', done: 0, total: words.length, failed: 0 } })
  downloadAudio(words, accent, preferRecordings, (progress) => setJob({ id, progress }), signal)
    .then((r) => setJob({ id, progress: job?.progress ?? { phase: 'downloading', done: 0, total: 0, failed: 0 }, result: { ...r, stopped: signal.aborted } }))
    .catch(() => setJob({ id, progress: job?.progress ?? { phase: 'looking', done: 0, total: 0, failed: 0 }, result: { saved: 0, failed: 1, stopped: signal.aborted } }))
}

export function stopDownload(): void {
  controller?.abort()
}

export function clearDownloadResult(): void {
  if (job?.result) setJob(null)
}

/** Xóa mọi file bản ghi đã tải về máy. */
export async function removeAllAudio(): Promise<void> {
  await db.offlineAudio.clear()
  for (const u of objectUrls.values()) URL.revokeObjectURL(u)
  objectUrls.clear()
  savedUrls = new Set()
}

/** Xóa file bản ghi đã tải của một nhóm từ (không đụng tới bản người học ghi âm hay Giọng iPhone). */
export async function removeAudio(words: readonly Word[]): Promise<number> {
  const keys = words.map((w) => termKey(w.term))
  const [cached, assets] = await Promise.all([db.audioCache.bulkGet(keys), db.audioAssets.where('key').anyOf(keys).toArray()])
  const urls = new Set<string>()
  for (const c of cached) for (const u of Object.values(c?.audio ?? {})) if (u) urls.add(u)
  for (const a of assets) if (a.source === 'dictionary' && a.remoteUrl) urls.add(a.remoteUrl)
  const files = await saved()
  const gone = [...urls].filter((u) => files.has(u))
  await db.offlineAudio.bulkDelete(gone)
  for (const u of gone) {
    files.delete(u)
    const objectUrl = objectUrls.get(u)
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrls.delete(u)
  }
  return gone.length
}
