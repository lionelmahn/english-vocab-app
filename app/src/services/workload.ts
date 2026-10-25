import { useLiveQuery } from 'dexie-react-hooks'
import { studyDay, studyDayEnd } from '../core/day'
import { deviceTimeZone } from '../core/profile'
import { PACE_WINDOW_DAYS, adviseNewWords, estimatePace, type NewWordAdvice, type Pace } from '../core/workload'
import { db } from '../db/db'
import { dueCount, type Library } from '../db/library'
import { useSettings } from '../lib/settings'
import { useProfile } from './profile'

export interface TodayWorkload extends NewWordAdvice {
  dueToday: number
  learnedToday: number
  goalNew: number
  goalMinutes: number
  pace: Pace
}

const HOUR_MS = 3_600_000

/** Gợi ý số từ mới hôm nay (R9.5) cho trang Hôm nay và màn hình chuẩn bị buổi học. `null` khi đang tải. */
export function useNewWordAdvice(lib: Library | undefined, now: number): TodayWorkload | null {
  const settings = useSettings()
  const profile = useProfile()
  const tz = profile?.timeZone ?? deviceTimeZone()
  // Lịch sử 30 ngày gần nhất, mốc làm tròn theo giờ để không đọc lại mỗi lần đồng hồ nhích.
  const since = Math.floor(now / HOUR_MS) * HOUR_MS - (PACE_WINDOW_DAYS + 1) * 24 * HOUR_MS
  const logs = useLiveQuery(() => db.reviewLogs.where('reviewedAt').above(since).toArray(), [since])
  if (!lib || !profile || !logs) return null
  const today = studyDay(new Date(now), tz)
  const learned = new Set<string>()
  for (const l of logs) if (l.mode === 'learn' && l.affectsSchedule && studyDay(new Date(l.reviewedAt), tz) === today) learned.add(l.itemId)
  const pace = estimatePace(logs, now)
  const input = {
    goalNew: settings.dailyNewWords,
    goalMinutes: profile.dailyMinutes,
    learnedToday: learned.size,
    dueToday: dueCount(lib, studyDayEnd(new Date(now), tz)),
    pace,
  }
  return { ...input, ...adviseNewWords(input) }
}

/** Câu giải thích khi gợi ý học ít từ mới hơn mục tiêu (trang Hôm nay và màn hình chuẩn bị buổi học). */
export function workloadText(w: TodayWorkload): string {
  const load = `Hôm nay còn ${w.dueToday} từ cần ôn (khoảng ${w.reviewMinutes} phút)`
  return w.reason === 'review-first'
    ? `${load}, đã kín ${w.goalMinutes} phút mỗi ngày. Nên ôn trước rồi mới học từ mới.`
    : `${load}, nên gợi ý học thêm ${w.suggested} từ mới để vừa ${w.goalMinutes} phút mỗi ngày.`
}
