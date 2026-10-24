/**
 * Chọn giọng đọc của thiết bị (hàm thuần, để test được).
 *
 * iPhone/iPad/Mac ghi chất lượng trong mã giọng (voiceURI): "com.apple.voice.compact.en-US.Samantha",
 * "...super-compact...", "...enhanced...", "...premium...". Windows/Android/Chrome ghi trong tên
 * ("Google US English", "Microsoft Aria Online (Natural)").
 *
 * Lưu ý: trên iPhone, Safari (và mọi trình duyệt dùng WebKit) chỉ cho trang web dùng giọng có sẵn của
 * máy; giọng tải thêm “Nâng cao/Cao cấp” trong Cài đặt không xuất hiện trong danh sách.
 */

export type Accent = 'us' | 'uk'

export interface VoiceInfo {
  name: string
  lang: string
  voiceURI: string
}

/** novelty: giọng vui nhộn / giọng robot cũ, không dùng để học phát âm. */
export type VoiceTier = 'premium' | 'enhanced' | 'standard' | 'low' | 'novelty'

const NOVELTY_NAMES =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|junior|ralph|fred|kathy|princess|agnes|bruce|vicki|victoria|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i

export function langOf(v: Pick<VoiceInfo, 'lang'>): string {
  return v.lang.replace('_', '-').toLowerCase()
}

export function voiceTier(v: VoiceInfo): VoiceTier {
  const id = v.voiceURI.toLowerCase()
  if (id.includes('eloquence') || NOVELTY_NAMES.test(v.name.trim())) return 'novelty'
  const all = `${id} ${v.name.toLowerCase()}`
  if (/premium|cao cấp|neural|natural|siri/.test(all)) return 'premium'
  if (/enhanced|nâng cao/.test(all)) return 'enhanced'
  if (/super-?compact/.test(all)) return 'low'
  return 'standard'
}

const TIER_SCORE: Record<VoiceTier, number> = { premium: 60, enhanced: 45, standard: 20, low: 0, novelty: -500 }
const GOOD_NAMES = /samantha|ava|zoe|evan|nathan|allison|susan|tom|daniel|serena|kate|oliver|arthur|martha|aria|jenny|guy|libby|sonia|ryan|karen|moira|tessa|alex/i

/** Điểm của một giọng cho giọng Anh–Mỹ/Anh–Anh; -1 nếu không phải giọng tiếng Anh. */
export function voiceScore(v: VoiceInfo, accent: Accent, preferredUri: string | null = null): number {
  const lang = langOf(v)
  if (!lang.startsWith('en')) return -1
  let s = lang === (accent === 'uk' ? 'en-gb' : 'en-us') ? 100 : 10
  s += TIER_SCORE[voiceTier(v)]
  if (/google/i.test(v.name)) s += 40
  if (GOOD_NAMES.test(v.name)) s += 15
  if (preferredUri && v.voiceURI === preferredUri) s += 1000
  return s
}

/**
 * Danh sách giọng tiếng Anh để người học chọn: bỏ giọng vui nhộn, gộp giọng trùng tên
 * (giữ bản tốt hơn, ví dụ Samantha thường thay cho Samantha bản nhẹ), giọng tốt nhất trước.
 */
export function rankVoices<V extends VoiceInfo>(voices: readonly V[], accent: Accent): V[] {
  const best = new Map<string, V>()
  for (const v of voices) {
    if (voiceScore(v, accent) < 0 || voiceTier(v) === 'novelty') continue
    const key = `${v.name.trim().toLowerCase()}|${langOf(v)}`
    const prev = best.get(key)
    if (!prev || voiceScore(v, accent) > voiceScore(prev, accent)) best.set(key, v)
  }
  return [...best.values()].sort((a, b) => voiceScore(b, accent) - voiceScore(a, accent))
}

/** Giọng sẽ dùng: giọng người học đã chọn (nếu máy còn), không thì giọng tốt nhất. */
export function bestVoice<V extends VoiceInfo>(voices: readonly V[], accent: Accent, preferredUri: string | null = null): V | undefined {
  if (preferredUri) {
    const chosen = voices.find((v) => v.voiceURI === preferredUri)
    if (chosen) return chosen
  }
  return rankVoices(voices, accent)[0]
}

/** Tên hiển thị kèm chất lượng: "Samantha (Nâng cao) · en-US". */
export function voiceLabel(v: VoiceInfo): string {
  const tier = voiceTier(v)
  const suffix = tier === 'premium' ? 'Cao cấp' : tier === 'enhanced' ? 'Nâng cao' : tier === 'low' ? 'bản nhẹ' : null
  const name = v.name.trim()
  const hasSuffix = suffix && name.toLowerCase().includes(suffix.toLowerCase())
  return `${name}${suffix && !hasSuffix && !/\(.*\)/.test(name) ? ` (${suffix})` : ''} · ${v.lang.replace('_', '-')}`
}
