import { shuffle } from './exercises'
import type { PartOfSpeech } from './pos'
import type { SelfLevel } from './profile'
import { meaningKey } from './vocab'

/**
 * Kiểm tra trình độ đầu vào (R1.8): trắc nghiệm nghĩa theo các dải tần suất. Năm dải đầu là bộ 1.000 từ thông dụng
 * (mỗi dải 200 từ), ba dải sau là từ khó hơn (khoảng B1, B2, C1). Từ số câu đúng mỗi dải, ước lượng vốn từ, gợi ý trình
 * độ, số từ mới mỗi ngày và các dải trong bộ 1.000 từ có thể đánh dấu đã biết.
 */

export interface PlacementBand {
  label: string
  /** Số từ dải này đại diện, dùng để ước lượng vốn từ. */
  size: number
  /** Dải trong bộ 1.000 từ: hạng từ (tính từ 1) đầu và cuối. */
  ranks?: [number, number]
}

export const PLACEMENT_BANDS: readonly PlacementBand[] = [
  { label: '1–200', size: 200, ranks: [1, 200] },
  { label: '201–400', size: 200, ranks: [201, 400] },
  { label: '401–600', size: 200, ranks: [401, 600] },
  { label: '601–800', size: 200, ranks: [601, 800] },
  { label: '801–1.000', size: 200, ranks: [801, 1000] },
  { label: '1.000–2.000', size: 1000 },
  { label: '2.000–3.500', size: 1500 },
  { label: '3.500–6.000', size: 2500 },
]

/** Số câu mỗi dải; trả lời đúng từ 2 câu trở xuống thì dừng (dải sau càng khó). */
export const PER_BAND = 6
const STOP_AT = 2

export interface PlacementWord {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
}

export interface PlacementQuestion {
  band: number
  term: string
  partOfSpeech: PartOfSpeech
  answer: string
  options: string[]
}

/** Chỉ hỏi từ có nghĩa rõ (danh từ, động từ, tính từ, trạng từ); bỏ mạo từ, giới từ, đại từ. */
const ASKED: readonly PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb']

/** Ba nghĩa sai lấy từ các từ khác, ưu tiên cùng loại từ, không trùng nghĩa đúng. */
function distractors(word: PlacementWord, pool: readonly PlacementWord[], rand: () => number): string[] {
  const key = meaningKey(word.meaningVi)
  const others = pool.filter((w) => w.term !== word.term && meaningKey(w.meaningVi) !== key)
  const out: string[] = []
  for (const w of [...shuffle(others.filter((o) => o.partOfSpeech === word.partOfSpeech), rand), ...shuffle(others, rand)]) {
    if (!out.some((m) => meaningKey(m) === meaningKey(w.meaningVi))) out.push(w.meaningVi)
    if (out.length === 3) break
  }
  return out
}

/**
 * Câu hỏi cho từng dải. `starter`: bộ 1.000 từ theo đúng thứ tự hạng; `probes`: từ của ba dải khó hơn. Nghĩa sai của
 * dải trong bộ 1.000 từ lấy từ cả bộ; của dải khó hơn lấy từ chính dải đó.
 */
export function buildPlacement(starter: readonly PlacementWord[], probes: readonly (readonly PlacementWord[])[], rand: () => number = Math.random): PlacementQuestion[][] {
  return PLACEMENT_BANDS.map((band, b) => {
    const pool = band.ranks ? starter.slice(band.ranks[0] - 1, band.ranks[1]) : (probes[b - PLACEMENT_BANDS.findIndex((x) => !x.ranks)] ?? [])
    const choices = band.ranks ? starter : pool
    return shuffle(
      pool.filter((w) => ASKED.includes(w.partOfSpeech)),
      rand,
    )
      .slice(0, PER_BAND)
      .map((w) => ({ band: b, term: w.term, partOfSpeech: w.partOfSpeech, answer: w.meaningVi, options: shuffle([w.meaningVi, ...distractors(w, choices, rand)], rand) }))
  })
}

/** Dừng sau dải này: trả lời đúng quá ít (từ 2 câu trở xuống). */
export function stopAfter(correct: number): boolean {
  return correct <= STOP_AT
}

export interface PlacementResult {
  bands: { label: string; asked: number; correct: number }[]
  /** Vốn từ ước lượng (làm tròn đến 50). */
  estimate: number
  level: SelfLevel
}

/** Ước lượng vốn từ: mỗi dải = tỉ lệ đúng × số từ của dải (dải chưa hỏi vì đã dừng thì tính 0). */
export function scorePlacement(answers: readonly { band: number; correct: boolean }[]): PlacementResult {
  const bands = PLACEMENT_BANDS.map((b, i) => {
    const own = answers.filter((a) => a.band === i)
    return { label: b.label, asked: own.length, correct: own.filter((a) => a.correct).length }
  })
  const raw = bands.reduce((sum, b, i) => sum + (b.asked ? (b.correct / b.asked) * PLACEMENT_BANDS[i].size : 0), 0)
  const estimate = Math.round(raw / 50) * 50
  return { bands, estimate, level: levelFor(estimate) }
}

/** Trình độ theo vốn từ ước lượng (mốc thường dùng: A1 khoảng 500 từ, A2 1.000, B1 2.000, B2 3.000–4.000, C1 5.000+). */
export function levelFor(estimate: number): SelfLevel {
  if (estimate < 500) return 'beginner'
  if (estimate < 1200) return 'elementary'
  if (estimate < 2500) return 'intermediate'
  if (estimate < 4000) return 'upper_intermediate'
  return 'advanced'
}

/** Dải trong bộ 1.000 từ trả lời đúng gần hết (từ 5/6): gợi ý đánh dấu đã biết. */
export function knownBands(result: PlacementResult): number[] {
  return result.bands.flatMap((b, i) => (PLACEMENT_BANDS[i].ranks && b.asked >= PER_BAND && b.correct >= PER_BAND - 1 ? [i] : []))
}

export const NEW_WORD_OPTIONS = [5, 10, 15, 20, 30]

/**
 * Số từ mới mỗi ngày gợi ý: theo trình độ (mới bắt đầu ít hơn), nhưng không quá nửa thời gian học mỗi ngày
 * (mỗi từ mới kèm lượt ôn về sau khoảng 45 giây). Làm tròn xuống theo các lựa chọn trong app.
 */
export function suggestDailyNew(level: SelfLevel, dailyMinutes: number): number {
  const byLevel = level === 'beginner' ? 10 : level === 'elementary' ? 15 : 20
  const byTime = Math.floor((dailyMinutes * 60 * 0.5) / 45)
  const want = Math.max(5, Math.min(byLevel, byTime))
  return [...NEW_WORD_OPTIONS].reverse().find((n) => n <= want) ?? 5
}
