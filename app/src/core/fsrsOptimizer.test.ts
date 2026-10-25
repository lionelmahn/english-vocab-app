import { describe, expect, it } from 'vitest'
import { default_w, FSRSAlgorithm, generatorParameters, Rating, type Grade } from 'ts-fsrs'
import { seededRandom } from './exercises'
import { buildSequences, canOptimize, dataStats, logLoss, memoryStates, MIN_REVIEWS, optimizeFsrs, recallRates, type ReviewSequence } from './fsrsOptimizer'

const DAY = 86_400_000
const T0 = Date.parse('2026-01-05T09:00:00Z')

/** Tham số "thật" khác mặc định: quên nhanh hơn, độ bền tăng chậm hơn. */
const TRUE_W = [...default_w]
TRUE_W[0] = 0.5
TRUE_W[2] = 1.2
TRUE_W[8] = 1.3
TRUE_W[10] = 1.1
TRUE_W[20] = 0.35

/** Sinh dữ liệu giả từ một mô hình: mỗi từ học một lượt, rồi ôn cách nhau 1–90 ngày, nhớ hay quên theo R của mô hình. */
function simulate(w: number[], words: number, reviewsPerWord: number, seed: number): ReviewSequence[] {
  const rand = seededRandom(seed)
  const alg = new FSRSAlgorithm(generatorParameters({ w, enable_short_term: true }))
  const out: ReviewSequence[] = []
  for (let k = 0; k < words; k++) {
    const delays = [0]
    const grades: number[] = [rand() < 0.15 ? 1 : 3]
    let state = alg.next_state(null, 0, grades[0] as Grade)
    for (let i = 1; i < reviewsPerWord; i++) {
      const t = Math.max(1, Math.round(Math.exp(rand() * Math.log(90))))
      const r = alg.forgetting_curve(t, state.stability)
      const recalled = rand() < r
      const g = recalled ? (rand() < 0.15 ? 2 : rand() < 0.1 ? 4 : 3) : 1
      state = alg.next_state(state, t, g as Grade)
      delays.push(t)
      grades.push(g)
    }
    out.push({ delays, grades })
  }
  return out
}

describe('mô hình trí nhớ khớp ts-fsrs', () => {
  it('độ khó và độ bền sau từng lượt giống FSRSAlgorithm.next_state, kể cả lượt cùng ngày và lượt quên', () => {
    const rand = seededRandom(3)
    for (const w of [[...default_w], TRUE_W]) {
      const alg = new FSRSAlgorithm(generatorParameters({ w, enable_short_term: true }))
      for (let k = 0; k < 40; k++) {
        const n = 2 + Math.floor(rand() * 8)
        const seq: ReviewSequence = { delays: [0], grades: [1 + Math.floor(rand() * 4)] }
        for (let i = 1; i < n; i++) {
          seq.delays.push(rand() < 0.25 ? 0 : 1 + Math.floor(rand() * 40))
          seq.grades.push(1 + Math.floor(rand() * 4))
        }
        const mine = memoryStates(w, seq)
        let ref = alg.next_state(null, 0, seq.grades[0] as Grade)
        expect(mine[0].s).toBeCloseTo(ref.stability, 6)
        expect(mine[0].d).toBeCloseTo(ref.difficulty, 6)
        for (let i = 1; i < n; i++) {
          ref = alg.next_state(ref, seq.delays[i], seq.grades[i] as Grade)
          expect(mine[i].s / ref.stability).toBeCloseTo(1, 5)
          expect(mine[i].d).toBeCloseTo(ref.difficulty, 5)
        }
      }
    }
  })
})

describe('dữ liệu để tối ưu', () => {
  it('gom lượt có tính lịch theo từ, tính số ngày theo ngày lịch như ts-fsrs, tách lượt trước khi học lại', () => {
    const logs = [
      { itemId: 'b', reviewedAt: T0, grade: 3, affectsSchedule: true },
      { itemId: 'a', reviewedAt: T0 + 2 * DAY + 5 * 3600_000, grade: 3, affectsSchedule: true },
      { itemId: 'a', reviewedAt: T0, grade: 3, affectsSchedule: true },
      { itemId: 'a', reviewedAt: T0 + 600_000, grade: 1, affectsSchedule: false },
      { itemId: 'a', reviewedAt: T0 + 3 * DAY, grade: null, affectsSchedule: true },
      { itemId: 'b', reviewedAt: T0 + 10 * DAY, grade: 1, affectsSchedule: true },
      { itemId: 'b', reviewedAt: T0 + 11 * DAY, grade: 3, affectsSchedule: true },
    ]
    const seqs = buildSequences(logs, new Map([['b', T0 + 11 * DAY]]))
    expect(seqs).toEqual([
      { delays: [0, 2], grades: [3, 3] },
      { delays: [0], grades: [3] },
      { delays: [0, 10], grades: [3, 1] },
    ])
    expect(dataStats(seqs)).toEqual({ reviews: 2, recalled: 1, forgotten: 1 })
    expect(canOptimize(dataStats(seqs))).toBe(false)
  })
})

describe('tối ưu tham số (R5.13)', () => {
  it('chưa đủ lượt ôn thì không tối ưu', async () => {
    const few = simulate([...default_w], 30, 5, 1)
    expect(dataStats(few).reviews).toBeLessThan(MIN_REVIEWS)
    expect(await optimizeFsrs(few)).toBeNull()
  })

  it('với dữ liệu sinh từ tham số khác mặc định: tham số mới dự đoán tốt hơn mặc định trên phần kiểm tra', async () => {
    const seqs = simulate(TRUE_W, 300, 6, 11)
    const progress: number[] = []
    const res = (await optimizeFsrs(seqs, { maxIterations: 120, onProgress: (p) => progress.push(p) }))!
    expect(res).not.toBeNull()
    expect(res.better).toBe(true)
    expect(res.improvement).toBeGreaterThan(0.04)
    expect(res.weights).toHaveLength(21)
    expect(res.weights.every(Number.isFinite)).toBe(true)
    expect(progress.at(-1)).toBe(1)
    // Gần với mô hình thật hơn mặc định trên toàn bộ dữ liệu.
    const mean = (w: number[]) => logLoss(w, seqs).sum / logLoss(w, seqs).count
    expect(mean(res.weights)).toBeLessThan(mean([...default_w]))
    expect(mean(res.weights) - mean(TRUE_W)).toBeLessThan(0.01)
    // Dùng được ngay cho ts-fsrs.
    const alg = new FSRSAlgorithm(generatorParameters({ w: res.weights, enable_short_term: true }))
    expect(alg.next_state(null, 0, Rating.Good).stability).toBeGreaterThan(0)
  }, 30_000)

  it('tỷ lệ nhớ thật và dự đoán', () => {
    const seqs = simulate(TRUE_W, 200, 5, 5)
    const truth = recallRates(TRUE_W, seqs)!
    expect(Math.abs(truth.actual - truth.predicted)).toBeLessThan(0.04)
    expect(recallRates(TRUE_W, [])).toBeNull()
  })
})
