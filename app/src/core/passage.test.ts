import { describe, expect, it } from 'vitest'
import { parsePassage, selectionOf, tapToken } from './passage'

const TEXT = "Our team missed the deadline. The manager wasn't happy!\nWe need to make up for lost time."
const p = parsePassage(TEXT)
const at = (w: string, n = 0) => p.tokens.map((t, i) => [t, i] as const).filter(([t]) => t.text === w)[n][1]

describe('đoạn văn để giải thích theo ngữ cảnh', () => {
  it('tách câu theo dấu chấm, chấm than và xuống dòng; chữ có dấu nháy là một chữ', () => {
    expect(p.sentences).toEqual(['Our team missed the deadline.', "The manager wasn't happy!", 'We need to make up for lost time.'])
    expect(p.tokens.find((t) => t.text === "wasn't")).toMatchObject({ word: true, sentence: 1 })
    expect(p.tokens.find((t) => t.text === '.')?.word).toBe(false)
    expect(p.tokens[at('time')].sentence).toBe(2)
  })

  it('chạm một chữ rồi chữ khác cùng câu để chọn cả cụm; chạm lại để bỏ chọn', () => {
    let sel = tapToken(p, null, at('make'))
    expect(sel).toEqual({ from: at('make'), to: at('make') })
    sel = tapToken(p, sel, at('for'))
    expect(selectionOf(TEXT, p, sel!.from, sel!.to)).toEqual({ selection: 'make up for', sentence: 'We need to make up for lost time.' })
    // Đang chọn cụm: chạm chữ khác thì chọn lại từ đầu.
    expect(tapToken(p, sel, at('lost'))).toEqual({ from: at('lost'), to: at('lost') })
    expect(tapToken(p, { from: at('need'), to: at('need') }, at('need'))).toBeNull()
  })

  it('không nối hai câu khác nhau, không chọn dấu câu', () => {
    expect(tapToken(p, { from: at('team'), to: at('team') }, at('manager'))).toEqual({ from: at('manager'), to: at('manager') })
    const sel = { from: at('Our'), to: at('Our') }
    expect(tapToken(p, sel, p.tokens.findIndex((t) => t.text === '.'))).toBe(sel)
    expect(selectionOf(TEXT, p, at('deadline'), at('The'))).toBeNull()
  })
})
