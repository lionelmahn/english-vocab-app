/**
 * Chấm phát âm (R7.3) bằng nhận dạng giọng nói: so chữ máy nghe được với từ hoặc câu cần đọc. Không chấm từng âm;
 * chỉ cho biết máy nghe ra chữ gì, gần đúng hay khác hẳn.
 */

export type PronounceVerdict = 'match' | 'close' | 'miss' | 'empty'

export interface PronounceResult {
  verdict: PronounceVerdict
  /** Chữ máy nghe được (nguyên văn). */
  heard: string
  /** Câu: từng chữ của câu cần đọc và máy có nghe ra chữ đó không. */
  words?: { text: string; ok: boolean }[]
  /** Máy nghe ra một từ đồng âm (đọc giống hệt): vẫn tính là đúng. */
  homophone?: string
}

/** Từ đọc giống hệt nhau: máy chọn cách viết nào cũng là đọc đúng. */
const HOMOPHONES: readonly string[][] = [
  ['right', 'write'], ['hear', 'here'], ['week', 'weak'], ['sea', 'see'], ['son', 'sun'], ['buy', 'by', 'bye'], ['to', 'too', 'two'],
  ['know', 'no'], ['one', 'won'], ['hour', 'our'], ['piece', 'peace'], ['wait', 'weight'], ['whole', 'hole'], ['their', 'there', "they're"],
  ['your', "you're"], ['its', "it's"], ['whose', "who's"], ['wear', 'where'], ['bear', 'bare'], ['role', 'roll'], ['site', 'sight', 'cite'],
  ['meet', 'meat'], ['flower', 'flour'], ['mail', 'male'], ['sale', 'sail'], ['pair', 'pear'], ['plane', 'plain'], ['road', 'rode'],
  ['tail', 'tale'], ['weather', 'whether'], ['would', 'wood'], ['night', 'knight'], ['new', 'knew'], ['four', 'for'], ['eight', 'ate'],
  ['blue', 'blew'], ['break', 'brake'], ['cell', 'sell'], ['dear', 'deer'], ['fair', 'fare'], ['great', 'grate'], ['hair', 'hare'],
  ['higher', 'hire'], ['made', 'maid'], ['steal', 'steel'], ['sum', 'some'], ['threw', 'through'], ['waste', 'waist'], ['way', 'weigh'],
  ['red', 'read'], ['led', 'lead'], ['allowed', 'aloud'], ['board', 'bored'], ['passed', 'past'], ['principal', 'principle'], ['wore', 'war'],
]

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** Số máy viết bằng chữ số (máy nghe "three" thành "3"): đổi lại thành chữ để so. */
function numberWords(n: number): string[] {
  if (n < 20) return [ONES[n]]
  if (n < 100) return [TENS[Math.floor(n / 10)], ...(n % 10 ? [ONES[n % 10]] : [])]
  if (n < 1000) return [ONES[Math.floor(n / 100)], 'hundred', ...(n % 100 ? numberWords(n % 100) : [])]
  return [String(n)]
}

/** Tách thành từng chữ thường: bỏ dấu câu, giữ dấu nháy trong chữ (it's), tách gạch nối, đổi số thành chữ. */
export function speechTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]+/g, ' ')
    .split(/[\s-]+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .flatMap((t) => (/^\d+$/.test(t) ? numberWords(Number(t)) : [t]))
}

function sameWord(a: string, b: string): boolean {
  return a === b || HOMOPHONES.some((g) => g.includes(a) && g.includes(b))
}

/** Khoảng cách chỉnh sửa giữa hai chuỗi (số chữ cái phải thêm, bớt, thay). */
export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

/** Câu dài từ 4 chữ: so từng chữ (dãy con chung dài nhất); nghe ra đủ mọi chữ mới là đúng, từ 70% là gần đúng. */
function judgeSentence(target: string[], heard: string[], raw: string): PronounceResult {
  const dp = Array.from({ length: target.length + 1 }, () => new Array<number>(heard.length + 1).fill(0))
  for (let i = target.length - 1; i >= 0; i--)
    for (let j = heard.length - 1; j >= 0; j--) dp[i][j] = sameWord(target[i], heard[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ok = new Array<boolean>(target.length).fill(false)
  let i = 0
  let j = 0
  while (i < target.length && j < heard.length) {
    if (sameWord(target[i], heard[j])) {
      ok[i] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  const score = ok.filter(Boolean).length / target.length
  return { verdict: score === 1 ? 'match' : score >= 0.7 ? 'close' : 'miss', heard: raw, words: target.map((text, k) => ({ text, ok: ok[k] })) }
}

/**
 * Chấm một lần đọc. Từ hoặc cụm ngắn: máy nghe ra đúng (kể cả từ đồng âm) là "match"; chữ gần giống (khác một hai chữ
 * cái, như rise và rice) là "close"; còn lại "miss". Câu: theo tỉ lệ chữ máy nghe ra. Không nghe thấy gì: "empty".
 */
export function judgePronunciation(target: string, heardText: string): PronounceResult {
  const t = speechTokens(target)
  const h = speechTokens(heardText)
  const raw = heardText.trim()
  if (h.length === 0 || t.length === 0) return { verdict: 'empty', heard: raw }
  if (t.length >= 4) return judgeSentence(t, h, raw)
  for (let k = 0; k + t.length <= h.length; k++) {
    if (t.every((w, n) => w === h[k + n])) return { verdict: 'match', heard: raw }
    if (t.every((w, n) => sameWord(w, h[k + n]))) return { verdict: 'match', heard: raw, homophone: h.slice(k, k + t.length).join(' ') }
  }
  // Gần đúng: đoạn chữ nghe được (cùng số chữ) giống cách viết ít nhất 60%.
  const goal = t.join(' ')
  let best = 0
  for (let k = 0; k + t.length <= h.length; k++) {
    const got = h.slice(k, k + t.length).join(' ')
    best = Math.max(best, 1 - editDistance(goal, got) / Math.max(goal.length, got.length))
  }
  return { verdict: best >= 0.6 ? 'close' : 'miss', heard: raw }
}
