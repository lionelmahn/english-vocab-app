import { liveQuery } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { LEARNING_DEFAULTS, LEARNING_KEYS, profileDefaults, sanitizeFsrs, type LearningSettings, type ProfileData } from '../core/profile'
import { configureScheduler } from '../core/scheduler'
import { sanitizeReminders } from '../core/reminders'
import { db } from '../db/db'
import { appScheduler, repo } from '../db/repo'
import { PROFILE_ID, type Profile } from '../db/types'
import { applyLearningSettings, currentLearningSettings, setLearningWriter } from '../lib/settings'

/**
 * Hồ sơ người học trên thiết bị (R1.4, R1.5, R9.2) và cầu nối với cài đặt học (R14.2):
 * sửa cài đặt học thì ghi vào hồ sơ (rồi đồng bộ); hồ sơ đổi (kể cả từ máy khác) thì cài đặt đổi theo.
 */

export function dataOf(row: Profile): ProfileData {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...data } = row
  // Hồ sơ lưu từ bản cũ có thể thiếu mục mới (ví dụ tùy chọn nhắc nhở từ 0.12.0): điền giá trị mặc định.
  return { ...profileDefaults(data.timeZone), ...data, reminders: sanitizeReminders(data.reminders), fsrs: sanitizeFsrs(data.fsrs) }
}

function learningOf(row: ProfileData): LearningSettings {
  return Object.fromEntries(LEARNING_KEYS.map((k) => [k, row[k]])) as unknown as LearningSettings
}

/** Hồ sơ đang dùng; thiết bị chưa có hồ sơ thì là giá trị mặc định cùng cài đặt học hiện tại. */
export function useProfile(): ProfileData | undefined {
  return useLiveQuery(async () => {
    const row = await db.profiles.get(PROFILE_ID)
    return row ? dataOf(row) : { ...profileDefaults(), ...currentLearningSettings() }
  }, [])
}

export function updateProfile(patch: Partial<ProfileData>): Promise<Profile> {
  return repo.updateProfile(patch)
}

let started = false

/** Gọi một lần khi app khởi động. */
export function startProfile(): void {
  if (started || typeof window === 'undefined') return
  started = true
  setLearningWriter((patch) => void repo.updateProfile(patch))
  let first = true
  liveQuery(() => db.profiles.get(PROFILE_ID)).subscribe({
    next: (row) => {
      if (row) {
        applyLearningSettings(learningOf(row))
        // Mục tiêu ghi nhớ và tham số riêng (R5.13) áp vào bộ lập lịch dùng chung, kể cả khi đổi từ máy khác.
        const { retention, weights } = sanitizeFsrs(row.fsrs)
        configureScheduler(appScheduler, { requestRetention: retention, weights })
      } else if (first) {
        // Lần đầu chạy bản có hồ sơ: chuyển các cài đặt học đã chỉnh trên máy này vào hồ sơ.
        // Máy chưa chỉnh gì thì để yên, chờ nhận hồ sơ từ máy chủ.
        const mine = currentLearningSettings()
        const changed = Object.fromEntries(LEARNING_KEYS.filter((k) => mine[k] !== LEARNING_DEFAULTS[k]).map((k) => [k, mine[k]]))
        if (Object.keys(changed).length > 0) void repo.updateProfile(changed)
      }
      first = false
    },
    error: () => {
      // Không đọc được CSDL trên máy: vẫn dùng cài đặt lưu trong localStorage.
    },
  })
}
