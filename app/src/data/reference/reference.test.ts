import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EXAMPLE_LEVELS, parseConfusables, parseLevelExamples, parseWordReference, splitMarked } from '../../core/reference'
import { termKey } from '../../core/vocab'
import { parseStarter } from '../starter'

/** Kiểm tra nội dung soạn sẵn thật cho bộ 1.000 từ, như app sẽ đọc. */

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8')
const starter = parseStarter(read('../starter/ngsl-1000.txt'), 'NGSL')
const words = parseWordReference(read('./words.txt'))
const levels = parseLevelExamples(read('./levels.txt'))
const groups = parseConfusables(read('./confusables.txt'))

describe('nội dung soạn sẵn cho bộ 1.000 từ', () => {
  it('mỗi file không có dòng lạ, không có cột thiếu', () => {
    const shape: Record<string, Record<string, number>> = {
      'words.txt': { T: 3, C: 6, M: 2 },
      'levels.txt': { T: 2, E: 4 },
      'confusables.txt': { G: 4, W: 4, X: 4 },
    }
    for (const [file, cols] of Object.entries(shape)) {
      const bad = read(`./${file}`)
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('#'))
        .filter((l) => cols[l.split('|')[0]] !== l.split('|').length)
      expect(bad, file).toEqual([])
    }
  })

  it('đủ 1.000 từ, cùng loại từ với bộ khởi đầu; mỗi từ có 3–5 kết hợp từ và câu ví dụ đủ ba trình độ', () => {
    expect(words.size).toBe(1000)
    expect(levels.size).toBe(1000)
    for (const it of starter) {
      const ref = words.get(termKey(it.term))
      expect(ref, it.term).toBeDefined()
      expect(ref!.partOfSpeech, it.term).toBe(it.partOfSpeech)
      expect(ref!.collocations.length, it.term).toBeGreaterThanOrEqual(3)
      expect(ref!.collocations.length, it.term).toBeLessThanOrEqual(5)
      for (const c of ref!.collocations) expect(c.en && c.vi && (!c.ex || c.exVi), `${it.term}: ${c.en}`).toBeTruthy()
      expect(
        levels.get(termKey(it.term))?.map((e) => e.level),
        it.term,
      ).toEqual([...EXAMPLE_LEVELS])
    }
  })

  it('khoảng một nửa đến hai phần ba số từ có mẹo nhớ (bỏ qua từ quá cơ bản)', () => {
    const n = [...words.values()].filter((w) => w.mnemonic).length
    expect(n).toBeGreaterThan(400)
    expect(n).toBeLessThan(1000)
  })

  it('nhóm từ dễ nhầm: 2–4 từ, mỗi từ có 2 câu đánh dấu đúng một chỗ; nhóm không lặp', () => {
    expect(groups.length).toBeGreaterThanOrEqual(240)
    const keys = new Set<string>()
    for (const g of groups) {
      const name = g.words.join(' / ')
      expect(g.words.length, name).toBeGreaterThanOrEqual(2)
      expect(g.words.length, name).toBeLessThanOrEqual(4)
      expect(g.summary, name).toBeTruthy()
      for (const it of g.items) {
        expect(it.meaning && it.usage, `${name}: ${it.word}`).toBeTruthy()
        expect(it.examples, `${name}: ${it.word}`).toHaveLength(2)
        for (const e of it.examples) {
          expect(e.en.match(/\[/g)?.length, e.en).toBe(1)
          expect(splitMarked(e.en).form, e.en).toBeTruthy()
          expect(e.vi, e.en).not.toMatch(/\[|\]/)
          for (const w of e.also ?? [])
            expect(
              g.words.filter((x) => x !== it.word),
              `${e.en}: ${w}`,
            ).toContain(w)
        }
      }
      const key = g.words.map(termKey).sort().join('/')
      expect(keys.has(key), name).toBe(false)
      keys.add(key)
    }
  })

  it('hầu hết nhóm hiện được ở trang của một từ trong bộ 1.000 từ (chứa từ đó hoặc ghi là từ liên quan)', () => {
    const terms = new Set(starter.map((it) => termKey(it.term)))
    for (const g of groups) for (const r of g.related) expect(terms.has(termKey(r)), `${g.words.join(' / ')}: ${r}`).toBe(true)
    const orphan = groups.filter((g) => ![...g.words, ...g.related].some((w) => terms.has(termKey(w)))).map((g) => g.words.join(' / '))
    expect(orphan.length).toBeLessThanOrEqual(5)
  })
})
