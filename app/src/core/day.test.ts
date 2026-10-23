import { describe, expect, it } from 'vitest'
import { currentStreak, studyDay } from './day'

const VN = 'Asia/Ho_Chi_Minh'

describe('studyDay — ngày học bắt đầu lúc 4:00 sáng giờ địa phương', () => {
  it('3:30 sáng vẫn tính cho hôm trước', () => {
    // 2026-10-23T20:30Z = 03:30 ngày 24/10 giờ Việt Nam
    expect(studyDay(new Date('2026-10-23T20:30:00Z'), VN)).toBe('2026-10-23')
  })

  it('4:30 sáng tính cho ngày mới', () => {
    expect(studyDay(new Date('2026-10-23T21:30:00Z'), VN)).toBe('2026-10-24')
  })

  it('tôn trọng múi giờ khác', () => {
    expect(studyDay(new Date('2026-10-23T20:30:00Z'), 'Europe/London')).toBe('2026-10-23')
    expect(studyDay(new Date('2026-10-24T03:30:00Z'), 'Europe/London')).toBe('2026-10-24')
  })
})

describe('currentStreak', () => {
  it('đếm số ngày liên tục tính đến hôm nay', () => {
    expect(currentStreak(['2026-10-21', '2026-10-22', '2026-10-23'], '2026-10-23')).toBe(3)
  })

  it('hôm nay chưa học vẫn giữ chuỗi từ hôm qua', () => {
    expect(currentStreak(['2026-10-21', '2026-10-22'], '2026-10-23')).toBe(2)
  })

  it('bỏ một ngày thì chuỗi về 0', () => {
    expect(currentStreak(['2026-10-20', '2026-10-21'], '2026-10-23')).toBe(0)
  })

  it('đi qua đầu tháng', () => {
    expect(currentStreak(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2)
  })
})
