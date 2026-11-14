import { playIfQuiet } from './sfx'

/** Thông báo nhỏ hiện ở cuối màn hình (dùng chung cả app). */
export interface ToastState {
  id: number
  text: string
}
let toast: ToastState | null = null
const toastListeners = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

/** `tone`: báo xong việc (tiếng chuông nhỏ) hay báo lỗi (tiếng lỗi); vừa có tiếng khác (xóa, báo đúng) thì im. */
export function showToast(text: string, tone: 'success' | 'error' = 'success'): void {
  toast = { id: Date.now(), text }
  playIfQuiet(tone)
  toastListeners.forEach((l) => l())
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast = null
    toastListeners.forEach((l) => l())
  }, 2200)
}

export function subscribeToast(l: () => void): () => void {
  toastListeners.add(l)
  return () => toastListeners.delete(l)
}

export function getToast(): ToastState | null {
  return toast
}
