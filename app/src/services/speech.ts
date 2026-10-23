import { useSyncExternalStore } from 'react'

/**
 * Phát âm bằng giọng đọc có sẵn trên thiết bị (R4.3, R7.1, R7.6). Miễn phí, chạy cả khi mất mạng
 * nếu máy có giọng tiếng Anh. Âm thanh từ điển và TTS đám mây sẽ bổ sung ở giai đoạn 2 (R7.8).
 */

export type Accent = 'us' | 'uk'

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
let voices: SpeechSynthesisVoice[] = []
let speakingText: string | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function loadVoices() {
  voices = synth?.getVoices() ?? []
  emit()
}

if (synth) {
  loadVoices()
  synth.addEventListener?.('voiceschanged', loadVoices)
}

export function speechAvailable(): boolean {
  return synth !== null
}

const PREFERRED = /(natural|enhanced|premium|neural|google|samantha|daniel|serena|aria|jenny|guy|libby|sonia)/i

function langOf(v: SpeechSynthesisVoice): string {
  return v.lang.replace('_', '-').toLowerCase()
}

/** Chọn giọng khớp Anh–Mỹ/Anh–Anh, ưu tiên giọng chất lượng cao; không có thì lấy giọng tiếng Anh bất kỳ. */
export function pickVoice(accent: Accent, list: readonly SpeechSynthesisVoice[] = voices): SpeechSynthesisVoice | undefined {
  const want = accent === 'uk' ? 'en-gb' : 'en-us'
  const exact = list.filter((v) => langOf(v) === want)
  const pool = exact.length > 0 ? exact : list.filter((v) => langOf(v).startsWith('en'))
  return pool.find((v) => PREFERRED.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0]
}

/** Có giọng đúng chuẩn Anh–Anh/Anh–Mỹ hay phải dùng giọng tiếng Anh khác. */
export function hasExactVoice(accent: Accent): boolean {
  const want = accent === 'uk' ? 'en-gb' : 'en-us'
  return voices.some((v) => langOf(v) === want)
}

export interface SpeakOptions {
  accent: Accent
  slow?: boolean
}

export function speak(text: string, { accent, slow = false }: SpeakOptions): Promise<void> {
  if (!synth || !text.trim()) return Promise.resolve()
  synth.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(accent)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? (accent === 'uk' ? 'en-GB' : 'en-US')
    u.rate = slow ? 0.65 : 0.95
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (speakingText === text) speakingText = null
      emit()
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    // Một số trình duyệt không gọi onend: tự kết thúc sau thời gian ước lượng.
    setTimeout(finish, Math.max(2500, text.length * (slow ? 160 : 110)))
    speakingText = text
    emit()
    synth.speak(u)
  })
}

export function stopSpeaking(): void {
  synth?.cancel()
  speakingText = null
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Văn bản đang được đọc (để hiệu ứng nút loa). */
export function useSpeaking(): string | null {
  return useSyncExternalStore(subscribe, () => speakingText)
}

export function useVoicesReady(): number {
  return useSyncExternalStore(subscribe, () => voices.length)
}
