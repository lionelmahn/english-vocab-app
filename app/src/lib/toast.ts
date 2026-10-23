/** Thông báo nhỏ hiện ở cuối màn hình (dùng chung cả app). */
export interface ToastState {
  id: number
  text: string
}
let toast: ToastState | null = null
const toastListeners = new Set<() => void>()
let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(text: string): void {
  toast = { id: Date.now(), text }
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
