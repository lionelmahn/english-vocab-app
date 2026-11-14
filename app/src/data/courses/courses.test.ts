import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCourse, passageParts } from '../../core/courses'
import { COURSES } from '.'

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
const starter = read('../starter/ngsl-1000.txt')
  .trim()
  .split('\n')
  .slice(1)
  .map((l) => l.split('|'))

describe('khóa “1.000 từ thông dụng theo chủ đề”', () => {
  const course = parseCourse('ngsl-chu-de', read('ngsl-chu-de.txt'))
  const info = COURSES.find((c) => c.id === 'ngsl-chu-de')!

  it('có đủ 1.000 từ của bộ khởi đầu, mỗi từ đúng một lần, cùng loại từ, nghĩa, phiên âm', () => {
    const words = course.lessons.flatMap((l) => l.words)
    expect(words).toHaveLength(1000)
    expect(new Set(words.map((w) => w.term.toLowerCase())).size).toBe(1000)
    const byTerm = new Map(starter.map((r) => [r[1], r]))
    for (const w of words) {
      const r = byTerm.get(w.term)!
      expect(r, w.term).toBeDefined()
      expect([w.partOfSpeech, w.meaningVi, w.ipaUs ?? '', w.ipaUk ?? ''], w.term).toEqual([r[2], r[3], r[6], r[7]])
    }
  })

  it('danh mục ghi đúng số bài và số từ', () => {
    expect(info.lessons).toBe(course.lessons.length)
    expect(info.words).toBe(1000)
    expect(course.chapters.length).toBeGreaterThanOrEqual(10)
  })

  it('mỗi bài 8–14 từ, có tên, mục tiêu và đoạn đọc đánh dấu đủ mọi từ của bài', () => {
    for (const l of course.lessons) {
      const tag = `bài ${l.no} ${l.title}`
      expect(l.words.length, tag).toBeGreaterThanOrEqual(8)
      expect(l.words.length, tag).toBeLessThanOrEqual(14)
      expect(l.title, tag).not.toBe('')
      expect(l.goal, tag).toMatch(/^Sau bài này bạn/)
      expect(l.passageVi.length, tag).toBeGreaterThan(40)
      const marked = new Set(passageParts(l.passage).flatMap((p) => (p.term ? [p.term.toLowerCase()] : [])))
      const own = new Set(l.words.map((w) => w.term.toLowerCase()))
      expect([...own].filter((t) => !marked.has(t)), tag).toEqual([])
      expect([...marked].filter((t) => !own.has(t)), tag).toEqual([])
    }
  })
})
