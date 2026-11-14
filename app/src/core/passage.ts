/**
 * Đoạn văn dán vào để giải thích từ theo ngữ cảnh (R8.2): tách thành từng chữ chạm được và từng câu, để người học chọn
 * một chữ hoặc một cụm liền nhau trong cùng một câu.
 */

export interface PassageToken {
  text: string
  start: number
  /** Chữ tiếng Anh (chạm được); khoảng trắng, dấu câu, số thì false. */
  word: boolean
  sentence: number
}

export interface Passage {
  tokens: PassageToken[]
  sentences: string[]
}

export const MAX_PASSAGE = 1500

export function parsePassage(text: string): Passage {
  const tokens: PassageToken[] = []
  const sentences: string[] = []
  let sentence = 0
  let sentenceStart = 0
  const re = /[A-Za-z]+(?:['’][A-Za-z]+)*|\s+|[^A-Za-z\s]/g
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const t = m[0]
    tokens.push({ text: t, start: m.index, word: /^[A-Za-z]/.test(t), sentence })
    // Hết câu: dấu chấm, hỏi, than rồi khoảng trắng, hoặc xuống dòng.
    const end = (/\s/.test(t) && /[.!?…]["”')\]]*$/.test(text.slice(sentenceStart, m.index))) || t.includes('\n')
    if (end) {
      const s = text.slice(sentenceStart, m.index).trim()
      if (s) sentences[sentence++] = s
      sentenceStart = m.index + t.length
      tokens[tokens.length - 1].sentence = sentence
    }
  }
  const last = text.slice(sentenceStart).trim()
  if (last) sentences[sentence] = last
  return { tokens, sentences }
}

/** Phần được chọn (từ chữ `from` đến chữ `to`, cùng một câu) và câu chứa nó. */
export function selectionOf(text: string, p: Passage, from: number, to: number): { selection: string; sentence: string } | null {
  const a = p.tokens[Math.min(from, to)]
  const b = p.tokens[Math.max(from, to)]
  if (!a?.word || !b?.word || a.sentence !== b.sentence) return null
  return { selection: text.slice(a.start, b.start + b.text.length).replace(/\s+/g, ' '), sentence: p.sentences[a.sentence] ?? '' }
}

/** Cụm chọn được dài nhất (số chữ). */
export const MAX_PHRASE_WORDS = 6

/**
 * Chạm một chữ khi đang chọn một chữ khác mà không ghép được thành cụm: hai chữ ở hai câu, hoặc cụm dài quá
 * {@link MAX_PHRASE_WORDS} chữ (app chọn lại từ chữ vừa chạm, nên cần báo cho người dùng biết vì sao).
 */
export function phraseIssue(p: Passage, current: { from: number; to: number } | null, index: number): 'other_sentence' | 'too_long' | null {
  if (!p.tokens[index]?.word || !current || current.from !== current.to || current.from === index) return null
  const a = Math.min(current.from, index)
  const b = Math.max(current.from, index)
  if (p.tokens[a].sentence !== p.tokens[b].sentence) return 'other_sentence'
  return p.tokens.slice(a, b + 1).filter((t) => t.word).length > MAX_PHRASE_WORDS ? 'too_long' : null
}

/**
 * Chạm một chữ: chưa chọn gì hoặc đã chọn cụm thì chọn lại từ chữ này; đang chọn một chữ thì chạm chữ khác cùng câu
 * (cụm tối đa 6 chữ) để chọn cả cụm, chạm lại đúng chữ đó để bỏ chọn.
 */
export function tapToken(p: Passage, current: { from: number; to: number } | null, index: number): { from: number; to: number } | null {
  if (!p.tokens[index]?.word) return current
  if (!current || current.from !== current.to) return { from: index, to: index }
  if (current.from === index) return null
  if (phraseIssue(p, current, index)) return { from: index, to: index }
  return { from: Math.min(current.from, index), to: Math.max(current.from, index) }
}
