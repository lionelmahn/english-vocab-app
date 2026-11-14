import { describe, expect, it } from 'vitest'
import { parsePassage, phraseIssue, selectionOf, tapToken } from './passage'

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

  it('báo vì sao không ghép được cụm: khác câu, hoặc dài quá 6 chữ (chạm “I” rồi “noise” trên iPhone)', () => {
    const s = "I can't put up with this noise"
    const q = parsePassage(s)
    const i = (w: string) => q.tokens.findIndex((t) => t.text === w)
    expect(phraseIssue(q, { from: i('I'), to: i('I') }, i('noise'))).toBe('too_long')
    expect(tapToken(q, { from: i('I'), to: i('I') }, i('noise'))).toEqual({ from: i('noise'), to: i('noise') })
    expect(phraseIssue(q, { from: i("can't"), to: i("can't") }, i('noise'))).toBeNull()
    expect(phraseIssue(p, { from: at('team'), to: at('team') }, at('manager'))).toBe('other_sentence')
    // Chạm lần đầu, bỏ chọn, hay đang chọn cả cụm thì không có gì để báo.
    expect(phraseIssue(q, null, i('noise'))).toBeNull()
    expect(phraseIssue(q, { from: i('I'), to: i('I') }, i('I'))).toBeNull()
    expect(phraseIssue(q, { from: i('put'), to: i('with') }, i('noise'))).toBeNull()
  })
})
