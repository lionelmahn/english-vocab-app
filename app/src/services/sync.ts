import type { SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db, onLocalChange, type VocabDatabase } from '../db/db'
import { getAuth, subscribeAuth } from './auth'
import { getSupabase } from './supabase'
import { PUSH_ORDER, REMOTE_TABLE, toRemote } from './syncMapping'

/**
 * Sao lưu dữ liệu học lên Supabase (R11.1): gửi các thay đổi trong hàng đợi khi đã đăng nhập.
 * Kéo dữ liệu từ máy chủ về và xử lý xung đột nhiều thiết bị là giai đoạn 2 (R11.5, R11.7).
 */

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'
  lastSyncedAt: number | null
  error: string | null
}

let status: SyncStatus = { state: 'off', lastSyncedAt: null, error: null }
const listeners = new Set<() => void>()
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}

const BATCH = 400

/** Gửi một lượt hàng đợi. Trả về số dòng đã gửi. Lỗi thì giữ nguyên hàng đợi để thử lại. */
export async function pushOutbox(database: VocabDatabase, client: SupabaseClient, batch = BATCH): Promise<number> {
  const entries = await database.outbox.orderBy('seq').limit(batch).toArray()
  if (entries.length === 0) return 0
  const maxSeq = entries[entries.length - 1].seq!
  const byTable = new Map<string, Set<string>>()
  for (const e of entries) {
    let set = byTable.get(e.table)
    if (!set) byTable.set(e.table, (set = new Set()))
    set.add(e.rowId)
  }
  let pushed = 0
  for (const table of PUSH_ORDER) {
    const ids = byTable.get(table)
    if (!ids || ids.size === 0) continue
    const rows = (await database.table(table).bulkGet([...ids])).filter(Boolean)
    if (rows.length === 0) continue
    const data = rows.map((r) => toRemote(table, r))
    const query = client.from(REMOTE_TABLE[table])
    const { error } =
      table === 'reviewLogs'
        ? await query.upsert(data, { onConflict: 'id', ignoreDuplicates: true }) // chỉ thêm, gửi lại không nhân đôi
        : await query.upsert(data, { onConflict: 'id' })
    if (error) throw new Error(`${REMOTE_TABLE[table]}: ${error.message}`)
    pushed += data.length
  }
  await database.outbox.where('seq').belowOrEqual(maxSeq).delete()
  return pushed
}

let running = false
let again = false
let timer: ReturnType<typeof setTimeout> | undefined

export async function syncNow(): Promise<void> {
  const auth = getAuth()
  if (auth.status !== 'signed_in') {
    setStatus({ state: 'off' })
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus({ state: 'offline' })
    return
  }
  const client = getSupabase()
  if (!client) return
  if (running) {
    again = true
    return
  }
  running = true
  setStatus({ state: 'syncing', error: null })
  try {
    const sb = await client
    // Gửi nhiều lượt cho tới khi hết hàng đợi.
    for (let i = 0; i < 50; i++) {
      const n = await pushOutbox(db, sb)
      if (n === 0 && (await db.outbox.count()) === 0) break
    }
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null })
  } catch (e) {
    setStatus({ state: navigator.onLine === false ? 'offline' : 'error', error: (e as Error).message })
  } finally {
    running = false
    if (again) {
      again = false
      schedule(1000)
    }
  }
}

function schedule(delay = 2500) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

let started = false

/** Gọi một lần khi app khởi động. */
export function startSync(): void {
  if (started || typeof window === 'undefined') return
  started = true
  onLocalChange(() => schedule())
  subscribeAuth(() => {
    if (getAuth().status === 'signed_in') schedule(500)
    else setStatus({ state: 'off' })
  })
  window.addEventListener('online', () => schedule(500))
  window.addEventListener('offline', () => setStatus({ state: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(800)
  })
  setInterval(() => schedule(0), 120_000)
}
