/** Thời gian còn lại đến một mốc, dạng ngắn gọn ("3 ngày", "2 giờ", "ngay bây giờ"). */
export function formatDueIn(due: number, now: number): string {
  const ms = due - now
  if (ms <= 0) return 'ngay bây giờ'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${Math.max(1, min)} phút nữa`
  const h = Math.round(ms / 3_600_000)
  if (h < 24) return `${h} giờ nữa`
  const d = Math.round(ms / 86_400_000)
  if (d < 31) return `${d} ngày nữa`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo} tháng nữa`
  return `${Math.round(d / 365)} năm nữa`
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms)
}
