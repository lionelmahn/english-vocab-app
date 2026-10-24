import { describe, expect, it } from 'vitest'
import { checkAnswer } from './answers'
import { activeSlot, composeAnswer, fillSlots, hintLetters, letterCount, slotTemplate } from './letters'

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

  it('gợi ý lộ dần chữ đầu', () => {
    expect(hintLetters(slotTemplate('give up'), 3)).toBe('giv')
  })
})
