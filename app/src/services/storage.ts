import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { db } from '../db/db'

/**
 * Dung lượng dữ liệu trên máy và trạng thái mạng (R11.6, R11.8).
 */

export interface StorageCounts {
  words: number
  offlineFiles: number
  offlineBytes: number
  voiceClips: number
  ownAudio: number
  dictionary: number
}

/** Số mục theo từng loại dữ liệu trên máy, tự cập nhật. Dung lượng file âm thanh tải về cộng từ chỉ mục, không đọc file. */
export function useStorageCounts(): StorageCounts | undefined {
  return useLiveQuery(async () => {
    const [words, sizes, voiceClips, ownAudio, dictionary] = await Promise.all([
      db.vocabItems.filter((i) => i.deletedAt === null).count(),
      db.offlineAudio.orderBy('size').keys(),
      db.voiceClips.count(),
      db.audioBlobs.count(),
      db.dictionary.count(),
    ])
    return { words, offlineFiles: sizes.length, offlineBytes: (sizes as number[]).reduce((a, b) => a + b, 0), voiceClips, ownAudio, dictionary }
  }, [])
}

export interface StorageEstimate {
  /** Dung lượng app đang dùng và giới hạn trình duyệt cho phép (byte); null nếu trình duyệt không cho biết. */
  usage: number | null
  quota: number | null
  /** Dữ liệu được giữ lâu dài (trình duyệt không tự xóa khi máy đầy); null nếu không hỗ trợ. */
  persisted: boolean | null
}

async function readEstimate(): Promise<StorageEstimate> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  const est = await storage?.estimate?.().catch(() => undefined)
  const persisted = storage?.persisted ? await storage.persisted().catch(() => null) : null
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted }
}

/** Ước tính dung lượng của trình duyệt; đọc lại khi `version` đổi (sau khi tải/xóa). */
export function useStorageEstimate(version: unknown): StorageEstimate | null {
  const [est, setEst] = useState<StorageEstimate | null>(null)
  useEffect(() => {
    let cancelled = false
    readEstimate().then((e) => !cancelled && setEst(e))
    return () => {
      cancelled = true
    }
  }, [version])
  return est
}

/** Xin trình duyệt giữ dữ liệu lâu dài. Trả về kết quả (trình duyệt có thể từ chối mà không hỏi). */
export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function clearDictionaryCache(): Promise<void> {
  await db.dictionary.clear()
}

/** 1536 → "1,5 KB"; 25_000_000 → "23,8 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let n = bytes / 1024
  let u = 0
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024
    u++
  }
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${units[u]}`
}

// ---- Có mạng hay không ------------------------------------------------------------------------

function subscribeOnline(l: () => void) {
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false)
}
