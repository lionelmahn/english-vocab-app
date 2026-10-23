import type { Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { authErrorMessage } from './authErrors'
import { getSupabase, isCloudConfigured } from './supabase'

/**
 * Đăng nhập (R1.2), đăng xuất, khôi phục và đổi mật khẩu (R1.3).
 * Bản cá nhân không có trang đăng ký: tài khoản được tạo sẵn trong Supabase.
 */

export type AuthState =
  | { status: 'disabled' } // chưa cấu hình máy chủ
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; userId: string; email: string }

let state: AuthState = isCloudConfigured ? { status: 'loading' } : { status: 'disabled' }
const listeners = new Set<() => void>()

function setState(next: AuthState) {
  state = next
  listeners.forEach((notify) => notify())
}

function fromSession(session: Session | null): AuthState {
  return session?.user ? { status: 'signed_in', userId: session.user.id, email: session.user.email ?? '' } : { status: 'signed_out' }
}

/** Link đặt lại mật khẩu trong email mở app với `type=recovery` trên URL. */
export const openedFromRecoveryLink = typeof location !== 'undefined' && location.hash.includes('type=recovery')

let started = false

/** Gọi một lần khi app khởi động. `onRecovery` chạy khi người dùng mở link đặt lại mật khẩu. */
export function startAuth(onRecovery: () => void): void {
  if (started) return
  started = true
  const client = getSupabase()
  if (!client) return
  client
    .then((sb) => {
      sb.auth.onAuthStateChange((event, session) => {
        setState(fromSession(session))
        if (event === 'PASSWORD_RECOVERY') onRecovery()
      })
    })
    .catch(() => setState({ status: 'signed_out' }))
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuth(): AuthState {
  return state
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, () => state)
}

const NOT_CONFIGURED = 'App chưa được kết nối máy chủ.'

/** Trả về null nếu thành công, hoặc câu báo lỗi. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) return NOT_CONFIGURED
  try {
    const { error } = await (await client).auth.signInWithPassword({ email: email.trim(), password })
    return authErrorMessage(error)
  } catch (e) {
    return authErrorMessage(e as Error)
  }
}

export async function signOut(): Promise<void> {
  const client = getSupabase()
  if (!client) return
  await (await client).auth.signOut()
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) return NOT_CONFIGURED
  try {
    const { error } = await (await client).auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/reset-password`,
    })
    return authErrorMessage(error)
  } catch (e) {
    return authErrorMessage(e as Error)
  }
}

export async function updatePassword(newPassword: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) return NOT_CONFIGURED
  try {
    const { error } = await (await client).auth.updateUser({ password: newPassword })
    return authErrorMessage(error)
  } catch (e) {
    return authErrorMessage(e as Error)
  }
}

export type CloudCheck = { ok: true } | { ok: false; message: string }

/**
 * Kiểm tra kết nối thật: đọc hồ sơ của chính mình trên máy chủ.
 * Thành công nghĩa là URL, khóa, bảng, trigger tạo hồ sơ và phân quyền RLS đều đúng.
 */
export async function checkCloud(): Promise<CloudCheck> {
  const client = getSupabase()
  if (!client) return { ok: false, message: NOT_CONFIGURED }
  try {
    const { data, error } = await (await client).from('profiles').select('user_id').maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!data) return { ok: false, message: 'Không thấy hồ sơ trên máy chủ. Hãy kiểm tra đã chạy file SQL trước khi tạo tài khoản.' }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
