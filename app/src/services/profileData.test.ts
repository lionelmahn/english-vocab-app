import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { LEARNING_DEFAULTS } from '../core/profile'
import { REMINDER_DEFAULTS } from '../core/reminders'
import type { Profile } from '../db/types'
import { dataOf } from './profile'

describe('đọc hồ sơ trên máy', () => {
  it('hồ sơ lưu từ bản cũ (chưa có tùy chọn nhắc nhở) được điền giá trị mặc định', () => {
    const old = {
      id: 'me',
      displayName: 'Mạnh',
      dailyMinutes: 20,
      studyWeekdays: [1, 2, 3],
      studyTime: '20:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      ...LEARNING_DEFAULTS,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    } as unknown as Profile
    const data = dataOf(old)
    expect(data.reminders).toEqual(REMINDER_DEFAULTS)
    expect(data).toMatchObject({ displayName: 'Mạnh', dailyMinutes: 20, studyTime: '20:00' })
    expect('id' in data).toBe(false)
  })
})
