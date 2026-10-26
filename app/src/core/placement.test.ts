import { describe, expect, it } from 'vitest'
import { seededRandom } from './exercises'
import { buildPlacement, knownBands, levelFor, PER_BAND, PLACEMENT_BANDS, scorePlacement, stopAfter, suggestDailyNew, type PlacementWord } from './placement'

const pos = ['noun', 'verb', 'adjective', 'adverb', 'preposition'] as const
const starter: PlacementWord[] = Array.from({ length: 1000 }, (_, i) => ({ term: `w${i + 1}`, partOfSpeech: pos[i % pos.length], meaningVi: `nghĩa ${i + 1}` }))
const probe = (tag: string): PlacementWord[] => Array.from({ length: 12 }, (_, i) => ({ term: `${tag}${i}`, partOfSpeech: i % 2 ? 'verb' : 'adjective', meaningVi: `${tag} nghĩa ${i}` }))

describe('kiểm tra trình độ đầu vào (R1.8)', () => {
  it('mỗi dải 6 câu đúng dải, chỉ hỏi từ có nghĩa rõ; 4 lựa chọn không trùng, có nghĩa đúng', () => {
    const qs = buildPlacement(starter, [probe('b'), probe('c'), probe('d')], seededRandom(7))
    expect(qs).toHaveLength(PLACEMENT_BANDS.length)
    qs.forEach((band) => expect(band).toHaveLength(PER_BAND))
    for (const q of qs[1]) {
      const rank = Number(q.term.slice(1))
      expect(rank).toBeGreaterThanOrEqual(201)
      expect(rank).toBeLessThanOrEqual(400)
      expect(q.partOfSpeech).not.toBe('preposition')
    }
    for (const q of qs.flat()) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
    }
    expect(qs[6].every((q) => q.term.startsWith('c'))).toBe(true)
  })

  it('ước lượng vốn từ theo tỉ lệ đúng từng dải; dải chưa làm tính 0; gợi ý trình độ theo mốc', () => {
    const answers = [
      ...Array.from({ length: 6 }, () => ({ band: 0, correct: true })),
      ...Array.from({ length: 6 }, (_, i) => ({ band: 1, correct: i < 5 })),
      ...Array.from({ length: 6 }, (_, i) => ({ band: 2, correct: i < 2 })),
    ]
    const r = scorePlacement(answers)
    // 200 + 200×5/6 + 200×2/6 = 433 → làm tròn 450.
    expect(r.estimate).toBe(450)
    expect(r.level).toBe('beginner')
    expect(r.bands[3]).toEqual({ label: '601–800', asked: 0, correct: 0 })
    expect(knownBands(r)).toEqual([0, 1])
    expect(stopAfter(2)).toBe(true)
    expect(stopAfter(3)).toBe(false)
    expect([499, 500, 1199, 1200, 2499, 2500, 3999, 4000].map(levelFor)).toEqual(['beginner', 'elementary', 'elementary', 'intermediate', 'intermediate', 'upper_intermediate', 'upper_intermediate', 'advanced'])
  })

  it('số từ mới mỗi ngày: theo trình độ nhưng không quá nửa thời gian học; làm tròn theo lựa chọn có trong app', () => {
    expect(suggestDailyNew('beginner', 30)).toBe(10)
    expect(suggestDailyNew('intermediate', 30)).toBe(20)
    expect(suggestDailyNew('intermediate', 15)).toBe(10)
    expect(suggestDailyNew('elementary', 5)).toBe(5)
  })
})
