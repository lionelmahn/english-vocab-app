import { describe, expect, it } from 'vitest'
import { checkAnswer, editDistance, normalizeAnswer } from './answers'

describe('normalizeAnswer', () => {
  it('bỏ khoảng trắng thừa, không phân biệt hoa thường, thống nhất dấu nháy', () => {
    expect(normalizeAnswer('  Give   UP ')).toBe('give up')
    expect(normalizeAnswer('don’t')).toBe("don't")
    expect(normalizeAnswer('Hello.')).toBe('hello')
  })
})

describe('editDistance', () => {
  it('tính thêm/bớt/thay/đảo ký tự', () => {
    expect(editDistance('resilient', 'resilient')).toBe(0)
    expect(editDistance('resilient', 'resilent')).toBe(1)
    expect(editDistance('receive', 'recieve')).toBe(1)
    expect(editDistance('cat', 'dog')).toBe(3)
  })
})

describe('checkAnswer', () => {
  it('khớp chính xác sau chuẩn hóa', () => {
    expect(checkAnswer('Resilient', ['resilient'])).toEqual({ verdict: 'correct', matched: 'resilient' })
  })

  it('chấp nhận biến thể có trong danh sách đáp án', () => {
    expect(checkAnswer('color', ['colour', 'color']).verdict).toBe('correct')
  })

  it('sai 1 ký tự với từ đủ dài là gần đúng', () => {
    expect(checkAnswer('recieve', ['receive'])).toEqual({ verdict: 'near', matched: 'receive' })
  })

  it('từ ngắn sai 1 ký tự vẫn là sai', () => {
    expect(checkAnswer('car', ['cat']).verdict).toBe('wrong')
  })

  it('từ 4 chữ cái trở xuống không xét gần đúng: "for" không được nhận cho "four"', () => {
    expect(checkAnswer('for', ['four']).verdict).toBe('wrong')
    expect(checkAnswer('colr', ['color']).verdict).toBe('near')
  })

  it('bỏ trống là sai', () => {
    expect(checkAnswer('   ', ['four']).verdict).toBe('wrong')
  })
})
