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

// Mọi khóa có nội dung (ngoài khóa 1.000 từ ở trên): file đúng khuôn, từ mới không trùng nhau, đoạn đọc đủ từ.
describe('các khóa học khác', () => {
  const starterTerms = new Set(starter.map((r) => r[1].toLowerCase()))
  const extra = COURSES.filter((c) => c.load && c.id !== 'ngsl-chu-de')
  const parsed = extra.map((info) => ({ info, course: parseCourse(info.id, read(`${info.id}.txt`)) }))

  it('danh mục ghi đúng số bài, số từ; mỗi khóa có nguồn và ghi chú giấy phép', () => {
    for (const { info, course } of parsed) {
      expect(info.lessons, info.id).toBe(course.lessons.length)
      expect(info.words, info.id).toBe(course.lessons.reduce((n, l) => n + l.words.length, 0))
      expect(info.attribution && info.source, info.id).toBeTruthy()
    }
  })

  it('từ mới: không có trong bộ 1.000 từ, không trùng trong khóa hay giữa các khóa', () => {
    const owner = new Map<string, string>()
    for (const { info, course } of parsed) {
      for (const w of course.lessons.flatMap((l) => l.words)) {
        const k = w.term.toLowerCase()
        expect(starterTerms.has(k), `${info.id}: ${w.term}`).toBe(false)
        expect(owner.get(k), `${info.id}: ${w.term}`).toBeUndefined()
        owner.set(k, info.id)
      }
    }
  })

  it('mỗi bài 8–14 từ có nghĩa và câu ví dụ kèm bản dịch; đoạn đọc đánh dấu đủ mọi từ của bài', () => {
    for (const { info, course } of parsed) {
      for (const l of course.lessons) {
        const tag = `${info.id} bài ${l.no} ${l.title}`
        expect(l.words.length, tag).toBeGreaterThanOrEqual(8)
        expect(l.words.length, tag).toBeLessThanOrEqual(14)
        expect(l.goal, tag).toMatch(/^Sau bài này bạn/)
        for (const w of l.words) expect([w.meaningVi, w.example?.en, w.example?.vi].every(Boolean), `${tag}: ${w.term}`).toBe(true)
        const marked = new Set(passageParts(l.passage).flatMap((p) => (p.term ? [p.term.toLowerCase()] : [])))
        const own = new Set(l.words.map((w) => w.term.toLowerCase()))
        expect([...own].filter((t) => !marked.has(t)), tag).toEqual([])
        expect([...marked].filter((t) => !own.has(t)), tag).toEqual([])
        expect(l.passageVi.length, tag).toBeGreaterThan(40)
      }
    }
  })
})
