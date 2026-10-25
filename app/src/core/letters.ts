/**
 * Ô chữ cho dạng bài "Điền từ": mỗi chữ cái một ô, khoảng trắng và dấu (', -, .) giữ cố định.
 * Người học chỉ gõ chữ cái; dấu và khoảng trắng tự chèn vào khi ghép đáp án.
 */

export type Slot = { kind: 'letter'; char: string } | { kind: 'fixed'; char: string }

const LETTER = /[\p{L}\p{N}]/u

export function slotTemplate(term: string): Slot[] {
  const clean = term.trim().replace(/\s+/g, ' ')
  return [...clean].map((char) => (LETTER.test(char) ? { kind: 'letter', char } : { kind: 'fixed', char }))
}

export function letterCount(template: readonly Slot[]): number {
  return template.filter((s) => s.kind === 'letter').length
}

/** Chỉ giữ chữ cái/số từ chuỗi người học gõ (bỏ khoảng trắng, dấu). */
export function lettersOnly(typed: string): string[] {
  return [...typed.normalize('NFC')].filter((c) => LETTER.test(c))
}

/** Chữ hiện ở từng ô: chữ đã gõ, `null` nếu ô chữ còn trống, hoặc ký tự cố định. */
export function fillSlots(template: readonly Slot[], typed: string): (string | null)[] {
  const letters = lettersOnly(typed)
  let i = 0
  return template.map((s) => (s.kind === 'fixed' ? s.char : (letters[i++] ?? null)))
}

/**
 * Ghép đáp án từ chữ đã gõ, chèn lại khoảng trắng và dấu theo mẫu.
 * Gõ dư chữ thì nối vào cuối để vẫn chấm được (ví dụ biến thể dài hơn).
 */
export function composeAnswer(template: readonly Slot[], typed: string): string {
  const letters = lettersOnly(typed)
  let i = 0
  let out = ''
  for (const s of template) {
    if (s.kind === 'fixed') {
      if (i < letters.length) out += s.char
    } else if (i < letters.length) out += letters[i++]
  }
  if (i < letters.length) out += letters.slice(i).join('')
  return out.trim()
}

/** Vị trí ô đang chờ gõ (để tô sáng); -1 nếu đã đầy. */
export function activeSlot(template: readonly Slot[], typed: string): number {
  const filled = fillSlots(template, typed)
  return template.findIndex((s, idx) => s.kind === 'letter' && filled[idx] === null)
}

// ---- Chữ gợi ý mờ ở vị trí ngẫu nhiên ----------------------------------------------------------
// Chữ gợi ý chỉ hiện mờ trong ô, người học vẫn phải gõ đủ từng chữ (kể cả chữ được gợi ý).

/**
 * Số chữ gợi ý mờ để làm điểm tựa (không nhiều để vẫn phải nhớ):
 * ≤3 chữ: 0; 4–6: 1; 7–12: 2; dài hơn: 3.
 */
export function scaffoldCount(totalLetters: number): number {
  if (totalLetters <= 3) return 0
  return Math.min(3, Math.max(1, Math.round(totalLetters / 5)))
}

/** Chọn ngẫu nhiên vị trí (chỉ số ô) các chữ gợi ý; mỗi lần làm bài một kiểu khác nhau. */
export function pickReveals(template: readonly Slot[], count: number, rand: () => number = Math.random): number[] {
  const letters = template.flatMap((s, i) => (s.kind === 'letter' ? [i] : []))
  const n = Math.min(count, Math.max(0, letters.length - 1))
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  return letters.slice(0, n).sort((a, b) => a - b)
}

/**
 * Ô gợi ý tiếp theo khi bấm "Gợi ý": ô chữ đầu tiên từ vị trí đang gõ trở đi chưa có chữ mờ.
 * -1 nếu không còn ô nào.
 */
export function nextHintSlot(template: readonly Slot[], hinted: ReadonlySet<number>, typed: string): number {
  const from = activeSlot(template, typed)
  if (from < 0) return -1
  for (let i = from; i < template.length; i++) if (template[i].kind === 'letter' && !hinted.has(i)) return i
  return -1
}

/**
 * Khung chữ cho gợi ý bài nghe viết (R6.9): lộ chữ đầu mỗi từ, các chữ còn lại thành "_",
 * giữ nguyên khoảng trắng và dấu. Ví dụ "well-known" → "w___-k____".
 */
export function letterMask(term: string): string {
  let start = true
  return slotTemplate(term)
    .map((s) => {
      if (s.kind === 'fixed') {
        start = s.char === ' ' || s.char === '-'
        return s.char
      }
      const out = start ? s.char : '_'
      start = false
      return out
    })
    .join('')
}
