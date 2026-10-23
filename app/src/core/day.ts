/**
 * Ngày học theo múi giờ người học (R9.2, R10.5).
 * Một ngày học bắt đầu lúc 4:00 sáng, để học khuya vẫn tính cho hôm trước.
 */

export const DAY_START_HOUR = 4

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** Trả về ngày học dạng YYYY-MM-DD. */
export function studyDay(at: Date, timeZone: string, dayStartHour = DAY_START_HOUR): string {
  const shifted = new Date(at.getTime() - dayStartHour * HOUR_MS)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function dayIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/**
 * Chuỗi ngày học liên tục tính đến hôm nay.
 * Nếu hôm nay chưa học, chuỗi vẫn giữ nếu hôm qua có học.
 */
export function currentStreak(studiedDays: Iterable<string>, today: string): number {
  const set = new Set<number>()
  for (const d of studiedDays) set.add(dayIndex(d))
  let cursor = dayIndex(today)
  if (!set.has(cursor)) cursor -= 1
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor -= 1
  }
  return streak
}
