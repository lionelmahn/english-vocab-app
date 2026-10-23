/**
 * Chuẩn hóa và so khớp đáp án gõ tay (R6.7).
 * Biến thể Anh–Anh/Anh–Mỹ (colour/color) được chấp nhận qua danh sách đáp án của từng mục học,
 * không tự suy đoán, để tránh nhận nhầm từ khác (four/for).
 */

export function normalizeAnswer(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:]+$/u, '')
}

/** Khoảng cách Damerau–Levenshtein (bản OSA): thêm, bớt, thay hoặc đảo 2 ký tự liền nhau. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
  for (let i = 0; i < rows; i++) d[i][0] = i
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/**
 * Từ ngắn hơn mức này không xét "gần đúng": với từ ngắn, sai 1 ký tự thường ra một từ khác
 * (cat/car, four/for). "Gần đúng" chỉ là gợi ý; người học quyết định có chấp nhận hay không.
 */
export const NEAR_MATCH_MIN_LENGTH = 5

export type AnswerVerdict =
  | { verdict: 'correct'; matched: string }
  | { verdict: 'near'; matched: string }
  | { verdict: 'wrong' }

export function checkAnswer(input: string, accepted: readonly string[]): AnswerVerdict {
  const given = normalizeAnswer(input)
  if (!given) return { verdict: 'wrong' }
  const targets = accepted.map((a) => ({ raw: a, norm: normalizeAnswer(a) })).filter((t) => t.norm)
  const exact = targets.find((t) => t.norm === given)
  if (exact) return { verdict: 'correct', matched: exact.raw }
  const near = targets.find((t) => t.norm.length >= NEAR_MATCH_MIN_LENGTH && editDistance(t.norm, given) === 1)
  if (near) return { verdict: 'near', matched: near.raw }
  return { verdict: 'wrong' }
}
