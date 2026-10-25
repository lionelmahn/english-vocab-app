import { useSyncExternalStore } from 'react'
import { isInstalled } from '../lib/device'
import { getAuth, subscribeAuth } from './auth'
import { isAppleMobile } from './speech'
import { getSupabase } from './supabase'

/**
 * Nhận nhắc nhở qua Web Push trên máy này (R9.3, R9.4, R9.6).
 * Mỗi máy đăng ký một lần; máy chủ (Edge Function send-reminders) gửi thông báo theo tùy chọn trong hồ sơ.
 */

const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export type PushState =
  /** App chưa có khóa công khai VAPID (chưa cài nhắc nhở). */
  | { kind: 'not-configured' }
  /** iPhone/iPad: nhắc nhở chỉ chạy khi app đã cài lên màn hình chính. */
  | { kind: 'needs-install' }
  | { kind: 'unsupported' }
  | { kind: 'signed-out' }
  /** Người dùng đã chặn thông báo cho app. */
  | { kind: 'denied' }
  | { kind: 'off' }
  | { kind: 'on'; endpoint: string }

function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Service worker của app (không có khi chạy bản dev); chờ tối đa vài giây. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined)
  if (!reg) return null
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
}

export async function pushState(): Promise<PushState> {
  if (!VAPID) return { kind: 'not-configured' }
  if (!supported()) return isAppleMobile() && !isInstalled() ? { kind: 'needs-install' } : { kind: 'unsupported' }
  if (getAuth().status !== 'signed_in') return { kind: 'signed-out' }
  if (Notification.permission === 'denied') return { kind: 'denied' }
  const reg = await registration()
  if (!reg) return { kind: 'unsupported' }
  const sub = await reg.pushManager.getSubscription().catch(() => null)
  return sub && Notification.permission === 'granted' ? { kind: 'on', endpoint: sub.endpoint } : { kind: 'off' }
}

/** Tên máy để nhận ra trong danh sách: "iPhone", "Android", "Windows"…, kèm "app đã cài" nếu chạy từ màn hình chính. */
export function deviceLabel(): string {
  const ua = navigator.userAgent
  const name = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Máy khác'
  return isInstalled() ? `${name} (app đã cài)` : name
}

function serverMessage(message: string): string {
  if (/push_subscriptions|reminder|schema cache|does not exist/i.test(message))
    return 'Máy chủ chưa chạy file SQL nhắc nhở (supabase/migrations/20261026000000_reminders.sql).'
  return message
}

/** Lưu đăng ký của máy này lên máy chủ (gọi lại được nhiều lần). */
async function saveSubscription(sub: PushSubscription): Promise<string | null> {
  const json = sub.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) return 'Trình duyệt không trả về khóa nhận thông báo.'
  const client = await getSupabase()
  if (!client) return 'App chưa kết nối máy chủ.'
  const { error } = await client.from('push_subscriptions').upsert({ endpoint: json.endpoint, p256dh, auth, device: deviceLabel() }, { onConflict: 'endpoint' })
  return error ? serverMessage(error.message) : null
}

function sameKey(sub: PushSubscription): boolean {
  const key = sub.options?.applicationServerKey
  if (!key) return true
  const a = new Uint8Array(key)
  const b = fromB64u(VAPID)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** Bật nhắc nhở trên máy này: xin quyền, đăng ký với dịch vụ đẩy, lưu lên máy chủ. Trả về lỗi (nếu có). */
export async function enablePush(): Promise<string | null> {
  if (!VAPID) return 'App chưa cài nhắc nhở.'
  if (!supported()) return 'Trình duyệt này không nhận được thông báo.'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Bạn chưa cho phép thông báo. Muốn bật lại thì vào Cài đặt của máy → Thông báo → Ôn từ vựng.'
  const reg = await registration()
  if (!reg) return 'App chưa sẵn sàng nhận thông báo. Đóng hẳn app, mở lại rồi thử lại.'
  try {
    let sub = await reg.pushManager.getSubscription()
    // Khóa máy chủ đã đổi thì đăng ký lại.
    if (sub && !sameKey(sub)) {
      await sub.unsubscribe()
      sub = null
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(VAPID) })
    const error = await saveSubscription(sub)
    emit()
    return error
  } catch (e) {
    return `Không đăng ký được thông báo: ${(e as Error).message}`
  }
}

/** Tắt nhắc nhở trên máy này (xóa đăng ký ở cả máy chủ). */
export async function disablePush(): Promise<string | null> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  const client = await getSupabase()
  if (sub) {
    if (client) {
      const { error } = await client.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      if (error) return serverMessage(error.message)
    }
    await sub.unsubscribe().catch(() => undefined)
  }
  emit()
  return null
}

export interface PushDevice {
  id: string
  device: string
  endpoint: string
  created_at: string
}

export async function listDevices(): Promise<PushDevice[] | string> {
  const client = await getSupabase()
  if (!client) return []
  const { data, error } = await client.from('push_subscriptions').select('id, device, endpoint, created_at').order('created_at')
  return error ? serverMessage(error.message) : (data as PushDevice[])
}

export async function removeDevice(id: string): Promise<string | null> {
  const client = await getSupabase()
  if (!client) return null
  const { error } = await client.from('push_subscriptions').delete().eq('id', id)
  emit()
  return error ? serverMessage(error.message) : null
}

/** Nhờ máy chủ gửi thử một thông báo tới mọi máy đã bật của tài khoản này. */
export async function sendTest(): Promise<{ ok: boolean; message: string }> {
  const client = await getSupabase()
  if (!client) return { ok: false, message: 'App chưa kết nối máy chủ.' }
  const { data, error } = await client.functions.invoke<{ devices: number; sent: number; error?: string }>('send-reminders', { body: { test: true } })
  if (error) {
    const status = (error as { context?: Response }).context?.status
    if (status === 404) return { ok: false, message: 'Máy chủ chưa có Edge Function “send-reminders”.' }
    let detail = error.message
    try {
      detail = ((await (error as { context?: Response }).context?.json()) as { error?: string })?.error ?? detail
    } catch {
      // giữ thông báo gốc
    }
    return { ok: false, message: `Gửi thử lỗi: ${detail}` }
  }
  if (!data || data.devices === 0) return { ok: false, message: 'Chưa có máy nào bật nhắc nhở.' }
  if (data.sent === 0) return { ok: false, message: 'Máy chủ chưa gửi được tới máy nào. Thử tắt rồi bật lại nhắc nhở trên máy này.' }
  return { ok: true, message: `Đã gửi tới ${data.sent}/${data.devices} máy. Thông báo sẽ hiện sau vài giây.` }
}

/**
 * Mỗi lần mở app khi đã bật: gửi lại đăng ký lên máy chủ (phòng khi máy chủ đã xóa đăng ký hết hạn
 * hoặc trình duyệt đổi địa chỉ nhận). Lỗi thì bỏ qua, lần sau thử lại.
 */
export async function refreshPushSubscription(): Promise<void> {
  if (!VAPID || !supported() || getAuth().status !== 'signed_in' || Notification.permission !== 'granted') return
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  if (sub && sameKey(sub)) await saveSubscription(sub).catch(() => undefined)
}

let started = false

/** Gọi một lần khi app khởi động: khi đã đăng nhập thì gửi lại đăng ký của máy này (một lần mỗi lần mở app). */
export function startPush(): void {
  if (started || typeof window === 'undefined') return
  started = true
  let done = false
  const check = () => {
    if (done || getAuth().status !== 'signed_in') return
    done = true
    void refreshPushSubscription()
  }
  subscribeAuth(check)
  check()
}

// ---- Theo dõi trong giao diện ------------------------------------------------------------------

let version = 0
const listeners = new Set<() => void>()
function emit() {
  version++
  listeners.forEach((l) => l())
}

/** Đổi mỗi khi bật/tắt trên máy này, để giao diện đọc lại trạng thái. */
export function usePushVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
}
