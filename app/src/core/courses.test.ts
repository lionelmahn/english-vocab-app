import { describe, expect, it } from 'vitest'
import { courseProgress, filterCourses, fitsLevel, lessonProgress, parseCourse, passageParts, plainPassage, wordKey, type WordLookup } from './courses'
import { sanitizeProfile } from './profile'
import { foldText } from './vocab'

const TEXT = `# chú thích
H|Ăn uống
L|Bữa sáng|Sau bài này bạn kể được bữa sáng.
W|eat|verb|ăn|I eat rice.|Tôi ăn cơm.|/it/|/iːt/
W|bread|noun|bánh mì|||/brɛd/|
P|I [ate|eat] some [bread] today.
V|Hôm nay tôi ăn một ít bánh mì.
L|Uống gì|Sau bài này bạn gọi được đồ uống.
W|drink|verb|uống
P|We [drink] tea.
V|Chúng tôi uống trà.
H|Đi lại
L|Xe buýt|Sau bài này bạn đi xe buýt.
W|bus|noun|xe buýt
P|The [bus] is late.
V|Xe buýt đến muộn.
`

describe('khóa học', () => {
  const course = parseCourse('test', TEXT)

  it('đọc chương, bài, từ, đoạn đọc; đánh số bài liên tục cả khóa', () => {
    expect(course.chapters.map((c) => c.title)).toEqual(['Ăn uống', 'Đi lại'])
    expect(course.lessons.map((l) => [l.no, l.title, l.chapter])).toEqual([
      [1, 'Bữa sáng', 0],
      [2, 'Uống gì', 0],
      [3, 'Xe buýt', 1],
    ])
    expect(course.lessons[0].words[0]).toEqual({ term: 'eat', partOfSpeech: 'verb', meaningVi: 'ăn', example: { en: 'I eat rice.', vi: 'Tôi ăn cơm.' }, ipaUs: '/it/', ipaUk: '/iːt/' })
    expect(course.lessons[0].words[1]).toMatchObject({ term: 'bread', example: undefined, ipaUs: '/brɛd/', ipaUk: undefined })
    expect(course.lessons[0].passage).toBe('I [ate|eat] some [bread] today.')
    expect(course.lessons[0].passageVi).toBe('Hôm nay tôi ăn một ít bánh mì.')
  })

  it('tách đoạn đọc: chữ trong câu và từ gốc của bài', () => {
    expect(passageParts('I [ate|eat] some [bread].')).toEqual([{ text: 'I ' }, { text: 'ate', term: 'eat' }, { text: ' some ' }, { text: 'bread', term: 'bread' }, { text: '.' }])
    expect(plainPassage('I [ate|eat] some [bread].')).toBe('I ate some bread.')
  })

  it('tiến độ tính từ sổ tay: bài xong khi mọi từ đã học; bài nên học tiếp là bài đầu chưa xong', () => {
    const state = new Map([
      [wordKey('eat', 'verb'), { itemId: 'a', learned: true }],
      [wordKey('Bread', 'noun'), { itemId: 'b', learned: false }],
      [wordKey('drink', 'verb'), { itemId: 'c', learned: true }],
    ])
    const lookup: WordLookup = (term, pos) => state.get(wordKey(term, pos))
    expect(lessonProgress(course.lessons[0], lookup)).toEqual({ learned: 1, saved: 1, total: 2, done: false })
    expect(lessonProgress(course.lessons[1], lookup).done).toBe(true)
    // Cùng chữ nhưng khác loại từ là mục học khác.
    expect(lookup('drink', 'noun')).toBeUndefined()
    expect(courseProgress(course, lookup)).toMatchObject({ lessonsDone: 1, learned: 2, words: 4, started: true, next: { no: 1 } })
    expect(courseProgress(course, () => undefined)).toMatchObject({ started: false, next: { no: 1 } })
    expect(courseProgress(course, () => ({ itemId: 'x', learned: true })).next).toBeUndefined()
  })

  it('lọc theo nhóm, bậc, chữ tìm không dấu; nhãn “Hợp với bạn” theo trình độ trong hồ sơ', () => {
    const list = [
      { id: 'a', title: '1.000 từ theo chủ đề', description: 'nền tảng', topics: ['gia đình'], group: 'foundation' as const, levels: ['A1' as const, 'A2' as const] },
      { id: 'b', title: 'Du lịch', description: 'sân bay, khách sạn', topics: ['du lịch'], group: 'communication' as const, levels: ['A2' as const, 'B1' as const] },
    ]
    expect(filterCourses(list, { group: 'communication', fold: foldText }).map((c) => c.id)).toEqual(['b'])
    expect(filterCourses(list, { level: 'A1', fold: foldText }).map((c) => c.id)).toEqual(['a'])
    expect(filterCourses(list, { query: 'khach san', fold: foldText }).map((c) => c.id)).toEqual(['b'])
    expect(fitsLevel(['A1', 'A2'], 'beginner')).toBe(true)
    expect(fitsLevel(['B2', 'C1'], 'beginner')).toBe(false)
    expect(fitsLevel(['A1'], undefined)).toBe(false)
  })

  it('khóa đang học lưu trong hồ sơ được làm sạch', () => {
    expect(sanitizeProfile({ course: { id: 'ngsl-chu-de', lesson: 4 } }).course).toEqual({ id: 'ngsl-chu-de', lesson: 4 })
    expect(sanitizeProfile({ course: { id: 'x y', lesson: 4 } }).course).toBeUndefined()
    expect(sanitizeProfile({ course: { id: 'ok', lesson: -3 } }).course).toEqual({ id: 'ok', lesson: 1 })
    expect(sanitizeProfile({}).course).toBeUndefined()
  })
})
