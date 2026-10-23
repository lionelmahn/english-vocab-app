/** Loại từ (part of speech): nhãn tiếng Việt, viết tắt và cách đọc từ file nhập. */

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'phrasal_verb'
  | 'idiom'
  | 'phrase'
  | 'other'

export const POS_ORDER: readonly PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrasal_verb',
  'idiom',
  'phrase',
  'preposition',
  'conjunction',
  'pronoun',
  'interjection',
  'other',
]

export const POS_LABEL: Record<PartOfSpeech, string> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  pronoun: 'Đại từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  interjection: 'Thán từ',
  phrasal_verb: 'Cụm động từ',
  idiom: 'Thành ngữ',
  phrase: 'Cụm từ',
  other: 'Khác',
}

export const POS_SHORT: Record<PartOfSpeech, string> = {
  noun: 'n',
  verb: 'v',
  adjective: 'adj',
  adverb: 'adv',
  pronoun: 'pron',
  preposition: 'prep',
  conjunction: 'conj',
  interjection: 'interj',
  phrasal_verb: 'phr v',
  idiom: 'idiom',
  phrase: 'phrase',
  other: '',
}

const ALIASES: Record<string, PartOfSpeech> = {
  n: 'noun',
  noun: 'noun',
  'danh từ': 'noun',
  dt: 'noun',
  v: 'verb',
  verb: 'verb',
  'động từ': 'verb',
  đt: 'verb',
  adj: 'adjective',
  a: 'adjective',
  adjective: 'adjective',
  'tính từ': 'adjective',
  tt: 'adjective',
  adv: 'adverb',
  adverb: 'adverb',
  'trạng từ': 'adverb',
  'phó từ': 'adverb',
  pron: 'pronoun',
  pronoun: 'pronoun',
  'đại từ': 'pronoun',
  prep: 'preposition',
  preposition: 'preposition',
  'giới từ': 'preposition',
  conj: 'conjunction',
  conjunction: 'conjunction',
  'liên từ': 'conjunction',
  interj: 'interjection',
  exclamation: 'interjection',
  interjection: 'interjection',
  'thán từ': 'interjection',
  'phr v': 'phrasal_verb',
  'phr. v': 'phrasal_verb',
  phrv: 'phrasal_verb',
  'phrasal verb': 'phrasal_verb',
  phrasal_verb: 'phrasal_verb',
  'cụm động từ': 'phrasal_verb',
  idiom: 'idiom',
  'thành ngữ': 'idiom',
  phrase: 'phrase',
  'cụm từ': 'phrase',
  collocation: 'phrase',
}

/** Đọc loại từ từ chữ người dùng nhập ("n", "danh từ", "Noun"…). Không nhận ra thì trả "other". */
export function parsePos(input: string | null | undefined): PartOfSpeech {
  if (!input) return 'other'
  const key = input
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[()[\]]/g, '')
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
  return ALIASES[key] ?? ALIASES[key.replace(/\./g, '')] ?? 'other'
}
