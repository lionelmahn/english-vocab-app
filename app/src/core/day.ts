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

/** Thời điểm kết thúc ngày học đang diễn ra: 4:00 sáng kế tiếp theo múi giờ (không xét đổi giờ mùa hè). */
export function studyDayEnd(at: Date, timeZone: string, dayStartHour = DAY_START_HOUR): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  let left = dayStartHour * 3600 - ((get('hour') * 60 + get('minute')) * 60 + get('second'))
  if (left <= 0) left += 24 * 3600
  return Math.floor(at.getTime() / 1000) * 1000 + left * 1000
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
