/** Mã thiết bị (ghi vào từng lượt trả lời để biết lượt đó đến từ máy nào khi đồng bộ). */
const KEY = 'device-id'
let cached: string | null = null

export function getDeviceId(): string {
  if (cached) return cached
  try {
    cached = localStorage.getItem(KEY)
    if (!cached) {
      cached = crypto.randomUUID()
      localStorage.setItem(KEY, cached)
    }
  } catch {
    cached = crypto.randomUUID()
  }
  return cached
}
