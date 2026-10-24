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

// ---- Chữ lộ sẵn ở vị trí ngẫu nhiên ------------------------------------------------------------

/**
 * Số chữ lộ sẵn để làm điểm tựa (không nhiều để vẫn phải nhớ):
 * ≤3 chữ: 0; 4–6: 1; 7–12: 2; dài hơn: 3.
 */
export function scaffoldCount(totalLetters: number): number {
  if (totalLetters <= 3) return 0
  return Math.min(3, Math.max(1, Math.round(totalLetters / 5)))
}

/** Chọn ngẫu nhiên vị trí (chỉ số ô) các chữ lộ sẵn; mỗi lần làm bài một kiểu khác nhau. */
export function pickReveals(template: readonly Slot[], count: number, rand: () => number = Math.random): number[] {
  const letters = template.flatMap((s, i) => (s.kind === 'letter' ? [i] : []))
  const n = Math.min(count, Math.max(0, letters.length - 1))
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  return letters.slice(0, n).sort((a, b) => a - b)
}

/** Chữ hiện ở từng ô khi có chữ lộ sẵn: chữ gõ điền lần lượt vào các ô chưa lộ. */
export function fillWithReveals(template: readonly Slot[], revealed: ReadonlySet<number>, typed: string): (string | null)[] {
  const letters = lettersOnly(typed)
  let i = 0
  return template.map((s, idx) => {
    if (s.kind === 'fixed') return s.char
    if (revealed.has(idx)) return s.char
    return letters[i++] ?? null
  })
}

export function activeSlotWithReveals(template: readonly Slot[], revealed: ReadonlySet<number>, typed: string): number {
  const filled = fillWithReveals(template, revealed, typed)
  return template.findIndex((s, idx) => s.kind === 'letter' && filled[idx] === null)
}

/**
 * Ghép đáp án khi có chữ lộ sẵn. Nếu người học gõ đủ cả từ (kể cả các chữ đã lộ) thì lấy đúng chữ đã gõ.
 */
export function composeWithReveals(template: readonly Slot[], revealed: ReadonlySet<number>, typed: string): string {
  if (lettersOnly(typed).length >= letterCount(template)) return composeAnswer(template, typed)
  return fillWithReveals(template, revealed, typed)
    .map((c) => c ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
