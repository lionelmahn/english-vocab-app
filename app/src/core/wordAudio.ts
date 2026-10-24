/**
 * Chọn bản ghi phát âm giọng người thật từ danh sách file âm thanh trên Wiktionary/Wikimedia Commons.
 * Hàm thuần, để test được; phần gọi mạng nằm ở services/audio.ts.
 */

export type AccentTag = 'us' | 'uk' | 'other'

const AUDIO_FILE = /\.(ogg|oga|opus|mp3|wav|flac)$/i

/** Chuẩn hóa để so tên file với từ: "En-us-give up.ogg" ~ "give up". */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[_\s-]+/g, ' ')
    .trim()
}

/** Phân loại giọng theo tên file: "En-us-…" Mỹ, "En-uk-…"/"En-gb-…" Anh. */
export function accentOf(fileName: string): AccentTag {
  const n = fileName.toLowerCase().replace(/^file:/, '')
  if (/^en-us-/.test(n)) return 'us'
  if (/^en-(uk|gb)-/.test(n)) return 'uk'
  return 'other'
}

/** Đuôi loại từ trong tên file của từ đọc khác nhau theo loại từ: "en-us-record-noun.ogg". */
const POS_SUFFIX: Record<string, 'noun' | 'verb' | 'adjective' | 'adverb'> = {
  noun: 'noun',
  n: 'noun',
  verb: 'verb',
  v: 'verb',
  adjective: 'adjective',
  adj: 'adjective',
  adverb: 'adverb',
  adv: 'adverb',
}

export interface AudioFileMatch {
  name: string
  accent: AccentTag
  /** File chỉ đúng với một loại từ (ví dụ danh từ "record" và động từ "record" đọc khác nhau). */
  pos?: 'noun' | 'verb' | 'adjective' | 'adverb'
}

/**
 * Mọi file âm thanh tiếng Anh của đúng từ đang tra (bỏ file của từ khác, ví dụ "examinations"),
 * theo thứ tự trên trang. Dùng cho danh sách "Chọn bản khác" (R7.8).
 */
export function matchingAudioFiles(term: string, fileTitles: readonly string[]): AudioFileMatch[] {
  const want = slug(term)
  const out: AudioFileMatch[] = []
  for (const title of fileTitles) {
    const name = title.replace(/^File:/i, '')
    if (!AUDIO_FILE.test(name)) continue
    const base = slug(name)
    if (/^en [a-z]{2} /.test(base)) {
      // "En-us-…", "En-uk-…", "En-au-…": giọng tiếng Anh, tên file là đúng từ (có thể kèm loại từ).
      const rest = base.replace(/^en [a-z]{2} /, '')
      if (rest === want) out.push({ name, accent: accentOf(name) })
      else if (rest.startsWith(`${want} `)) {
        const pos = POS_SUFFIX[rest.slice(want.length + 1).replace(/[()]/g, '')]
        if (pos) out.push({ name, accent: accentOf(name), pos })
      }
    } else if (/^ll q1860 \(eng\) /.test(base) && base.endsWith(` ${want}`)) {
      // Lingua Libre tiếng Anh: "LL-Q1860 (eng)-Người đọc-từ.wav".
      out.push({ name, accent: accentOf(name) })
    }
    // File của ngôn ngữ khác ("De-abundant.ogg", "LL-Q188 (deu)-…") bị bỏ qua.
  }
  return out
}

/**
 * Tối đa một file cho mỗi giọng, ưu tiên file "En-us-/En-uk-" chuẩn (file đầu tiên khớp).
 * Bỏ file theo loại từ: không biết đang đọc nghĩa nào thì để người học tự chọn trong "Bản khác".
 */
export function pickAudioFiles(term: string, fileTitles: readonly string[]): Partial<Record<AccentTag, string>> {
  const out: Partial<Record<AccentTag, string>> = {}
  for (const f of matchingAudioFiles(term, fileTitles)) if (!f.pos) out[f.accent] ??= f.name
  return out
}

/** Bỏ các bản ghi bị người học báo đọc sai. */
export function withoutFlagged<T extends { us?: string; uk?: string; other?: string }>(audio: T | null | undefined, flagged: ReadonlySet<string>): T | null {
  if (!audio) return null
  const out = { ...audio }
  for (const k of ['us', 'uk', 'other'] as const) if (out[k] && flagged.has(out[k]!)) delete out[k]
  return out
}

/** Chọn đường dẫn theo giọng ưu tiên; thiếu thì lấy giọng còn lại. */
export function chooseUrl(audio: { us?: string; uk?: string; other?: string } | null | undefined, accent: 'us' | 'uk'): string | null {
  if (!audio) return null
  const order = accent === 'uk' ? [audio.uk, audio.us, audio.other] : [audio.us, audio.uk, audio.other]
  return order.find((u): u is string => !!u) ?? null
}

/** Chỉ tra bản ghi cho từ hoặc cụm ngắn (câu ví dụ dùng giọng máy). */
export function isShortTerm(text: string): boolean {
  const t = text.trim()
  return t.length > 0 && t.length <= 40 && t.split(/\s+/).length <= 4 && !/[.!?,;:]/.test(t)
}
