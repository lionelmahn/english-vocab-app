import type { SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db, onLocalChange } from '../db/db'
import { appScheduler } from '../db/repo'
import { getAuth, subscribeAuth } from './auth'
import { getSupabase } from './supabase'
import { getSettings } from '../lib/settings'
import { syncAudio } from './audioStore'
import { bindAccount, forgetCursors, syncOnce, type SyncRemote, type SyncResult } from './syncEngine'

/**
 * Đồng bộ dữ liệu học với Supabase khi đã đăng nhập (R11.1, R11.5, R11.7).
 * Tự chạy khi mở app, khi có thay đổi, khi quay lại app, khi có mạng lại và định kỳ.
 */

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error' | 'offline'
  lastSyncedAt: number | null
  error: string | null
  /** Kết quả lần đồng bộ thành công gần nhất. */
  last: SyncResult | null
  /**
   * Kho âm thanh (ghi âm, Giọng iPhone): `not_ready` = máy chủ chưa chạy file SQL âm thanh,
   * `error` = lỗi khi tải file (dữ liệu học vẫn đồng bộ bình thường).
   */
  audio: 'unknown' | 'ready' | 'not_ready' | 'error'
  audioError: string | null
}

let status: SyncStatus = { state: 'off', lastSyncedAt: null, error: null, last: null, audio: 'unknown', audioError: null }
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

/** Kênh đồng bộ qua PostgREST của Supabase. */
export function supabaseRemote(client: SupabaseClient): SyncRemote {
  return {
    async upsert(table, rows, { ignoreDuplicates, onConflict }) {
      const { error } = await client.from(table).upsert(rows, { onConflict, ignoreDuplicates })
      if (error) throw new Error(`${table}: ${error.message}`)
    },
    async pullPage(table, after, limit, idColumn) {
      // Phân trang theo (server_updated_at, khóa) để không sót dòng ghi cùng một thời điểm.
      const ts = `"${after.ts}"`
      const { data, error } = await client
        .from(table)
        .select('*')
        .or(`server_updated_at.gt.${ts},and(server_updated_at.eq.${ts},${idColumn}.gt.${after.id})`)
        .order('server_updated_at', { ascending: true })
        .order(idColumn, { ascending: true })
        .limit(limit)
      if (error) throw new Error(`${table}: ${error.message}`)
      return data as Record<string, unknown>[]
    },
  }
}

let running = false
let again = false
/** Lần đồng bộ tới kéo lại toàn bộ (đặt khi đang có lượt đồng bộ chạy dở). */
let refetch = false
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
    const remote = supabaseRemote(await client)
    await bindAccount(db, auth.userId)
    if (refetch) {
      refetch = false
      await forgetCursors(db)
    }
    const ctx = { scheduler: appScheduler, now: Date.now, userId: auth.userId }
    let last = await syncOnce(db, remote, ctx)
    let audio: SyncStatus['audio'] = 'ready'
    let audioError: string | null = null
    if (last.skipped.includes('audioAssets')) audio = 'not_ready'
    else {
      try {
        // File âm thanh đi sau dữ liệu; có dòng mới (đường dẫn file) thì gửi luôn trong lượt này.
        if (await syncAudio(await client, auth.userId, getSettings().accent)) {
          const more = await syncOnce(db, remote, ctx)
          last = { ...more, received: last.received + more.received, sent: last.sent + more.sent, merged: last.merged + more.merged, replayed: last.replayed + more.replayed }
        }
      } catch (e) {
        const message = (e as Error).message
        audio = /bucket not found/i.test(message) ? 'not_ready' : 'error'
        audioError = message
      }
    }
    setStatus({ state: 'idle', lastSyncedAt: Date.now(), error: null, last, audio, audioError })
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

/** Tải lại toàn bộ dữ liệu từ máy chủ và gộp với dữ liệu trên thiết bị (không xóa gì). */
export async function resyncAll(): Promise<void> {
  refetch = true
  await syncNow()
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
