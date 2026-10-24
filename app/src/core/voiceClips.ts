/**
 * "Giọng iPhone": nhờ app Phím tắt (Shortcuts) đọc từ/câu bằng giọng Nâng cao/Cao cấp đã tải trên iPhone
 * (trang web không dùng thẳng được các giọng này), rồi trả file âm thanh về app qua bảng tạm.
 *
 * Luồng: app mở `shortcuts://run-shortcut?...&input=text` với mỗi mục một dòng → phím tắt đọc từng dòng,
 * mã hóa Base64, nối bằng dấu "|" và chép vào bảng tạm → người học quay lại app, bấm "Dán âm thanh".
 * File này là hàm thuần (tạo yêu cầu, đọc kết quả) để test được.
 */

/** Số mục mỗi lần chạy phím tắt (đủ nhanh, bảng tạm không quá lớn). */
export const CLIP_BATCH = 40
export const DEFAULT_SHORTCUT_NAME = 'VocabVoice'

/** Khóa tra cứu: không phân biệt hoa thường và khoảng trắng thừa. */
export function clipKey(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Một mục gửi sang phím tắt phải nằm trên một dòng. */
export function cleanClipText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** Danh sách gửi sang phím tắt (mỗi mục một dòng); app cũng chép nó vào bộ nhớ tạm. */
export function requestText(texts: readonly string[]): string {
  return texts.map(cleanClipText).join('\n')
}

export function shortcutRunUrl(name: string, texts: readonly string[]): string {
  const input = requestText(texts)
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name.trim())}&input=text&text=${encodeURIComponent(input)}`
}

export interface ClipTarget {
  text: string
  kind: 'term' | 'sentence'
}

/** Những gì cần tạo giọng: từ vựng trước (học và ôn dùng nhiều nhất), rồi câu ví dụ; bỏ mục đã có, không lặp. */
export function clipTargets(items: readonly { term: string; examples: readonly { en: string }[] }[], have: ReadonlySet<string>): ClipTarget[] {
  const seen = new Set(have)
  const out: ClipTarget[] = []
  const add = (raw: string, kind: ClipTarget['kind']) => {
    const text = cleanClipText(raw)
    const key = clipKey(text)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({ text, kind })
  }
  for (const it of items) add(it.term, 'term')
  for (const it of items) for (const ex of it.examples) add(ex.en, 'sentence')
  return out
}

export type AudioMime = 'audio/mp4' | 'audio/wav' | 'audio/x-caf' | 'audio/aiff' | 'audio/mpeg'

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to))
}

/** Nhận diện file âm thanh theo vài byte đầu (Phím tắt thường xuất .m4a). */
export function sniffAudio(bytes: Uint8Array): AudioMime | null {
  if (bytes.length < 12) return null
  if (ascii(bytes, 4, 8) === 'ftyp') return 'audio/mp4'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') return 'audio/wav'
  if (ascii(bytes, 0, 4) === 'caff') return 'audio/x-caf'
  if (ascii(bytes, 0, 4) === 'FORM') return 'audio/aiff'
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  return null
}

export function decodeBase64(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, '')
  if (!clean || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) return null
  try {
    const bin = atob(clean)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export interface DecodedClip {
  bytes: Uint8Array
  mime: AudioMime
}

export type PasteResult =
  | { ok: true; clips: DecodedClip[] }
  | { ok: false; reason: 'empty' | 'not_audio' | 'count' | 'unchanged'; got?: number }
  /** Phím tắt mã hóa chữ thay vì âm thanh (bước "Mã hóa" lấy nhầm "Lặp lại mục"). */
  | { ok: false; reason: 'text'; sample: string }

/** Nội dung giải mã ra là chữ đọc được (không phải âm thanh). */
function asText(bytes: Uint8Array): string | null {
  if (bytes.length === 0 || bytes.length > 2000) return null
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return /^[\p{L}\p{N}\p{P}\p{Zs}]+$/u.test(text) ? text : null
  } catch {
    return null
  }
}

/**
 * Đọc nội dung dán vào: các file Base64 nối bằng "|" (hoặc mỗi file một dòng nếu Base64 không ngắt dòng).
 * Số file phải đúng bằng số mục đã gửi, nếu không sẽ gán nhầm âm thanh cho từ.
 */
export function parsePasted(raw: string, expected: number, sent?: string): PasteResult {
  const text = raw.trim()
  if (!text) return { ok: false, reason: 'empty' }
  // Bộ nhớ tạm vẫn là danh sách app vừa chép: phím tắt chưa chạy xong hoặc chưa chép kết quả.
  if (sent !== undefined && text === sent.trim()) return { ok: false, reason: 'unchanged' }
  let parts: string[]
  if (text.includes('|')) parts = text.split('|').map((p) => p.replace(/\s+/g, '')).filter(Boolean)
  else {
    // Không có "|": hoặc mỗi file một dòng (Base64 không ngắt dòng), hoặc chỉ có một file bị ngắt mỗi 76 ký tự.
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, ''))
      .filter(Boolean)
    const eachLineIsClip = lines.length > 1 && lines.every((l) => isAudioB64(l))
    parts = eachLineIsClip ? lines : [text.replace(/\s+/g, '')]
  }

  const clips: DecodedClip[] = []
  for (const p of parts) {
    const bytes = decodeBase64(p)
    const mime = bytes && sniffAudio(bytes)
    if (!bytes || !mime) {
      const text = bytes && asText(bytes)
      if (text) return { ok: false, reason: 'text', sample: text }
      // Phần đầu đã là âm thanh mà phần sau hỏng: thường do tách sai (ngắt dòng Base64 + dấu phân cách "Dòng mới").
      if (clips.length > 0 && parts.length !== expected) return { ok: false, reason: 'count', got: parts.length }
      return { ok: false, reason: 'not_audio' }
    }
    clips.push({ bytes, mime })
  }
  if (clips.length !== expected) return { ok: false, reason: 'count', got: clips.length }
  return { ok: true, clips }
}

function isAudioB64(part: string): boolean {
  const bytes = decodeBase64(part)
  return !!bytes && sniffAudio(bytes) !== null
}

/** Dấu vết ngắn của nội dung đã dán, để không dán lại kết quả cũ cho một lượt mới. */
export function pasteFingerprint(raw: string): string {
  const t = raw.trim()
  return `${t.length}:${t.slice(0, 64)}:${t.slice(-64)}`
}
