import { useSyncExternalStore } from 'react'
import { clipKey, parsePasted, pasteFingerprint, requestText, type PasteResult } from '../core/voiceClips'
import { db } from '../db/db'
import { getSettings } from '../lib/settings'
import { APP_VERSION } from '../lib/version'

/**
 * Kho âm thanh "Giọng iPhone" (tạo bằng app Phím tắt) trên máy này.
 * Danh sách khóa nạp một lần vào bộ nhớ; file chỉ đọc ra khi cần phát.
 */

let keys: Set<string> | null = null
let loading: Promise<Set<string>> | null = null
let version = 0
const urls = new Map<string, string>()
const listeners = new Set<() => void>()

const EMPTY: ReadonlySet<string> = new Set()
/** Bản chụp danh sách khóa cho giao diện: mỗi lần đổi là một Set mới để React nhận ra. */
let snapshot: ReadonlySet<string> = EMPTY

function emit() {
  version++
  snapshot = keys ? new Set(keys) : EMPTY
  listeners.forEach((l) => l())
}

function loadKeys(): Promise<Set<string>> {
  if (keys) return Promise.resolve(keys)
  loading ??= db.voiceClips
    .toCollection()
    .primaryKeys()
    .then((k) => {
      keys = new Set(k as string[])
      emit()
      return keys
    })
    .catch(() => (keys = new Set()))
  return loading
}

if (typeof indexedDB !== 'undefined') void loadKeys()

/** Đường dẫn phát âm thanh giọng iPhone của văn bản này; null nếu chưa có hoặc đang tắt. */
export async function clipUrl(text: string): Promise<string | null> {
  if (!getSettings().useVoiceClips) return null
  const key = clipKey(text)
  if (!(await loadKeys()).has(key)) return null
  const cached = urls.get(key)
  if (cached) return cached
  const row = await db.voiceClips.get(key)
  if (!row) return null
  const url = URL.createObjectURL(new Blob([row.data], { type: row.mime }))
  urls.set(key, url)
  return url
}

export async function clipCount(): Promise<number> {
  return (await loadKeys()).size
}

export async function clearClips(): Promise<void> {
  await db.voiceClips.clear()
  urls.forEach((u) => URL.revokeObjectURL(u))
  urls.clear()
  keys = new Set()
  emit()
}

// ---- Lượt đang chờ dán ------------------------------------------------------------------------

const PENDING_KEY = 'voice-clips-pending'
const LAST_PASTE_KEY = 'voice-clips-last-paste'

export interface PendingBatch {
  texts: string[]
  at: number
}

/** Lượt đã gửi sang Phím tắt, chờ dán kết quả (lưu lại vì iPhone có thể tải lại app khi chuyển qua lại). */
export function getPending(): PendingBatch | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingBatch) : null
  } catch {
    return null
  }
}

export function setPending(texts: string[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ texts, at: Date.now() } satisfies PendingBatch))
  } catch {
    // Không lưu được thì vẫn dán được trong lúc app còn mở.
  }
  memoryPending = { texts, at: Date.now() }
  emit()
}

let memoryPending: PendingBatch | null = null

function currentPending(): PendingBatch | null {
  return getPending() ?? memoryPending
}

function clearPending() {
  memoryPending = null
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // bỏ qua
  }
  emit()
}

export type SaveResult = { ok: true; saved: number } | { ok: false; message: string }

const FIX_INPUT =
  'Trong phím tắt, ở bước “Tách”, bấm ô “Đầu vào phím tắt” → chọn “Bảng nhớ tạm” (app đã chép sẵn danh sách vào đó), rồi bấm “Tạo” lại.'

function explain(r: Exclude<PasteResult, { ok: true }>, expected: number, clipboardTypes: string[] = []): string {
  if (r.reason === 'empty') {
    if (clipboardTypes.length > 0) return `Bộ nhớ tạm có dữ liệu (${clipboardTypes.join(', ')}) nhưng không đọc được dạng chữ. Thử “Dán thủ công”.`
    return `Bộ nhớ tạm đang trống: phím tắt đã chạy nhưng không tạo được âm thanh nào, thường do không nhận được danh sách từ. ${FIX_INPUT}`
  }
  if (r.reason === 'unchanged')
    return `Bộ nhớ tạm vẫn là danh sách từ app vừa chép: phím tắt chưa chạy xong, hoặc chưa có bước “Sao chép vào bảng nhớ tạm”. Mở app Phím tắt xem phím tắt đã chạy xong chưa.`
  if (r.reason === 'text')
    return `Phím tắt đang mã hóa chữ (“${r.sample}”) thay vì âm thanh. Trong phím tắt, bấm ô sau chữ “Mã hóa” → Chọn biến → chạm vào khối “Tạo âm thanh đọc từ”, rồi bấm “Tạo” lại.`
  if (r.reason === 'count' && r.got === 1 && expected > 1)
    return `Phím tắt chỉ tạo 1 âm thanh trong khi app gửi ${expected} mục, tức là phím tắt chưa nhận được danh sách từ. Kiểm tra app đã lên bản ${APP_VERSION} trở lên (ghi ở cuối trang này), và bước “Tách” trong phím tắt lấy “Bảng nhớ tạm”. Rồi bấm “Tạo” lại.`
  if (r.reason === 'count')
    return `Nhận được ${r.got} âm thanh nhưng đã gửi ${expected} mục. Kiểm tra bước “Kết hợp” dùng dấu “|”, rồi bấm “Tạo” lại.`
  return 'Bộ nhớ tạm không chứa âm thanh từ phím tắt. Chạy phím tắt xong rồi hãy dán.'
}

/** Lưu nội dung dán vào cho lượt đang chờ. */
export async function saveFromPaste(raw: string, clipboardTypes: string[] = []): Promise<SaveResult> {
  const pending = currentPending()
  if (!pending) return { ok: false, message: 'Chưa có lượt nào đang chờ. Bấm “Tạo” trước.' }
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_PASTE_KEY)
  } catch {
    last = null
  }
  const fp = pasteFingerprint(raw)
  if (last && last === fp) return { ok: false, message: 'Đây vẫn là âm thanh của lần trước. Chạy phím tắt cho lượt mới rồi dán lại.' }

  const r = parsePasted(raw, pending.texts.length, requestText(pending.texts))
  if (!r.ok) return { ok: false, message: explain(r, pending.texts.length, clipboardTypes) }

  const now = Date.now()
  const rows = pending.texts.map((text, i) => {
    const { bytes, mime } = r.clips[i]
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return { key: clipKey(text), text, data, mime, createdAt: now }
  })
  await db.voiceClips.bulkPut(rows)
  for (const row of rows) {
    const old = urls.get(row.key)
    if (old) URL.revokeObjectURL(old)
    urls.delete(row.key)
  }
  const set = await loadKeys()
  rows.forEach((row) => set.add(row.key))
  emit()
  try {
    localStorage.setItem(LAST_PASTE_KEY, fp)
  } catch {
    // bỏ qua
  }
  clearPending()
  // Xin trình duyệt giữ dữ liệu lâu dài để không bị xóa khi máy thiếu dung lượng.
  void navigator.storage?.persist?.().catch(() => undefined)
  return { ok: true, saved: rows.length }
}

/** Đọc bảng tạm (iPhone sẽ hiện nút "Dán" để người học xác nhận) rồi lưu. */
export async function pasteFromClipboard(): Promise<SaveResult> {
  let raw = ''
  let types: string[] = []
  try {
    raw = await navigator.clipboard.readText()
  } catch {
    return { ok: false, message: 'Không đọc được bộ nhớ tạm. Bấm “Dán” khi iPhone hỏi, hoặc dùng “Dán thủ công” bên dưới.' }
  }
  // Đọc dạng chữ ra rỗng: thử đọc từng loại dữ liệu trong bộ nhớ tạm.
  if (!raw.trim() && navigator.clipboard.read) {
    try {
      const items = await navigator.clipboard.read()
      types = [...new Set(items.flatMap((i) => [...i.types]))]
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('text/'))
        if (!type) continue
        raw = await (await item.getType(type)).text()
        if (type === 'text/html') raw = new DOMParser().parseFromString(raw, 'text/html').body.textContent ?? ''
        if (raw.trim()) break
      }
    } catch {
      // bỏ qua, báo theo nội dung đã đọc được
    }
  }
  return saveFromPaste(raw, types)
}

/**
 * Chép danh sách cần đọc vào bộ nhớ tạm (phím tắt đọc ở đây nếu không nhận được qua đường dẫn).
 * Trả về false nếu trình duyệt không cho chép.
 */
export async function copyRequest(texts: readonly string[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(requestText(texts))
    return true
  } catch {
    return false
  }
}

export function cancelPending(): void {
  clearPending()
}

// ---- Theo dõi trong giao diện ------------------------------------------------------------------

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Các khóa đã có giọng iPhone (đổi mỗi khi lưu/xóa). */
export function useClipKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function usePending(): PendingBatch | null {
  useSyncExternalStore(subscribe, () => version)
  return currentPending()
}
