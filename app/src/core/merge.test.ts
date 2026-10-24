import { describe, expect, it } from 'vitest'
import { mergeRows, sameContent, sameValue } from './merge'

interface Row {
  id: string
  updatedAt: number
  meaning: string
  favorite: boolean
  tags: string[]
  note?: string
  due: number
  reps: number
  deletedAt: number | null
}

const base: Row = { id: 'x', updatedAt: 100, meaning: 'chạy', favorite: false, tags: ['a'], due: 1000, reps: 1, deletedAt: null }
const FSRS = { fsrs: ['due', 'reps'] as const }

describe('sameValue', () => {
  it('so sánh theo nội dung, kể cả mảng và đối tượng lồng nhau', () => {
    expect(sameValue([{ en: 'Hi', vi: 'Chào' }], [{ vi: 'Chào', en: 'Hi' }])).toBe(true)
    expect(sameValue(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('thiếu trường và undefined coi như nhau, null thì khác', () => {
    expect(sameValue({ en: 'Hi', vi: undefined }, { en: 'Hi' })).toBe(true)
    expect(sameValue({ note: null }, { note: undefined })).toBe(false)
  })

  it('sameContent bỏ qua updatedAt', () => {
    expect(sameContent({ ...base, updatedAt: 1 }, { ...base, updatedAt: 2 })).toBe(true)
  })
})

describe('mergeRows — gộp ba chiều theo từng trường (R11.7)', () => {
  it('mỗi máy sửa một trường khác nhau thì giữ cả hai', () => {
    const local = { ...base, meaning: 'chạy bộ', updatedAt: 200 }
    const remote = { ...base, favorite: true, updatedAt: 150 }
    const { row, conflicts } = mergeRows(local, remote, base)
    expect(row).toMatchObject({ meaning: 'chạy bộ', favorite: true, updatedAt: 200 })
    expect(conflicts).toEqual([])
  })

  it('cùng sửa một trường thì bản sửa mới hơn thắng', () => {
    const local = { ...base, meaning: 'chạy bộ', updatedAt: 200 }
    const remote = { ...base, meaning: 'điều hành', updatedAt: 300 }
    const merged = mergeRows(local, remote, base)
    expect(merged.row.meaning).toBe('điều hành')
    expect(merged.conflicts).toEqual(['meaning'])
    expect(mergeRows(remote, local, base).row.meaning).toBe('điều hành')
  })

  it('hai bản sửa cùng thời điểm: hai máy chọn giống nhau', () => {
    const a = { ...base, meaning: 'A', updatedAt: 200 }
    const b = { ...base, meaning: 'B', updatedAt: 200 }
    expect(mergeRows(a, b, base).row.meaning).toBe(mergeRows(b, a, base).row.meaning)
  })

  it('xóa ở một máy, sửa ở máy kia: vẫn xóa và giữ nội dung đã sửa', () => {
    const local = { ...base, deletedAt: 200, updatedAt: 200 }
    const remote = { ...base, note: 'ghi chú', updatedAt: 250 }
    const { row } = mergeRows(local, remote, base)
    expect(row.deletedAt).toBe(200)
    expect(row.note).toBe('ghi chú')
  })

  it('nhóm trường FSRS đi cùng nhau: chỉ một phía đổi thì lấy trọn phía đó', () => {
    const local = { ...base, due: 5000, reps: 2, updatedAt: 200 }
    const remote = { ...base, favorite: true, updatedAt: 300 }
    const { row, conflicts } = mergeRows(local, remote, base, FSRS)
    expect(row).toMatchObject({ due: 5000, reps: 2, favorite: true })
    expect(conflicts).toEqual([])
  })

  it('nhóm FSRS đổi ở cả hai phía thì báo xung đột để tính lại từ lịch sử', () => {
    const local = { ...base, due: 5000, reps: 2, updatedAt: 200 }
    const remote = { ...base, due: 7000, reps: 2, updatedAt: 300 }
    expect(mergeRows(local, remote, base, FSRS).conflicts).toEqual(['fsrs'])
  })

  it('không có bản gốc: khác nhau thì bản mới hơn thắng', () => {
    const local = { ...base, meaning: 'cũ', favorite: true, updatedAt: 100 }
    const remote = { ...base, meaning: 'mới', updatedAt: 300 }
    const { row } = mergeRows(local, remote, undefined)
    expect(row).toMatchObject({ meaning: 'mới', favorite: false })
  })
})
