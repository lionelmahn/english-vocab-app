import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { FeedbackKind, FeedbackReport } from '../db/types'
import { APP_VERSION } from '../lib/version'
import { getAuth } from './auth'
import { getSupabase } from './supabase'

/**
 * Báo lỗi và góp ý ngay tại màn hình liên quan (R14.4). Báo cáo lưu trên máy trước (không mất khi mất mạng), rồi gửi
 * vào bảng `feedback_reports` của tài khoản khi có mạng và đã đăng nhập; mỗi báo cáo gửi một lần (trùng mã thì bỏ qua).
 */

export const FEEDBACK_KINDS: readonly { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Lỗi ứng dụng' },
  { value: 'content', label: 'Nội dung sai' },
  { value: 'answer', label: 'Chấm sai' },
  { value: 'other', label: 'Góp ý khác' },
]

export const MAX_MESSAGE = 2000

/** Thông tin chung kèm theo mọi báo cáo. */
function deviceContext(): Record<string, unknown> {
  if (typeof window === 'undefined') return { version: APP_VERSION }
  return {
    version: APP_VERSION,
    route: location.pathname + location.search,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    online: navigator.onLine,
  }
}

export async function submitReport(kind: FeedbackKind, message: string, context: Record<string, unknown> = {}): Promise<FeedbackReport> {
  const report: FeedbackReport = {
    id: crypto.randomUUID(),
    kind,
    message: message.trim().slice(0, MAX_MESSAGE),
    context: { ...deviceContext(), ...context },
    createdAt: Date.now(),
    sentAt: null,
  }
  await db.feedback.put(report)
  void flushReports()
  return report
}

let flushing = false

/** Gửi các báo cáo chưa gửi. Trả về số báo cáo đã gửi được. */
export async function flushReports(client?: SupabaseClient): Promise<number> {
  if (flushing || getAuth().status !== 'signed_in' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0
  const pending = (await db.feedback.toArray()).filter((r) => r.sentAt === null)
  if (pending.length === 0) return 0
  flushing = true
  try {
    const supabase = client ?? (await getSupabase())
    if (!supabase) return 0
    const { error } = await supabase
      .from('feedback_reports')
      .upsert(
        pending.map((r) => ({ id: r.id, kind: r.kind, message: r.message, context: r.context, created_at: new Date(r.createdAt).toISOString() })),
        { onConflict: 'id', ignoreDuplicates: true },
      )
    if (error) return 0
    const at = Date.now()
    await db.feedback.bulkPut(pending.map((r) => ({ ...r, sentAt: at })))
    return pending.length
  } catch {
    return 0
  } finally {
    flushing = false
  }
}

export function useReports(): FeedbackReport[] | undefined {
  return useLiveQuery(async () => (await db.feedback.toArray()).sort((a, b) => b.createdAt - a.createdAt), [])
}
