import { chooseUrl, isShortTerm, withoutFlagged } from './wordAudio'

/**
 * Âm thanh khi không có mạng (R11.6, R11.8): mỗi từ sẽ được đọc bằng gì, và cần tải gì về máy trước.
 * Cùng thứ tự với lúc phát (services/speech): bản người học chọn → Giọng iPhone → bản ghi Wiktionary → giọng máy.
 */

export type OfflineState =
  /** Bản người học tự ghi âm hoặc tải lên, đã có trên máy. */
  | 'own'
  /** Giọng iPhone đã tạo trên máy. */
  | 'clip'
  /** File bản ghi đã tải về máy. */
  | 'saved'
  /** Có bản ghi nhưng chưa tải về: mất mạng thì đọc bằng giọng máy. */
  | 'missing'
  /** Chưa tra Wiktionary nên chưa biết có bản ghi không. */
  | 'unknown'
  /** Không có bản ghi (hoặc câu dài, hoặc tắt ưu tiên giọng người thật): đọc bằng giọng máy, vốn có sẵn. */
  | 'voice'

export interface OwnChoice {
  id: string
  source: 'recording' | 'upload' | 'dictionary' | string
  /** Bản Wiktionary người học chọn. */
  remoteUrl?: string
  /** File trên kho máy chủ (bản ghi âm tạo ở máy khác). */
  storagePath?: string
}

export interface WordAudioInput {
  term: string
  accent: 'us' | 'uk'
  /** Bản người học chọn cho giọng này (đã chọn theo thứ tự ưu tiên), nếu có. */
  own: OwnChoice | null
  /** File của bản người học đã có trên máy. */
  ownLocal: boolean
  /** Bản Wiktionary người học báo đọc sai. */
  flagged: ReadonlySet<string>
  hasClip: boolean
  /** Kết quả tra Wiktionary đã lưu: undefined = chưa tra, null = không có bản ghi. */
  recordings: { us?: string; uk?: string; other?: string } | null | undefined
  preferRecordings: boolean
  /** Các file bản ghi đã tải về máy. */
  saved: ReadonlySet<string>
}

export interface WordAudioPlan {
  state: OfflineState
  /** File cần tải về (bản ghi Wiktionary hoặc bản Wiktionary người học chọn). */
  url?: string
  /** Bản ghi âm của người học cần lấy từ kho máy chủ. */
  ownId?: string
}

export function planWordAudio(w: WordAudioInput): WordAudioPlan {
  const own = w.own
  if (own) {
    if (own.source === 'dictionary' && own.remoteUrl) return w.saved.has(own.remoteUrl) ? { state: 'saved', url: own.remoteUrl } : { state: 'missing', url: own.remoteUrl }
    if (own.source !== 'dictionary') {
      if (w.ownLocal) return { state: 'own' }
      if (own.storagePath) return { state: 'missing', ownId: own.id }
    }
  }
  if (w.hasClip) return { state: 'clip' }
  if (!w.preferRecordings || !isShortTerm(w.term)) return { state: 'voice' }
  if (w.recordings === undefined) return { state: 'unknown' }
  const url = chooseUrl(withoutFlagged(w.recordings, w.flagged), w.accent)
  if (!url) return { state: 'voice' }
  return w.saved.has(url) ? { state: 'saved', url } : { state: 'missing', url }
}

export interface OfflineSummary {
  total: number
  /** Đọc được bằng âm thanh thật khi mất mạng (bản của người học, Giọng iPhone, bản ghi đã tải). */
  ready: number
  /** Trong số đó, đọc bằng file bản ghi đã tải (xóa được). */
  saved: number
  /** Cần tải (có bản ghi chưa tải, hoặc chưa biết). */
  pending: number
  /** Đọc bằng giọng máy (không có gì để tải). */
  voice: number
}

export function summarize(plans: readonly WordAudioPlan[]): OfflineSummary {
  const s: OfflineSummary = { total: plans.length, ready: 0, saved: 0, pending: 0, voice: 0 }
  for (const p of plans) {
    if (p.state === 'saved') s.saved++
    if (p.state === 'own' || p.state === 'clip' || p.state === 'saved') s.ready++
    else if (p.state === 'missing' || p.state === 'unknown') s.pending++
    else s.voice++
  }
  return s
}
