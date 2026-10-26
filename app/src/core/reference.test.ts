import { describe, expect, it } from 'vitest'
import { confusableQuiz, groupsWith, levelOrder, markWord, parseConfusables, parseLevelExamples, parseWordReference, plainSentence, sameSense, searchGroups, splitMarked } from './reference'

const WORDS = `# chú thích
T|decision|noun
C|col|make a decision|đưa ra quyết định|We need to make a decision today.|Hôm nay chúng ta cần quyết định.
C|prep|decision on sth|quyết định về việc gì||
M|Decision: de + cide (cắt) → cắt bỏ các lựa chọn khác.
T|the|other
C|pattern|the + superlative|nhất (so sánh nhất)|She is the best student.|Cô ấy là học sinh giỏi nhất.
C|wrong|odd|lạ||
`

const CONFUSABLES = `G|g1|borrow là mượn về, lend là cho mượn.
W|borrow|mượn|borrow sth from sb
X|Can I [borrow] your pen?|Tớ mượn bút được không?
X|She [borrowed] a book from the library.|Cô ấy mượn sách thư viện.
W|lend|cho mượn|lend sb sth
X|Could you [lend] me your pen?|Cậu cho tớ mượn bút nhé?
X|He [lent] his car to a friend.|Anh ấy cho bạn mượn xe.|borrow; nope
G|g2|Viết khác nhau: week là tuần, weak là yếu.|weekend
W|week|tuần|next week
X|See you next [week].|Hẹn tuần sau.
W|weak|yếu|feel weak
X|I felt [weak] after the flu.|Tôi thấy yếu sau trận cúm.
`

describe('nội dung soạn sẵn', () => {
  it('đọc file kết hợp từ và mẹo nhớ theo từng từ', () => {
    const map = parseWordReference(WORDS)
    const d = map.get('decision')!
    expect(d.partOfSpeech).toBe('noun')
    expect(d.collocations).toEqual([
      {
        kind: 'col',
        en: 'make a decision',
        vi: 'đưa ra quyết định',
        ex: 'We need to make a decision today.',
        exVi: 'Hôm nay chúng ta cần quyết định.',
      },
      {
        kind: 'prep',
        en: 'decision on sth',
        vi: 'quyết định về việc gì',
        ex: undefined,
        exVi: undefined,
      },
    ])
    expect(d.mnemonic).toMatch(/^Decision/)
    // Kiểu lạ thành "Cụm từ"; từ không có mẹo nhớ thì để trống.
    expect(map.get('the')!.collocations[1].kind).toBe('col')
    expect(map.get('the')!.mnemonic).toBeUndefined()
    expect(map.has('# chú thích')).toBe(false)
  })

  it('đọc câu ví dụ theo trình độ, bỏ trình độ lạ', () => {
    const map = parseLevelExamples('T|Decision\nE|A2|I made a decision.|Tôi đã quyết định.\nE|C2|x|y\nE|B2|A hard decision was made.|Một quyết định khó đã được đưa ra.')
    expect(map.get('decision')!.map((e) => e.level)).toEqual(['A2', 'B2'])
  })

  it('đọc nhóm từ dễ nhầm, tìm nhóm theo từ và theo chữ không dấu', () => {
    const groups = parseConfusables(CONFUSABLES)
    expect(groups.map((g) => g.words)).toEqual([
      ['borrow', 'lend'],
      ['week', 'weak'],
    ])
    expect(groups[0].items[1].examples).toHaveLength(2)
    expect(groupsWith(groups, 'Lend').map((g) => g.id)).toEqual(['g1'])
    expect(groupsWith(groups, 'len')).toEqual([])
    expect(groupsWith(groups, 'weekend').map((g) => g.id)).toEqual(['g2'])
    expect(groups[0].related).toEqual([])
    expect(searchGroups(groups, 'WEAK').map((g) => g.id)).toEqual(['g2'])
    expect(searchGroups(groups, 'cho muon').map((g) => g.id)).toEqual(['g1'])
    expect(searchGroups(groups, '')).toHaveLength(2)
  })

  it('tách câu có [từ] và làm câu hỏi chọn từ đúng', () => {
    expect(splitMarked('He [lent] me a car.')).toEqual({
      before: 'He ',
      form: 'lent',
      after: ' me a car.',
    })
    expect(splitMarked('No mark.')).toEqual({
      before: 'No mark.',
      form: '',
      after: '',
    })
    expect(plainSentence('He [lent] me a car.')).toBe('He lent me a car.')
    const group = parseConfusables(CONFUSABLES)[0]
    const quiz = confusableQuiz(group, () => 0)
    expect(quiz).toHaveLength(4)
    expect(quiz.every((q) => q.options.join() === 'borrow,lend')).toBe(true)
    // Từ khác cũng đúng (chỉ nhận từ trong nhóm).
    expect(quiz.find((q) => q.sentence.includes('[lent]'))!.accept).toEqual(['lend', 'borrow'])
    expect(quiz.find((q) => q.sentence.includes('[lend]'))!.accept).toEqual(['lend'])
    expect(
      quiz
        .filter((q) => q.answer === 'lend')
        .map((q) => splitMarked(q.sentence).form)
        .sort(),
    ).toEqual(['lend', 'lent'])
  })

  it('đánh dấu từ trong câu AI chưa đánh dấu', () => {
    expect(markWord('Could you lend me a pen?', 'lend')).toBe('Could you [lend] me a pen?')
    expect(markWord('She is lending money.', 'lend')).toBe('She is [lending] money.')
    expect(markWord('They decided to take part in it.', 'take part in')).toBe('They decided to [take part in] it.')
    expect(markWord('Already [marked] here.', 'mark')).toBe('Already [marked] here.')
    expect(markWord('He lent me a pen.', 'lend')).toBeNull()
  })

  it('xếp câu soạn sẵn theo trình độ người học; mẹo, câu chỉ dùng khi cùng loại từ', () => {
    expect(levelOrder('A1')).toEqual(['A2', 'B1', 'B2'])
    expect(levelOrder('B1')).toEqual(['B1', 'A2', 'B2'])
    expect(levelOrder('C1')).toEqual(['B2', 'B1', 'A2'])
    const ref = parseWordReference(WORDS).get('decision')
    expect(sameSense(ref, 'noun')).toBe(true)
    expect(sameSense(ref, 'verb')).toBe(false)
    expect(sameSense(undefined, 'noun')).toBe(false)
  })
})
