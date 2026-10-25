/**
 * Tùy chọn nhắc nhở (R9.3, R9.4, R9.6). Lưu trong hồ sơ nên dùng chung mọi máy; máy chủ đọc để quyết định nhắc.
 * Phải khớp với supabase/functions/send-reminders/index.ts (có test so hai bên).
 */

export interface ReminderPrefs {
  /** Nhắc vào giờ học (giờ đặt ở "Mục tiêu và lịch học"). */
  study: boolean
  /** Nhắc khi có từ đến hạn ôn. */
  due: boolean
  /** Chỉ nhắc ôn khi có ít nhất chừng này từ đến hạn. */
  dueMin: number
  /** Tối đa số lần nhắc ôn mỗi ngày. */
  duePerDay: number
  /** Giờ yên lặng "HH:MM": không nhắc từ quietStart đến quietEnd (có thể qua nửa đêm). */
  quietStart: string
  quietEnd: string
}

export const REMINDER_DEFAULTS: ReminderPrefs = { study: true, due: true, dueMin: 10, duePerDay: 2, quietStart: '22:00', quietEnd: '07:00' }

export const DUE_MIN_OPTIONS = [5, 10, 20, 50] as const
export const DUE_PER_DAY_OPTIONS = [1, 2, 3] as const

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function sanitizeReminders(raw: unknown, base: ReminderPrefs = REMINDER_DEFAULTS): ReminderPrefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
  return {
    study: typeof r.study === 'boolean' ? r.study : base.study,
    due: typeof r.due === 'boolean' ? r.due : base.due,
    dueMin: int(r.dueMin, 1, 500, base.dueMin),
    duePerDay: int(r.duePerDay, 1, 6, base.duePerDay),
    quietStart: typeof r.quietStart === 'string' && TIME.test(r.quietStart) ? r.quietStart : base.quietStart,
    quietEnd: typeof r.quietEnd === 'string' && TIME.test(r.quietEnd) ? r.quietEnd : base.quietEnd,
  }
}
