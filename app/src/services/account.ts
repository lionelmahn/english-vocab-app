import { db } from '../db/db'
import { AUDIO_BUCKET } from './audioStore'
import { disablePush, pushState } from './push'
import { getSupabase } from './supabase'

/**
 * Quản lý tài khoản (R1.6): phiên đăng nhập trên máy này, đăng xuất các máy khác, xóa tài khoản cùng dữ liệu trên
 * máy chủ, xóa dữ liệu trên máy này. Quyền trên máy (R14.5).
 */

export interface SessionInfo {
  email: string
  /** Lần đăng nhập gần nhất của tài khoản (ở bất kỳ máy nào). */
  lastSignInAt: string | null
  /** Ngày tạo tài khoản. */
  createdAt: string | null
}

export async function sessionInfo(): Promise<SessionInfo | null> {
  const client = await getSupabase()
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } }
  const user = data.session?.user
  return user ? { email: user.email ?? '', lastSignInAt: user.last_sign_in_at ?? null, createdAt: user.created_at ?? null } : null
}

/**
 * Đăng xuất mọi máy khác (giữ máy này): các máy kia mất quyền đồng bộ khi phiên hiện tại của chúng hết hạn (tối đa
 * khoảng 1 tiếng). Đăng ký nhận nhắc nhở của các máy khác cũng bị xóa để máy đó thôi nhận thông báo.
 */
export async function signOutOthers(): Promise<string | null> {
  const client = await getSupabase()
  if (!client) return 'App chưa kết nối máy chủ.'
  const { error } = await client.auth.signOut({ scope: 'others' })
  if (error) return `Chưa đăng xuất được các máy khác: ${error.message}`
  const state = await pushState()
  const mine = state.kind === 'on' ? state.endpoint : null
  const query = client.from('push_subscriptions').delete()
  await (mine ? query.neq('endpoint', mine) : query.not('id', 'is', null))
  return null
}

/** Mã lỗi PostgREST khi máy chủ chưa có hàm (chưa chạy file SQL). */
const MISSING_FUNCTION = 'PGRST202'

/**
 * Xóa tài khoản và mọi dữ liệu trên máy chủ: xóa file âm thanh trong kho của tài khoản, rồi gọi hàm
 * delete_my_account() (xóa tài khoản, dữ liệu xóa theo). Xong thì đăng xuất trên máy này. Trả về null nếu xong.
 */
export async function deleteAccount(): Promise<string | null> {
  const client = await getSupabase()
  if (!client) return 'App chưa kết nối máy chủ.'
  const { data } = await client.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return 'Bạn cần đăng nhập để xóa tài khoản.'

  // File âm thanh trong kho (kho chưa mở thì bỏ qua).
  const bucket = client.storage.from(AUDIO_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data: files, error } = await bucket.list(uid, { limit: 1000 })
    if (error || !files || files.length === 0) break
    const { error: removeError } = await bucket.remove(files.map((f) => `${uid}/${f.name}`))
    if (removeError) return `Chưa xóa được file âm thanh trên máy chủ: ${removeError.message}`
  }

  const { error } = await client.rpc('delete_my_account')
  if (error) {
    if (error.code === MISSING_FUNCTION || /delete_my_account/.test(error.message)) {
      return 'Máy chủ chưa cài chức năng xóa tài khoản: chạy file supabase/migrations/20261027000000_account.sql trong SQL Editor của Supabase rồi thử lại. File âm thanh đã được xóa.'
    }
    return `Chưa xóa được tài khoản: ${error.message}`
  }
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
  return null
}

/**
 * Xóa mọi dữ liệu của app trên máy này (sổ tay, lịch sử, âm thanh, cài đặt, phiên đăng nhập) rồi mở lại app như mới.
 * Dữ liệu đã đồng bộ lên máy chủ không bị ảnh hưởng.
 */
export async function wipeThisDevice(): Promise<void> {
  // Máy này thôi nhận nhắc nhở (xóa cả đăng ký trên máy chủ nếu đang đăng nhập).
  await disablePush().catch(() => undefined)
  db.close()
  await db.delete().catch(() => undefined)
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // Trình duyệt chặn lưu trữ: không có gì để xóa.
  }
  location.replace('/')
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'
export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'unknown'

/** Quyền thông báo và micro của app trên máy này (R14.5). */
export async function permissionStates(): Promise<{ notifications: NotificationPermissionState; microphone: MicrophonePermissionState }> {
  const notifications: NotificationPermissionState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  let microphone: MicrophonePermissionState = 'unknown'
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName })
    if (status) microphone = status.state
  } catch {
    // Trình duyệt không cho hỏi trạng thái quyền micro (Safari đời cũ).
  }
  return { notifications, microphone }
}

/** Còn thay đổi chưa gửi lên máy chủ (để cảnh báo trước khi xóa dữ liệu trên máy). */
export function pendingChanges(): Promise<number> {
  return db.outbox.count()
}
