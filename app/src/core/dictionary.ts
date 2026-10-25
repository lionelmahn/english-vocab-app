import type { PartOfSpeech } from './pos'

/**
 * Đọc dữ liệu từ điển Wiktionary (giấy phép CC BY-SA) thành mục từ (R15.2):
 * nghĩa theo loại từ và câu ví dụ (REST API), phiên âm Anh–Mỹ/Anh–Anh và gợi ý nghĩa tiếng Việt
 * (mã nguồn trang). Chỉ là hàm thuần, phần gọi mạng nằm ở services/dictionary.
 */

export interface DictSense {
  /** Nghĩa tiếng Anh (chữ thường, đã bỏ HTML). */
  definition: string
  examples: string[]
  /** Nghĩa kiểu "past tense of give": từ gốc để tra tiếp. */
  formOf?: string
}

export interface DictGroup {
  partOfSpeech: PartOfSpeech
  /** Tên loại từ gốc trên Wiktionary ("Verb", "Proper noun"…). */
  label: string
  senses: DictSense[]
}

export interface Ipa {
  us?: string
  uk?: string
}

export interface VietnameseHint {
  partOfSpeech?: PartOfSpeech
  /** Nghĩa tiếng Anh mà bảng dịch gắn với (có thể trống). */
  gloss: string
  words: string[]
}

export interface DictEntry {
  /** Tiêu đề trang Wiktionary (dạng viết của mục từ). */
  title: string
  ipa: Ipa
  /** Phiên âm riêng theo loại từ, ví dụ "record" danh từ và động từ đọc khác nhau. */
  ipaByPos: Partial<Record<PartOfSpeech, Ipa>>
  groups: DictGroup[]
  vietnamese: VietnameseHint[]
}

// ---- HTML → chữ ------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Bỏ thẻ HTML; danh sách lồng bên trong (nghĩa con, được liệt kê riêng) bị bỏ cả nội dung. */
export function htmlToText(html: string): string {
  let s = html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '')
  for (let prev = ''; prev !== s; ) {
    prev = s
    s = s.replace(/<(ol|ul|dl)\b[^>]*>(?:(?!<(?:ol|ul|dl)\b)[\s\S])*?<\/\1>/gi, '')
  }
  s = s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
  return decodeEntities(s)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim()
}

// ---- Loại từ ---------------------------------------------------------------------------------

/** Loại mục không phải từ vựng để học (ký hiệu, chữ cái, tiền tố…). */
const SKIP_POS = new Set(['symbol', 'letter', 'prefix', 'suffix', 'affix', 'infix', 'interfix', 'circumfix', 'punctuation mark', 'diacritical mark', 'romanization', 'han character'])

const POS_MAP: Record<string, PartOfSpeech> = {
  noun: 'noun',
  'proper noun': 'noun',
  verb: 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  pronoun: 'pronoun',
  preposition: 'preposition',
  conjunction: 'conjunction',
  interjection: 'interjection',
  phrase: 'phrase',
  'prepositional phrase': 'phrase',
  proverb: 'phrase',
  idiom: 'idiom',
}

/** Loại từ của Wiktionary sang loại từ của app; null nếu không phải mục để học. Động từ nhiều chữ là cụm động từ. */
export function mapPos(label: string, term: string): PartOfSpeech | null {
  const key = label.trim().toLowerCase()
  if (SKIP_POS.has(key)) return null
  const pos = POS_MAP[key] ?? 'other'
  return pos === 'verb' && /\s/.test(term.trim()) ? 'phrasal_verb' : pos
}

// ---- Nghĩa và ví dụ (REST: /api/rest_v1/page/definition/{title}) -------------------------------

interface RestDefinition {
  definition?: string
  parsedExamples?: { example?: string }[]
  examples?: string[]
}
interface RestUsage {
  partOfSpeech?: string
  language?: string
  definitions?: RestDefinition[]
}

/** Nghĩa kiểu "simple past of go": Wiktionary đánh dấu từ gốc bằng form-of-definition-link. */
function formOfLemma(html: string): string | undefined {
  const link = /class="[^"]*form-of-definition-link[^"]*"[\s\S]*?<a\b[^>]*title="([^"]+)"/i.exec(html)
  return link ? decodeEntities(link[1]) : undefined
}

const MAX_EXAMPLES = 2

/** Nhóm nghĩa theo loại từ; gộp các nhóm cùng loại từ (khác gốc từ) và bỏ nghĩa trống. */
export function parseDefinitions(json: unknown, term: string): DictGroup[] {
  const usages = ((json as Record<string, RestUsage[] | undefined>)?.en ?? []).filter((u) => !u.language || u.language === 'English')
  const groups: DictGroup[] = []
  for (const u of usages) {
    const label = u.partOfSpeech ?? ''
    const pos = mapPos(label, term)
    if (!pos) continue
    const senses: DictSense[] = []
    for (const d of u.definitions ?? []) {
      const html = d.definition ?? ''
      const definition = htmlToText(html)
      if (!definition) continue
      const raw = d.parsedExamples?.length ? d.parsedExamples.map((e) => e.example ?? '') : (d.examples ?? [])
      const examples = raw.map(htmlToText).filter(Boolean).slice(0, MAX_EXAMPLES)
      const formOf = formOfLemma(html)
      senses.push(formOf && formOf.toLowerCase() !== term.trim().toLowerCase() ? { definition, examples, formOf } : { definition, examples })
    }
    if (senses.length === 0) continue
    const same = groups.find((g) => g.partOfSpeech === pos && g.label === label)
    if (same) same.senses.push(...senses)
    else groups.push({ partOfSpeech: pos, label, senses })
  }
  return groups
}

// ---- Mã nguồn trang (wikitext) ---------------------------------------------------------------

/** Các tham số của một mẫu {{...}}: vị trí và tên. Không xử lý mẫu lồng nhau. */
function templateArgs(body: string): { positional: string[]; named: Record<string, string> } {
  const positional: string[] = []
  const named: Record<string, string> = {}
  for (const part of body.split('|')) {
    const eq = part.indexOf('=')
    if (eq > 0 && /^[a-z0-9_]+$/i.test(part.slice(0, eq).trim())) named[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
    else positional.push(part.trim())
  }
  return { positional, named }
}

/** Các mẫu {{tên|…}} trong một dòng (chỉ lấy các tên trong `names`, hoặc mọi mẫu nếu null). */
function templates(line: string, names: readonly string[] | null): { name: string; positional: string[]; named: Record<string, string> }[] {
  const out = []
  const re = /\{\{([^{}|]+)\|([^{}]*)\}\}/g
  for (let m = re.exec(line); m; m = re.exec(line)) {
    const name = m[1].trim()
    if (!names || names.includes(name)) out.push({ name, ...templateArgs(m[2]) })
  }
  return out
}

type Accent = 'us' | 'uk'

/** Nhãn giọng và độ ưu tiên: giọng chuẩn của từ điển (RP, GA) trước, nhãn chung (UK, US) sau, SSB (giọng Anh hiện đại, ký hiệu khác từ điển) cuối. */
const ACCENT_LEVEL = new Map<string, [Accent, number]>([
  ['rp', ['uk', 4]],
  ['received pronunciation', ['uk', 4]],
  ['uk', ['uk', 3]],
  ['british', ['uk', 3]],
  ['bre', ['uk', 3]],
  ['england', ['uk', 3]],
  ['southern england', ['uk', 3]],
  ['ssb', ['uk', 1]],
  ['ssbe', ['uk', 1]],
  ['standard southern british', ['uk', 1]],
  ['ga', ['us', 4]],
  ['genam', ['us', 4]],
  ['general american', ['us', 4]],
  ['us', ['us', 3]],
  ['american', ['us', 3]],
  ['ame', ['us', 3]],
  ['usa', ['us', 3]],
])
/** Giọng vùng khác: đứng cùng RP/GA thì không sao, đứng một mình thì không dùng cho Anh–Anh hay Anh–Mỹ. */
const OTHER_ACCENTS = new Set([
  'ca', 'canada', 'canadian', 'au', 'aus', 'australia', 'australian', 'gena', 'general australian', 'nz', 'new zealand', 'ie', 'ireland', 'irish',
  'ni', 'northern ireland', 'scotland', 'scottish', 'wales', 'welsh', 'sa', 'south africa', 'india', 'indian', 'indic', 'philippines', 'singapore',
  'hk', 'hong kong', 'nyc', 'new york', 'boston', 'north england', 'northern england', 'northumbrian', 'ulster', 'eastern new england',
])
/** Dạng đọc lướt, cổ, không chuẩn: chỉ dùng khi không còn cách đọc nào khác. */
const REDUCED = /(?<!non-)\bweak\b(?! vowel)|\b(unstressed|reduced|non-?standard|archaic|obsolete|early modern|dialect(al)?|proscribed|colloquial|casual|rapid|fast)\b/
/** Cách đọc ít gặp hơn cách chính. */
const UNCOMMON =
  /\b(dated|formerly|rare|rarely|uncommon|sometimes|occasionally|older|old-fashioned|traditional|informal|hypercorrect|spelling pronunciation|some speakers|also)\b|(?<!non-)yod-coalescence/
/** Nhãn không đổi gì: dạng đọc nhấn (dạng từ điển ghi) của từ chức năng, nguyên âm không nhược hóa, các hiện tượng hòa âm đã phổ biến. */
const NEUTRAL = /\b(strong|stressed|citation|emphatic|standard|common|usual|non-weak)\b|pane-pain|toe-tow|father-bother|horse-hoarse|wine-whine|non-æ-tensing|yod-dropping/
const POS_WORDS = new Set(Object.keys(POS_MAP))
/** Mẫu ghi nhãn (giọng, loại từ) đứng trước phiên âm. */
const LABEL_TEMPLATES = new Set(['a', 'accent', 'q', 'qualifier', 'i', 'lb', 'sense', 's'])
/** Mẫu lồng trong mẫu khác ({{IPA|…|ref={{R:…}}}}) làm mẫu ngoài không đọc được: bỏ đi, trừ các mẫu cần dùng. */
const NESTED = /\{\{(?!(?:IPA|enPR|audio|a|accent|q|qualifier|i|lb|sense|s)\s*\|)[^{}]*\}\}/g
/** Tiêu đề con trong phần Pronunciation (=====Stressed=====…): vẫn là phiên âm, tiêu đề thành nhãn. */
const PRON_SUBHEADING = /^(stressed|unstressed|weak|strong)\b/i

/** Dấu phụ mà từ điển cho người học không ghi: bật hơi, đầu lưỡi, vô thanh, lưỡi nâng/hạ… */
const DETAIL_MARKS = /[ʰʷʲˑˀʼ]|[\u0308\u030A\u031A\u031C\u031D\u031E\u031F\u0320\u0324\u0325\u032A\u032C\u0330\u0339\u033A\u033B\u033D]/g
/** Ký hiệu chỉ có trong phiên âm theo giọng vùng hoặc phiên âm hẹp (ɐ, ɵ, ʉ, âm lướt aj, əw, ᵻ…), không có trong từ điển. */
const ODD = /[ɐçɵʉɾʔxɘɞɤʏøœɯβɣɸɨᵻᵿ]|[aɑɐəɪie]j|[aɑæəʊɐɵuʉo]w|ɜʊ|əɪ|eː|oː/
const ODD_FOR: Record<Accent, RegExp> = {
  us: /ɒ|əʊ|[eɛ]ə|ɜ/,
  uk: /ɚ|ɝ|oʊ|r(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ)])/,
}
/** Nguyên âm đôi tính là một âm tiết. */
const DIPHTHONGS = /aɪ|eɪ|ɔɪ|aʊ|əʊ|oʊ|ɪə|eə|ʊə|ɛə|[ɪɛʊɔɑ]ɚ/g
const VOWEL = /[iyɨʉɯuɪʏʊeøɘɵɤoəɚɛœɜɝɞʌɔæɐaɶɑɒV]/g

/**
 * Viết phiên âm theo cách quen thuộc của từ điển cho người học:
 * /ɹ/ của Wiktionary viết thành /r/, bỏ dấu nối âm trên dʒ, tʃ, dấu bán nguyên âm và các dấu phụ chi tiết,
 * l̩ n̩ viết thành əl ən, /(h)w/ và /ʍ/ viết thành /w/,
 * âm có thể đọc trong ngoặc được viết ra: /ˈsɛntr(ə)l/ → /ˈsɛntrəl/. Từ một âm tiết không ghi dấu nhấn.
 */
export function tidyIpa(ipa: string): string {
  const s = ipa
    .trim()
    .replace(/ɹ/g, 'r')
    .replace(/[\u0361\u035C\u032F]/g, '')
    .replace(/a\u0308|ä/g, 'a')
    .replace(DETAIL_MARKS, '')
    .replace(/ə?([lnm])[\u0329\u030D]/g, 'ə$1')
    .replace(/\(h\)w|ʍ/g, 'w')
    .replace(/\(ː\)|\(\)/g, '')
    // Âm chêm /t/ trong /sɪn(t)s/, /p/ trong /ˈsʌm(p)θɪŋ/ không ghi (vẫn ghi /əˈtɛmpt/, /ˈfʌŋkʃən/); (r), (j) tùy giọng, do forAccent xử lý.
    .replace(/n\(t\)(?=s)|m\(p\)(?=θ)/g, (m) => m[0])
    .replace(/\(([^()rj]|[^()]{2,})\)/g, '$1')
  const syllables = s.replace(/[ːˑ]|[\u0300-\u036F]/g, '').replace(DIPHTHONGS, 'V').match(VOWEL)?.length ?? 0
  return syllables === 1 && !/[.ˌ]/.test(s) && s.split('ˈ').length === 2 ? s.replace('ˈ', '') : s
}

/** Phiên âm hẹp [pʰɑ̃ːs] thành dạng từ điển /pɑːs/ (các dấu phụ khác do tidyIpa bỏ). */
function broaden(narrow: string): string {
  return `/${narrow.slice(1, -1).replace(/\u0303/g, '').replace(/ɫ/g, 'l')}/`
}

/**
 * Viết theo giọng: Anh–Anh bỏ âm nối (r) cuối từ (/ˈɛvə(r)/ → /ˈɛvə/), giữ âm /j/ (/ˈd(j)ʊə.rɪŋ/ → /ˈdjʊə.rɪŋ/).
 * Anh–Mỹ viết thống nhất như phần GA của Wiktionary và từ điển Mỹ: đọc (r), bỏ (j) sau t, d, n, s, z, l, θ (/ˈstu.dənt/);
 * âm "er" là /ɝ/, /ɚ/ chứ không phải /ɜr/, /ər/; /or/ là /ɔr/; không ghi trường độ ː (phiên âm không nhãn dùng chung
 * cho hai giọng thường có ː).
 */
function forAccent(value: string, accent: Accent): string {
  if (accent === 'uk') return value.replace(/\(r\)/g, '').replace(/\(j\)/g, 'j')
  return value
    .replace(/\(r\)/g, 'r')
    .replace(/([tdnszlθ])\(j\)/g, '$1')
    .replace(/\(j\)/g, 'j')
    .replace(/ɜː?r/g, 'ɝ')
    .replace(/ər(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ])/g, 'ɚ')
    .replace(/o(?=ː?r)/g, 'ɔ')
    .replace(/ː/g, '')
}

/** Phiên âm (chưa viết theo giọng) có ký hiệu lạ, hoặc viết theo giọng này rồi vẫn không hợp giọng. */
function isOdd(raw: string, accent: Accent): boolean {
  return ODD.test(raw) || ODD_FOR[accent].test(forAccent(raw, accent))
}

/** Tách chú thích kèm trong tham số ("/luːk/<aa:Geordie>", "<q:…>", "<ref:…>"): phần phiên âm và các nhãn. */
function splitInline(arg: string): { text: string; labels: string[] } {
  let text = ''
  const labels: string[] = []
  for (let i = 0; i < arg.length; i++) {
    const open = /^<(\w+):/.exec(arg.slice(i))
    if (!open) {
      text += arg[i]
      continue
    }
    let j = i
    for (let depth = 0; j < arg.length; j++) {
      if (arg[j] === '<') depth++
      else if (arg[j] === '>' && --depth === 0) break
    }
    if (['a', 'aa', 'q', 'qq'].includes(open[1])) labels.push(arg.slice(i + open[0].length, j))
    i = j
  }
  return { text, labels }
}

/** "GA, <<Northern US>> or [[w:…|cot-caught]]" → ["ga", "northern us", "cot-caught"]. */
function splitLabels(raw: string): string[] {
  return unlink(raw)
    .replace(/<<|>>|[[\]]/g, '')
    .split(/[,;]|\bor\b/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
}

/** Loại từ ghi trong nhãn: "noun", "adjective and noun", "verbs". */
function labelPoses(label: string, term: string): PartOfSpeech[] | null {
  const words = label.split(/\s*(?:\band\b|\/|&)\s*/).map((w) => (POS_WORDS.has(w) ? w : w.replace(/s$/, '')))
  return words.every((w) => POS_WORDS.has(w)) ? words.map((w) => mapPos(w, term) ?? 'other') : null
}

interface PronCandidate {
  value: string
  /** Phiên âm /…/ ở dòng cha gần nhất: dùng thay khi phiên âm này theo giọng vùng hoặc quá hẹp. */
  parent?: string
  /** Phiên âm hẹp […] (mẫu không có phiên âm /…/). */
  narrow: boolean
  /** Thứ tự trong cùng mẫu: phiên âm đứng trước được ưu tiên. */
  rank: number
  scope: number
  labels: string[]
}

interface PronLabels {
  level: Record<Accent, number>
  poses: PartOfSpeech[]
  penalty: number
  /** Có nhãn lạ (không phải giọng, loại từ hay nhãn quen). */
  unknown: boolean
  regional: boolean
}

function classify(labels: string[], term: string): PronLabels {
  const k: PronLabels = { level: { us: 0, uk: 0 }, poses: [], penalty: 0, unknown: false, regional: false }
  for (const l of labels) {
    const accent = ACCENT_LEVEL.get(l)
    const poses = accent ? null : labelPoses(l, term)
    if (accent) k.level[accent[0]] = Math.max(k.level[accent[0]], accent[1])
    else if (poses) k.poses.push(...poses)
    else if (REDUCED.test(l)) k.penalty = Math.min(k.penalty, -10)
    else if (UNCOMMON.test(l)) k.penalty = Math.min(k.penalty, -3)
    else if (OTHER_ACCENTS.has(l)) k.regional = true
    // "Northern US", "Southern American English": giọng Mỹ vùng, chỉ hơn không có gì.
    else if (/\b(us|american)\b/.test(l)) k.level.us = Math.max(k.level.us, 0.5)
    else if (!NEUTRAL.test(l)) k.unknown = true
  }
  return k
}

/** Điểm của một phiên âm cho một giọng (null nếu phiên âm chỉ dành cho giọng kia hoặc cho giọng vùng khác). */
function judge(c: PronCandidate, k: PronLabels, accent: Accent): { score: number; value: string } | null {
  const labelled = k.level.us > 0 || k.level.uk > 0
  if (labelled ? !k.level[accent] : k.regional) return null
  const base = labelled ? k.level[accent] - (k.unknown ? 0.5 : 0) : k.unknown ? 0 : 2
  let score = base + k.penalty - c.rank / 100
  let raw = c.value
  const parentFits = !!c.parent && !isOdd(c.parent, accent)
  // Phiên âm hẹp […] chỉ ghi chi tiết cách đọc phiên âm /…/ ở dòng cha ([ˈsɪtʰiː] dưới /ˈsɪti/): dùng dạng /…/ đó nếu hợp giọng này.
  if (c.narrow && parentFits) raw = c.parent!
  else if (isOdd(raw, accent)) {
    if (parentFits) {
      raw = c.parent!
      score -= 0.25
    } else score -= 1
  }
  return { score, value: forAccent(raw, accent) }
}

/** Phần ngôn ngữ English của trang (từ tiêu đề ==English== tới ngôn ngữ kế tiếp). */
export function englishSection(wikitext: string): string {
  const start = wikitext.search(/^==\s*English\s*==\s*$/m)
  const from = start < 0 ? wikitext : wikitext.slice(start)
  const next = from.slice(2).search(/^==[^=].*==\s*$/m)
  return next < 0 ? from : from.slice(0, next + 2)
}

interface PronScope {
  level: number
  parent: number
  poses: PartOfSpeech[]
}

/**
 * Phiên âm Anh–Mỹ và Anh–Anh từ các mẫu {{IPA|en|/…/|a=…}} trong phần English của trang.
 * Nhãn giọng có thể nằm trong mẫu (a=GA,RP), ở mẫu khác cùng dòng ({{enPR|…|a=RP}}),
 * hoặc ở dòng cha ({{a|RP}} rồi các dòng ** bên dưới).
 * Mỗi phiên âm được chấm điểm theo nhãn: giọng chuẩn RP/GA trước, rồi nhãn UK/US, rồi phiên âm không nhãn;
 * giọng vùng khác, dạng đọc lướt (weak form) và dạng cổ chỉ dùng khi không còn gì khác.
 * Phiên âm hẹp […] dùng phiên âm /…/ ở dòng cha (nếu hợp giọng), không có thì đổi về dạng từ điển; phiên âm có ký hiệu
 * của giọng vùng (ɐ, ɵ, âm lướt aj…) cũng nhường cho phiên âm /…/ ở dòng cha.
 * Từ có nhiều gốc (Etymology 1, 2…) hoặc nhiều cách đọc (Pronunciation 1, 2) đọc khác nhau theo loại từ,
 * ví dụ "record" danh từ và động từ: phiên âm của từng phần được ghi cho các loại từ thuộc phần đó;
 * nhãn loại từ ({{a|en|verb}}, {{sense|noun}}) cũng được dùng.
 */
export function parsePronunciation(wikitext: string, term = ''): { ipa: Ipa; byPos: Partial<Record<PartOfSpeech, Ipa>> } {
  const scopes: PronScope[] = [{ level: 0, parent: -1, poses: [] }]
  const open = [0]
  const cands: PronCandidate[] = []
  const context: string[][] = []
  const phonemicAt: (string | undefined)[] = []
  let inPron = false
  let sectionLabels: string[] = []
  for (const line of wikitext.split('\n')) {
    const heading = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const title = heading[2]
      context.length = 0
      phonemicAt.length = 0
      if (inPron && PRON_SUBHEADING.test(title)) {
        sectionLabels = [title]
        continue
      }
      sectionLabels = []
      while (open.length > 1 && scopes[open[open.length - 1]].level >= level) open.pop()
      if (/^Etymology\b|^Pronunciation \d/.test(title)) {
        scopes.push({ level, parent: open[open.length - 1], poses: [] })
        open.push(scopes.length - 1)
      }
      inPron = title.startsWith('Pronunciation')
      const pos = POS_MAP[title.toLowerCase()] ? mapPos(title, term) : null
      if (pos) scopes[open[open.length - 1]].poses.push(pos)
      continue
    }
    if (!inPron) continue
    const depth = /^(\*+)/.exec(line)?.[1].length ?? 0
    context.length = Math.min(context.length, depth)
    phonemicAt.length = Math.min(phonemicAt.length, depth)
    let flat = line
    for (let prev = ''; prev !== flat; ) {
      prev = flat
      flat = flat.replace(NESTED, '')
    }
    const all = templates(flat, null)
    const lineLabels = [
      ...all.filter((t) => LABEL_TEMPLATES.has(t.name)).flatMap((t) => t.positional.filter((p) => p !== 'en')),
      // Nhãn của {{enPR}} cùng dòng áp cho phiên âm; nhãn của {{audio}} chỉ nói về file ghi âm nên bỏ qua.
      ...all.filter((t) => t.name === 'enPR' && t.named.a).map((t) => t.named.a),
    ]
    const ipas = all.filter((t) => t.name === 'IPA')
    if (ipas.length === 0) {
      if (lineLabels.length > 0) context[depth] = lineLabels
      continue
    }
    const parent = phonemicAt.slice(0, depth).reverse().find(Boolean)
    for (const t of ipas) {
      // a=, q= áp cho cả mẫu; a2=, q2= chỉ cho phiên âm thứ hai.
      const ownLabels = (n: number) =>
        Object.entries(t.named).flatMap(([key, v]) => {
          const m = /^(?:a|aa|q|qq)(\d*)$/.exec(key)
          return m && (m[1] === '' || Number(m[1]) === n) ? [v] : []
        })
      const parts = t.positional.slice(1).map((arg, i) => {
        const inline = splitInline(arg)
        return { text: inline.text, labels: [...ownLabels(i + 1), ...inline.labels] }
      })
      // Có phiên âm /…/ thì lấy mọi phiên âm /…/ (bỏ dạng viết tắt "/ɹə-/"); không có mới lấy phiên âm hẹp […] đầu tiên.
      const phonemic = parts.flatMap((p) => {
        const m = /\/[^/]+\//.exec(p.text)
        return m && !/^\/-|-\/$/.test(m[0]) ? [{ value: tidyIpa(m[0]), labels: p.labels }] : []
      })
      const narrow = parts.flatMap((p) => {
        const m = /\[[^\]]+\]/.exec(p.text)
        return m ? [{ value: tidyIpa(broaden(m[0])), labels: p.labels }] : []
      })
      const found = phonemic.length > 0 ? phonemic : narrow.slice(0, 1)
      found.forEach((f, rank) => {
        const labels = [...f.labels, ...lineLabels, ...context.slice(0, depth).flat(), ...sectionLabels].flatMap(splitLabels)
        cands.push({ value: f.value, parent, narrow: phonemic.length === 0, rank, scope: open[open.length - 1], labels })
      })
      if (phonemic.length > 0) phonemicAt[depth] ??= phonemic[0].value
    }
  }

  const info = new Map(cands.map((c) => [c, classify(c.labels, term)]))
  const pick = (list: { c: PronCandidate; bonus: number }[]): Ipa => {
    const ipa: Ipa = {}
    for (const accent of ['us', 'uk'] as const) {
      let best: { score: number; value: string } | undefined
      for (const { c, bonus } of list) {
        const j = judge(c, info.get(c)!, accent)
        if (j && (!best || j.score + bonus > best.score)) best = { score: j.score + bonus, value: j.value }
      }
      if (best) ipa[accent] = best.value
    }
    return ipa
  }
  const inScope = scopes.map((_, i) => cands.filter((c) => c.scope === i))
  const top = inScope.findIndex((list) => list.length > 0)
  if (top < 0) return { ipa: {}, byPos: {} }
  const general = (i: number) => inScope[i].filter((c) => info.get(c)!.poses.length === 0)
  // Phiên âm chung của trang: phần đầu tiên có phiên âm; phiên âm ghi riêng cho một loại từ xếp sau.
  const ipa = pick(inScope[top].map((c) => ({ c, bonus: info.get(c)!.poses.length > 0 ? -0.25 : 0 })))

  const byPos: Partial<Record<PartOfSpeech, Ipa>> = {}
  const poses = new Set([...cands.flatMap((c) => info.get(c)!.poses), ...scopes.flatMap((s) => s.poses)])
  for (const pos of poses) {
    // Phần chứa loại từ này mà có phiên âm: chính nó hoặc phần bao ngoài (Pronunciation 1 bao Etymology 1).
    let home = -1
    for (let i = 0; i < scopes.length && home < 0; i++) {
      if (!scopes[i].poses.includes(pos)) continue
      for (let s = i; s >= 0 && home < 0; s = scopes[s].parent) if (inScope[s].length > 0) home = s
    }
    const own = cands.filter((c) => info.get(c)!.poses.includes(pos)).map((c) => ({ c, bonus: 1 }))
    const shared = home < 0 && own.length === 0 ? [] : general(home < 0 ? top : home).map((c) => ({ c, bonus: 0 }))
    const found = pick([...own, ...shared])
    if (found.us || found.uk) byPos[pos] = found
  }
  return { ipa, byPos }
}

/** [[từ bỏ]] [[hi vọng|hy vọng]] → "từ bỏ hy vọng". */
function unlink(s: string): string {
  return s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
}

/** Chữ trong một mục dịch: {{t|vi|chạy}}, {{t+|vi|[[từ bỏ]] [[hi vọng]]}}, hoặc liên kết trần [[đàn hồi]]. */
function vietnameseWords(line: string): string[] {
  // Mẫu có thể chứa liên kết [[...]]: đổi liên kết thành chữ trước khi tách mẫu.
  const flat = line.replace(/\{\{[^{}]*\}\}/g, (t) => unlink(t))
  const words = templates(flat, ['t', 't+', 'tt', 'tt+', 't-check', 't+check'])
    .filter((t) => t.positional[0] === 'vi' && t.positional[1])
    .map((t) => t.positional[1])
  const bare = line.replace(/\{\{[^{}]*\}\}/g, '')
  for (const m of bare.matchAll(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g)) words.push(m[1])
  return [...new Set(words.map((w) => w.trim().replace(/\s+/g, ' ')).filter(Boolean))]
}

/** Gợi ý nghĩa tiếng Việt từ bảng dịch ({{trans-top|nghĩa}} … * Vietnamese: …), theo loại từ. */
export function parseVietnamese(wikitext: string, term = ''): VietnameseHint[] {
  const hints: VietnameseHint[] = []
  let pos: PartOfSpeech | undefined
  let gloss: string | null = null
  for (const line of wikitext.split('\n')) {
    const heading = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line)
    if (heading) {
      const mapped = POS_MAP[heading[2].toLowerCase()] ? mapPos(heading[2], term) : undefined
      if (mapped) pos = mapped
      continue
    }
    const top = templates(line, ['trans-top', 'checktrans-top'])[0]
    if (top) {
      gloss = top.positional[0] ?? ''
      continue
    }
    if (/\{\{trans-bottom\}\}/.test(line)) {
      gloss = null
      continue
    }
    if (gloss === null || !/^\*\s*Vietnamese\s*:/.test(line)) continue
    const words = vietnameseWords(line.replace(/\{\{(?:q|qualifier|i|gloss)\|[^{}]*\}\}/g, ''))
    if (words.length > 0) hints.push({ partOfSpeech: pos, gloss: htmlToText(gloss), words })
  }
  return hints
}
