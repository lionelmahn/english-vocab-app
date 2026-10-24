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

const UK_LABELS = new Set(['uk', 'rp', 'ssb', 'british', 'england', 'southern england', 'received pronunciation', 'bre'])
const US_LABELS = new Set(['us', 'ga', 'genam', 'general american', 'american', 'ame', 'usa'])
const POS_WORDS = new Set(Object.keys(POS_MAP))
/** Mẫu ghi nhãn (giọng, loại từ) đứng trước phiên âm. */
const LABEL_TEMPLATES = new Set(['a', 'accent', 'q', 'qualifier', 'i', 'lb'])

/**
 * Viết phiên âm theo cách quen thuộc của từ điển cho người học:
 * /ɹ/ của Wiktionary viết thành /r/, bỏ dấu nối âm trên dʒ, tʃ.
 */
export function tidyIpa(ipa: string): string {
  return ipa.replace(/ɹ/g, 'r').replace(/\u0361/g, '').trim()
}

/** Phần ngôn ngữ English của trang (từ tiêu đề ==English== tới ngôn ngữ kế tiếp). */
export function englishSection(wikitext: string): string {
  const start = wikitext.search(/^==\s*English\s*==\s*$/m)
  const from = start < 0 ? wikitext : wikitext.slice(start)
  const next = from.slice(2).search(/^==[^=].*==\s*$/m)
  return next < 0 ? from : from.slice(0, next + 2)
}

interface PronScope {
  ipa: Ipa
  general?: string
  poses: PartOfSpeech[]
}

/**
 * Phiên âm Anh–Mỹ và Anh–Anh từ các mẫu {{IPA|en|/…/|a=…}} trong phần English của trang.
 * Nhãn giọng có thể nằm trong mẫu (a=GA,RP), ở mẫu khác cùng dòng ({{enPR|…|a=RP}}),
 * hoặc ở dòng cha ({{a|RP}} rồi các dòng ** bên dưới).
 * Từ có nhiều gốc (Etymology 1, 2…) đọc khác nhau theo loại từ, ví dụ "record" danh từ và động từ:
 * phiên âm của từng gốc được ghi cho các loại từ thuộc gốc đó.
 */
export function parsePronunciation(wikitext: string, term = ''): { ipa: Ipa; byPos: Partial<Record<PartOfSpeech, Ipa>> } {
  const scopes: PronScope[] = [{ ipa: {}, poses: [] }]
  let scope = scopes[0]
  const byPos: Partial<Record<PartOfSpeech, Ipa>> = {}
  const context: string[][] = []
  let inPron = false
  for (const line of wikitext.split('\n')) {
    const heading = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line)
    if (heading) {
      const title = heading[2]
      if (/^Etymology\b/.test(title)) scopes.push((scope = { ipa: {}, poses: [] }))
      inPron = title.startsWith('Pronunciation')
      const pos = POS_MAP[title.toLowerCase()] ? mapPos(title, term) : null
      if (pos) scope.poses.push(pos)
      context.length = 0
      continue
    }
    if (!inPron) continue
    const depth = /^(\*+)/.exec(line)?.[1].length ?? 0
    context.length = Math.min(context.length, depth)
    const all = templates(line, null)
    const lineLabels = [
      ...all.filter((t) => LABEL_TEMPLATES.has(t.name)).flatMap((t) => t.positional.filter((p) => p !== 'en')),
      ...all.filter((t) => t.name !== 'IPA' && t.named.a).flatMap((t) => t.named.a.split(',')),
    ]
    const ipas = all.filter((t) => t.name === 'IPA')
    if (ipas.length === 0) {
      if (lineLabels.length > 0) context[depth] = lineLabels
      continue
    }
    for (const t of ipas) {
      const transcription = t.positional.slice(1).find((p) => p.startsWith('/')) ?? t.positional.slice(1).find((p) => p.startsWith('['))
      if (!transcription) continue
      const own = (t.named.a ?? t.named.aa ?? '').split(',')
      const labels = [...own, ...lineLabels, ...context.slice(0, depth).flat()].map((x) => x.trim().toLowerCase()).filter(Boolean)
      const uk = labels.some((l) => UK_LABELS.has(l))
      const us = labels.some((l) => US_LABELS.has(l))
      const posLabel = labels.find((l) => POS_WORDS.has(l))
      const value = tidyIpa(transcription)
      if (posLabel) {
        const target = (byPos[mapPos(posLabel, term) ?? 'other'] ??= {})
        if (uk || !us) target.uk ??= value
        if (us || !uk) target.us ??= value
        continue
      }
      if (uk) scope.ipa.uk ??= value
      if (us) scope.ipa.us ??= value
      if (!uk && !us) scope.general ??= value
    }
  }
  for (const sc of scopes) {
    if (sc.general) {
      sc.ipa.us ??= sc.general
      sc.ipa.uk ??= sc.general
    }
  }
  const withIpa = scopes.filter((sc) => sc.ipa.us || sc.ipa.uk)
  for (const sc of withIpa) for (const pos of sc.poses) byPos[pos] ??= sc.ipa
  return { ipa: withIpa[0]?.ipa ?? {}, byPos }
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
