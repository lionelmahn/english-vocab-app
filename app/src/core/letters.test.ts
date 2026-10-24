import { describe, expect, it } from 'vitest'
import { checkAnswer } from './answers'
import { activeSlot, composeAnswer, fillSlots, letterCount, nextHintSlot, pickReveals, scaffoldCount, slotTemplate } from './letters'
import { seededRandom } from './exercises'

describe('ô chữ "Điền từ"', () => {
  const t = slotTemplate('asynchronous  error')

  it('mỗi chữ cái một ô, khoảng trắng cố định', () => {
    expect(letterCount(t)).toBe(17)
    expect(t[12]).toEqual({ kind: 'fixed', char: ' ' })
  })

  it('gõ không cần dấu cách vẫn điền đúng ô và ghép lại đúng cụm từ', () => {
    const typed = 'asynchronouserror'
    expect(fillSlots(t, typed).join('')).toBe('asynchronous error')
    expect(composeAnswer(t, typed)).toBe('asynchronous error')
    expect(checkAnswer(composeAnswer(t, typed), ['asynchronous error']).verdict).toBe('correct')
  })

  it('gõ có dấu cách cũng được', () => {
    expect(composeAnswer(t, 'asynchronous error')).toBe('asynchronous error')
  })

  it('ô đang chờ gõ và ô trống', () => {
    expect(activeSlot(t, 'async')).toBe(5)
    expect(fillSlots(t, 'as').slice(0, 3)).toEqual(['a', 's', null])
    expect(activeSlot(t, 'asynchronouserror')).toBe(-1)
  })

  it('dấu nháy, gạch nối giữ nguyên', () => {
    const d = slotTemplate("don't well-known")
    expect(composeAnswer(d, 'dontwellknown')).toBe("don't well-known")
  })

  it('gõ thiếu thì không thêm dấu thừa ở cuối', () => {
    expect(composeAnswer(t, 'asynchronous')).toBe('asynchronous')
  })

  it('gõ dư chữ thì nối vào cuối', () => {
    expect(composeAnswer(slotTemplate('color'), 'colour')).toBe('colour')
  })

})

describe('chữ gợi ý mờ ở vị trí ngẫu nhiên', () => {
  it('số chữ lộ: ít, tăng theo độ dài, tối đa 3', () => {
    expect([3, 4, 6, 7, 11, 12, 17, 30].map(scaffoldCount)).toEqual([0, 1, 1, 1, 2, 2, 3, 3])
  })

  it('vị trí khác nhau giữa các lần, chỉ rơi vào chữ cái', () => {
    const t = slotTemplate('asynchronous error')
    const a = pickReveals(t, 3, seededRandom(1))
    const b = pickReveals(t, 3, seededRandom(2))
    expect(a).toHaveLength(3)
    expect(a).not.toEqual(b)
    expect(a.every((i) => t[i].kind === 'letter')).toBe(true)
  })

  it('không bao giờ lộ hết chữ', () => {
    expect(pickReveals(slotTemplate('go'), 5)).toHaveLength(1)
  })

  it('gợi ý tiếp theo: ô đầu tiên từ vị trí đang gõ chưa có chữ mờ', () => {
    const t = slotTemplate('examination')
    const hinted = new Set([2, 4]) // a, i
    expect(nextHintSlot(t, hinted, 'ex')).toBe(3) // đang gõ ô 2 (đã có chữ mờ) → gợi ý ô 3
    expect(nextHintSlot(t, hinted, 'e')).toBe(1)
    expect(nextHintSlot(t, hinted, 'examination')).toBe(-1)
  })
})
