import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { POS_ORDER } from '../../core/pos'
import { contextSentence, meaningKey, termKey } from '../../core/vocab'
import { parseStarter } from '.'

/** Kiểm tra file bộ từ khởi đầu thật, như app sẽ đọc. */

const text = readFileSync(fileURLToPath(new URL('./ngsl-1000.txt', import.meta.url)), 'utf8')
const items = parseStarter(text, 'NGSL 1.2 (CC BY-SA 4.0)')

describe('bộ 1.000 từ thông dụng (NGSL 1.2)', () => {
  it('đủ 1.000 từ, đúng thứ tự hạng, mỗi dòng 6 cột', () => {
    const rows = text.trim().split('\n').slice(1)
    expect(rows).toHaveLength(1000)
    rows.forEach((r, i) => {
      const cols = r.split('|')
      expect(cols).toHaveLength(6)
      expect(Number(cols[0])).toBe(i + 1)
    })
    expect(items).toHaveLength(1000)
    expect(items[0].term).toBe('the')
    expect(items[999].term).toBe('favorite')
  })

  it('từ nào cũng có nghĩa, loại từ hợp lệ, câu ví dụ có bản dịch', () => {
    for (const it of items) {
      expect(it.meaningVi.length, it.term).toBeGreaterThan(0)
      expect(POS_ORDER, it.term).toContain(it.partOfSpeech)
      expect(it.examples[0]?.vi, it.term).toBeTruthy()
    }
  })

  it('câu ví dụ chứa đúng mặt chữ của từ (để gạch chân và làm bài điền từ)', () => {
    const missing = items.filter((it) => contextSentence(it) === null).map((it) => it.term)
    expect(missing).toEqual([])
  })

  it('không có hai mục trùng nhau (cùng từ, loại từ, nghĩa)', () => {
    const keys = items.map((it) => `${termKey(it.term)}|${it.partOfSpeech}|${meaningKey(it.meaningVi)}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(items.map((it) => termKey(it.term))).size).toBe(1000)
  })
})
