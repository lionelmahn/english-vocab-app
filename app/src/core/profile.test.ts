import { default_w } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { FSRS_DEFAULTS, isStudyDay, LEARNING_DEFAULTS, profileDefaults, sameTimeZone, sanitizeFsrs, sanitizeProfile, timeZoneOffset, weekdaysLabel } from './profile'

describe('sanitizeProfile — khớp ràng buộc của bảng profiles', () => {
  const base = profileDefaults('Asia/Ho_Chi_Minh')

  it('giữ giá trị hợp lệ', () => {
    const p = sanitizeProfile({ ...base, displayName: '  Mạnh ', selfLevel: 'advanced', studyTime: '07:30', studyWeekdays: [5, 1, 3, 1], reviewStyle: 'flashcard' }, base)
    expect(p).toMatchObject({ displayName: 'Mạnh', selfLevel: 'advanced', studyTime: '07:30', studyWeekdays: [1, 3, 5], reviewStyle: 'flashcard' })
  })

  it('kẹp số trong giới hạn, bỏ giá trị lạ, mục bắt buộc thiếu thì lấy theo bản gốc', () => {
    const p = sanitizeProfile(
      {
        dailyNewWords: 999,
        dailyMinutes: -5,
        studyWeekdays: [7, -1, 2.5, 3],
        studyTime: '25:00',
        timeZone: 'Mars/Olympus',
        accent: 'au',
        selfLevel: 'expert',
        avatarUrl: 'javascript:alert(1)',
        displayName: 'x'.repeat(80),
      },
      base,
    )
    expect(p).toMatchObject({ dailyNewWords: 200, dailyMinutes: 0, studyWeekdays: [3], timeZone: 'Asia/Ho_Chi_Minh', accent: 'us' })
    expect(p.studyTime).toBeUndefined()
    expect(p.selfLevel).toBeUndefined()
    expect(p.avatarUrl).toBeUndefined()
    expect(p.displayName).toHaveLength(50)
    expect(p.reviewLimit).toBe(LEARNING_DEFAULTS.reviewLimit)
  })
})

describe('weekdaysLabel — lịch học dễ đọc (R9.2)', () => {
  it('gộp dãy ngày liên tiếp theo thứ tự T2 → CN', () => {
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Hằng ngày')
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('T2–T6')
    expect(weekdaysLabel([6, 0])).toBe('T7, CN')
    expect(weekdaysLabel([1, 3, 5])).toBe('T2, T4, T6')
    expect(weekdaysLabel([1, 2, 3, 5, 6, 0])).toBe('T2–T4, T6–CN')
    expect(weekdaysLabel([])).toBe('Chưa chọn ngày')
  })
})

describe('isStudyDay — theo ngày học bắt đầu lúc 4:00', () => {
  const tz = 'Asia/Ho_Chi_Minh'
  // Thứ bảy 24/10/2026, 10:00 giờ Việt Nam
  const saturday = new Date('2026-10-24T03:00:00Z')

  it('nhận ra ngày học và ngày nghỉ', () => {
    expect(isStudyDay([1, 2, 3, 4, 5], saturday, tz)).toBe(false)
    expect(isStudyDay([6], saturday, tz)).toBe(true)
  })

  it('2 giờ sáng Chủ nhật vẫn tính là thứ bảy', () => {
    const lateNight = new Date('2026-10-24T19:00:00Z') // 02:00 Chủ nhật giờ Việt Nam
    expect(isStudyDay([6], lateNight, tz)).toBe(true)
    expect(isStudyDay([0], lateNight, tz)).toBe(false)
  })

  it('hai tên của cùng múi giờ là một', () => {
    expect(sameTimeZone('Asia/Saigon', 'Asia/Ho_Chi_Minh')).toBe(true)
    expect(sameTimeZone('Asia/Bangkok', 'Asia/Ho_Chi_Minh')).toBe(false)
  })

  it('timeZoneOffset hiện GMT+7 cho Việt Nam', () => {
    expect(timeZoneOffset(tz, saturday)).toBe('GMT+7')
  })
})

describe('sanitizeFsrs — mục tiêu ghi nhớ và tham số lịch ôn (R5.13)', () => {
  it('giữ giá trị hợp lệ, bỏ tham số sai, mục tiêu ngoài khoảng thì lấy giá trị gốc', () => {
    const w = [...default_w]
    expect(sanitizeFsrs({ retention: 0.85, weights: w, optimizedAt: 5, optimizedReviews: 420.4, improvement: 0.05 })).toEqual({
      retention: 0.85,
      weights: w,
      optimizedAt: 5,
      optimizedReviews: 420,
      improvement: 0.05,
    })
    expect(sanitizeFsrs({ retention: 0.5, weights: [1, 2, 3], optimizedAt: 5 })).toEqual(FSRS_DEFAULTS)
    expect(sanitizeFsrs({ retention: 0.95, weights: w.map(() => NaN) }).weights).toBeNull()
    expect(sanitizeFsrs(undefined)).toEqual(FSRS_DEFAULTS)
    // Tham số vượt giới hạn của ts-fsrs được kéo về trong giới hạn.
    expect(sanitizeFsrs({ retention: 0.9, weights: w.map((v, i) => (i === 7 ? 5 : v)) }).weights![7]).toBe(0.75)
  })

  it('hồ sơ cũ chưa có mục này thì dùng mặc định', () => {
    const { fsrs: _f, ...old } = profileDefaults('Asia/Ho_Chi_Minh')
    expect(sanitizeProfile(old).fsrs).toEqual(FSRS_DEFAULTS)
  })
})
