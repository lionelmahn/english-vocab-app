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

/**
 * Lọc file âm thanh của đúng từ đang tra (bỏ file của từ khác, ví dụ "examinations").
 * Trả về tối đa một file cho mỗi giọng, ưu tiên file "En-us-/En-uk-" chuẩn.
 */
export function pickAudioFiles(term: string, fileTitles: readonly string[]): Partial<Record<AccentTag, string>> {
  const want = slug(term)
  const out: Partial<Record<AccentTag, string>> = {}
  for (const title of fileTitles) {
    const name = title.replace(/^File:/i, '')
    if (!AUDIO_FILE.test(name)) continue
    const base = slug(name)
    const accent = accentOf(name)
    let matches = false
    if (/^en [a-z]{2} /.test(base)) {
      // "En-us-…", "En-uk-…", "En-au-…": giọng tiếng Anh, tên file là đúng từ.
      matches = base.replace(/^en [a-z]{2} /, '') === want
    } else if (/^ll q1860 \(eng\) /.test(base)) {
      // Lingua Libre tiếng Anh: "LL-Q1860 (eng)-Người đọc-từ.wav".
      matches = base.endsWith(` ${want}`)
    }
    // File của ngôn ngữ khác ("De-abundant.ogg", "LL-Q188 (deu)-…") bị bỏ qua.
    if (matches && !out[accent]) out[accent] = name
  }
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
