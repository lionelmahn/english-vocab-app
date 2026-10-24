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

/** Chữ cái gợi ý: `count` chữ đầu tiên của đáp án (R6.9). */
export function hintLetters(template: readonly Slot[], count: number): string {
  return template
    .filter((s) => s.kind === 'letter')
    .slice(0, count)
    .map((s) => s.char)
    .join('')
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
