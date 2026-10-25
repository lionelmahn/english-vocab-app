import { clipParameters, dateDiffInDays, default_w, S_MIN } from 'ts-fsrs'

/**
 * Tối ưu tham số FSRS theo lịch sử ôn của chính người học (R5.13), chạy ngay trên máy (0đ).
 *
 * Mô hình trí nhớ chép đúng công thức của ts-fsrs (bản 5, FSRS-6, 21 tham số), có test so khớp. Mỗi lượt ôn cách
 * lượt trước từ 1 ngày trở lên là một mẫu: dự đoán xác suất nhớ R rồi so với kết quả thật (nhớ = điểm từ Khó trở lên).
 * Hàm mục tiêu là log loss trung bình cộng phạt L2 kéo về tham số mặc định (như fsrs-rs), để ít dữ liệu không làm
 * tham số lệch xa. Tối ưu bằng Adam với đạo hàm sai phân; 4 tham số độ bền ban đầu tối ưu theo log.
 * Chỉ dùng tham số mới khi chúng dự đoán tốt hơn mặc định trên phần dữ liệu để riêng kiểm tra.
 */

/** Chuỗi lượt ôn của một từ, theo thời gian: số ngày cách lượt trước (lượt đầu là 0) và điểm 1–4. */
export interface ReviewSequence {
  delays: number[]
  grades: number[]
}

export interface ScheduleLog {
  itemId: string
  reviewedAt: number
  grade: number | null
  affectsSchedule: boolean
}

/** Cần ít nhất chừng này lượt ôn (cách lượt trước từ 1 ngày) để tối ưu, và đủ cả lượt nhớ lẫn lượt quên. */
export const MIN_REVIEWS = 400
export const MIN_EACH_OUTCOME = 10

/** Độ lệch chuẩn tham khảo của từng tham số (theo fsrs-rs), dùng cho phạt L2. */
const PARAM_STDDEV = [6.43, 9.66, 17.58, 27.85, 0.57, 0.28, 0.6, 0.12, 0.39, 0.18, 0.33, 0.3, 0.09, 0.16, 0.57, 0.25, 1.03, 0.31, 0.32, 0.14, 0.27]
const N_PARAMS = 21
const LOG_PARAMS = 4

/**
 * Gom lượt trả lời có tính lịch thành chuỗi theo từng từ. `since`: ngày tạo thẻ hiện tại của từ (sau khi "Học lại từ
 * đầu", các lượt trước đó thành một chuỗi riêng). Sắp theo mã từ để kết quả không phụ thuộc thứ tự đọc.
 */
export function buildSequences(logs: readonly ScheduleLog[], since: ReadonlyMap<string, number> = new Map()): ReviewSequence[] {
  const groups = new Map<string, ScheduleLog[]>()
  for (const l of logs) {
    if (!l.affectsSchedule || l.grade === null || l.grade < 1 || l.grade > 4) continue
    const start = since.get(l.itemId)
    const key = start !== undefined && l.reviewedAt < start ? `${l.itemId}#old` : l.itemId
    let g = groups.get(key)
    if (!g) groups.set(key, (g = []))
    g.push(l)
  }
  return [...groups.keys()]
    .sort()
    .map((key) => {
      const list = groups.get(key)!.sort((a, b) => a.reviewedAt - b.reviewedAt)
      return {
        delays: list.map((l, i) => (i === 0 ? 0 : dateDiffInDays(new Date(list[i - 1].reviewedAt), new Date(l.reviewedAt)))),
        grades: list.map((l) => l.grade!),
      }
    })
}

export interface DataStats {
  /** Số lượt ôn dùng được (cách lượt trước từ 1 ngày trở lên). */
  reviews: number
  recalled: number
  forgotten: number
}

export function dataStats(seqs: readonly ReviewSequence[]): DataStats {
  let recalled = 0
  let forgotten = 0
  for (const s of seqs) {
    for (let i = 1; i < s.grades.length; i++) {
      if (s.delays[i] <= 0) continue
      if (s.grades[i] > 1) recalled++
      else forgotten++
    }
  }
  return { reviews: recalled + forgotten, recalled, forgotten }
}

export function canOptimize(stats: DataStats): boolean {
  return stats.reviews >= MIN_REVIEWS && stats.recalled >= MIN_EACH_OUTCOME && stats.forgotten >= MIN_EACH_OUTCOME
}

// ---- Mô hình trí nhớ (chép từ ts-fsrs FSRSAlgorithm.next_state) ------------------------------------

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

function curve(w: ArrayLike<number>) {
  const decay = -w[20]
  const factor = Math.pow(0.9, 1 / decay) - 1
  return (t: number, s: number) => Math.pow(1 + (factor * t) / s, decay)
}

const initDifficulty = (w: ArrayLike<number>, g: number) => w[4] - Math.exp((g - 1) * w[5]) + 1

/** Độ khó và độ bền sau từng lượt của một chuỗi (dùng cho test so khớp với ts-fsrs). */
export function memoryStates(w: ArrayLike<number>, seq: ReviewSequence): { d: number; s: number }[] {
  const out: { d: number; s: number }[] = []
  walk(w, seq, (_r, _y, d, s) => out.push({ d, s }))
  return out
}

/**
 * Chạy mô hình qua một chuỗi. `visit(r, y, d, s)` được gọi sau mỗi lượt: r là xác suất nhớ dự đoán ngay trước lượt đó
 * (NaN ở lượt đầu và lượt cùng ngày — không phải mẫu), y = 1 nếu nhớ, (d, s) là trạng thái sau lượt.
 */
function walk(w: ArrayLike<number>, seq: ReviewSequence, visit: (r: number, y: number, d: number, s: number) => void) {
  const R = curve(w)
  const easyD = initDifficulty(w, 4)
  const g0 = seq.grades[0]
  let d = clamp(initDifficulty(w, g0), 1, 10)
  let s = Math.max(w[g0 - 1], 0.1)
  visit(NaN, g0 > 1 ? 1 : 0, d, s)
  for (let i = 1; i < seq.grades.length; i++) {
    const t = seq.delays[i]
    const g = seq.grades[i]
    const r = R(t, s)
    if (t === 0) {
      const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]))
      s = clamp(s * (g >= 2 ? Math.max(sinc, 1) : sinc), S_MIN, 36500)
    } else if (g === 1) {
      const fail = clamp(w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]), S_MIN, 36500)
      s = clamp(s / Math.exp(w[17] * w[18]), S_MIN, fail)
    } else {
      const hard = g === 2 ? w[15] : 1
      const easy = g === 4 ? w[16] : 1
      s = clamp(s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard * easy), S_MIN, 36500)
    }
    const next = d + (-w[6] * (g - 3) * (10 - d)) / 9
    d = clamp(w[7] * easyD + (1 - w[7]) * next, 1, 10)
    visit(t > 0 ? r : NaN, g > 1 ? 1 : 0, d, s)
  }
}

/** Tổng log loss và số mẫu của các chuỗi với tham số `w`. */
export function logLoss(w: ArrayLike<number>, seqs: readonly ReviewSequence[]): { sum: number; count: number } {
  let sum = 0
  let count = 0
  for (const seq of seqs) {
    walk(w, seq, (r, y) => {
      if (Number.isNaN(r)) return
      const p = clamp(r, 1e-6, 1 - 1e-6)
      sum -= y ? Math.log(p) : Math.log(1 - p)
      count++
    })
  }
  return { sum, count }
}

/** Tỷ lệ nhớ thật và xác suất nhớ dự đoán trung bình ở các lượt ôn (từ 1 ngày trở lên). */
export function recallRates(w: ArrayLike<number>, seqs: readonly ReviewSequence[]): { actual: number; predicted: number; count: number } | null {
  let y = 0
  let p = 0
  let n = 0
  for (const seq of seqs) {
    walk(w, seq, (r, yy) => {
      if (Number.isNaN(r)) return
      y += yy
      p += r
      n++
    })
  }
  return n === 0 ? null : { actual: y / n, predicted: p / n, count: n }
}

// ---- Tối ưu ---------------------------------------------------------------------------------------

const DEFAULT_W: readonly number[] = [...default_w]

/** Đưa về miền hợp lệ của ts-fsrs (một bước học lại, có lượt củng cố trong ngày). */
const clip = (w: readonly number[]) => clipParameters([...w], 1, true)

const toTheta = (w: readonly number[]) => w.map((v, i) => (i < LOG_PARAMS ? Math.log(v) : v))
const toW = (theta: readonly number[]) => clip(theta.map((v, i) => (i < LOG_PARAMS ? Math.exp(v) : v)))

function objective(w: readonly number[], seqs: readonly ReviewSequence[], n: number): number {
  let penalty = 0
  for (let i = 0; i < N_PARAMS; i++) penalty += ((w[i] - DEFAULT_W[i]) / PARAM_STDDEV[i]) ** 2
  return (logLoss(w, seqs).sum + penalty) / n
}

export interface OptimizeOptions {
  maxIterations?: number
  /** Báo tiến độ 0–1. */
  onProgress?: (done: number) => void
  /** Nhường luồng chính sau mỗi vòng để giao diện không bị đứng. */
  yieldEvery?: () => Promise<void>
}

/** Tối ưu tham số từ mặc định trên các chuỗi cho sẵn. */
export async function fitWeights(seqs: readonly ReviewSequence[], opts: OptimizeOptions = {}): Promise<number[]> {
  const n = Math.max(1, logLoss(DEFAULT_W, seqs).count)
  const maxIter = opts.maxIterations ?? 250
  let theta = toTheta(clip(DEFAULT_W))
  const m = new Array<number>(N_PARAMS).fill(0)
  const v = new Array<number>(N_PARAMS).fill(0)
  const [b1, b2, eps] = [0.9, 0.999, 1e-8]
  let best = { theta, loss: objective(toW(theta), seqs, n) }
  let stale = 0
  for (let it = 1; it <= maxIter; it++) {
    const grad = theta.map((_, i) => {
      const h = 1e-4 * Math.max(1, Math.abs(theta[i]))
      const up = [...theta]
      const down = [...theta]
      up[i] += h
      down[i] -= h
      return (objective(toW(up), seqs, n) - objective(toW(down), seqs, n)) / (2 * h)
    })
    // Bước học giảm dần theo hình cos, từ 0,04 xuống 0,004.
    const lr = 0.004 + 0.018 * (1 + Math.cos((Math.PI * (it - 1)) / maxIter))
    theta = theta.map((t, i) => {
      m[i] = b1 * m[i] + (1 - b1) * grad[i]
      v[i] = b2 * v[i] + (1 - b2) * grad[i] * grad[i]
      const mh = m[i] / (1 - b1 ** it)
      const vh = v[i] / (1 - b2 ** it)
      return t - (lr * mh) / (Math.sqrt(vh) + eps)
    })
    theta = toTheta(toW(theta))
    const loss = objective(toW(theta), seqs, n)
    if (loss < best.loss - 1e-6) {
      best = { theta, loss }
      stale = 0
    } else if (++stale >= 25) break
    opts.onProgress?.(it / maxIter)
    if (opts.yieldEvery) await opts.yieldEvery()
  }
  opts.onProgress?.(1)
  return toW(best.theta).map((x) => Math.round(x * 1e4) / 1e4)
}

export interface OptimizeResult {
  weights: number[]
  /** Log loss trung bình trên phần dữ liệu kiểm tra: tham số mặc định và tham số mới. */
  defaultLoss: number
  optimizedLoss: number
  /** Mức cải thiện tương đối (0,05 = dự đoán sát hơn 5%). */
  improvement: number
  /** Tham số mới có tốt hơn mặc định không (chỉ dùng khi có). */
  better: boolean
  reviews: number
}

/**
 * Tối ưu và kiểm tra: 4/5 số từ dùng để tối ưu, 1/5 còn lại để so tham số mới với mặc định.
 * Trả về null nếu chưa đủ dữ liệu.
 */
export async function optimizeFsrs(seqs: readonly ReviewSequence[], opts: OptimizeOptions = {}): Promise<OptimizeResult | null> {
  const stats = dataStats(seqs)
  if (!canOptimize(stats)) return null
  const train = seqs.filter((_, i) => i % 5 !== 4)
  const test = seqs.filter((_, i) => i % 5 === 4)
  const weights = await fitWeights(train, opts)
  const mean = (w: readonly number[]) => {
    const { sum, count } = logLoss(w, test)
    return count ? sum / count : 0
  }
  const defaultLoss = mean(DEFAULT_W)
  const optimizedLoss = mean(weights)
  const improvement = defaultLoss > 0 ? (defaultLoss - optimizedLoss) / defaultLoss : 0
  return { weights, defaultLoss, optimizedLoss, improvement, better: optimizedLoss < defaultLoss, reviews: stats.reviews }
}
