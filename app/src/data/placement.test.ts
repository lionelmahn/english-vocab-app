import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { termKey } from '../core/vocab'
import { PROBE_B1, PROBE_B2, PROBE_C1 } from './placement'
import { parseStarter } from './starter'

describe('từ của bài kiểm tra trình độ ở các dải trên 1.000 từ', () => {
  it('không trùng bộ 1.000 từ, không trùng nhau, đủ từ cho mỗi dải, nghĩa không trùng trong dải', () => {
    const starter = new Set(parseStarter(readFileSync(fileURLToPath(new URL('./starter/ngsl-1000.txt', import.meta.url)), 'utf8'), 'NGSL').map((i) => termKey(i.term)))
    const all = [...PROBE_B1, ...PROBE_B2, ...PROBE_C1]
    expect(all.filter((w) => starter.has(termKey(w.term))).map((w) => w.term)).toEqual([])
    expect(new Set(all.map((w) => termKey(w.term))).size).toBe(all.length)
    for (const band of [PROBE_B1, PROBE_B2, PROBE_C1]) {
      expect(band.length).toBeGreaterThanOrEqual(12)
      expect(new Set(band.map((w) => w.meaningVi)).size).toBe(band.length)
    }
  })
})
