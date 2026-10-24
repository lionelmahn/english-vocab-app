import { useSyncExternalStore } from 'react'
import { bestVoice, langOf, rankVoices, type Accent } from '../core/voices'
import { chooseUrl, isShortTerm } from '../core/wordAudio'
import { getSettings } from '../lib/settings'
import { cachedWordUrl, resolveWordAudio } from './audio'

/**
 * Phát âm (R4.3, R7.1, R7.6):
 * 1. Từ và cụm ngắn: ưu tiên bản ghi giọng người thật (Wiktionary/Wikimedia Commons).
 * 2. Không có bản ghi, hoặc câu ví dụ: giọng đọc của thiết bị, chọn giọng chất lượng cao nhất có sẵn.
 */

export type { Accent }

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

// ---- Phát file âm thanh (một thẻ <audio> dùng chung) -------------------------------------------

const player: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null
if (player) player.preload = 'auto'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='

/**
 * iPhone chỉ cho phát âm thanh sau một lần chạm của người dùng. Ở lần chạm đầu tiên, "mở khóa"
 * thẻ <audio> dùng chung và bộ đọc của máy để những lần tự phát sau (khi hiện thẻ) không bị chặn.
 */
if (typeof document !== 'undefined') {
  const unlock = () => {
    if (player && !player.src) {
      player.src = SILENT_WAV
      void player.play().catch(() => undefined)
    }
    if (synth) synth.speak(new SpeechSynthesisUtterance(''))
    document.removeEventListener('pointerdown', unlock, true)
    document.removeEventListener('keydown', unlock, true)
  }
  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('keydown', unlock, true)
}

function playUrl(url: string, text: string, slow: boolean): Promise<boolean> {
  if (!player) return Promise.resolve(false)
  synth?.cancel()
  player.pause()
  return new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      player.onended = null
      player.onerror = null
      if (speakingText === text) speakingText = null
      emit()
      resolve(ok)
    }
    player.src = url
    player.playbackRate = slow ? 0.7 : 1
    ;(player as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    player.onended = () => done(true)
    player.onerror = () => done(false)
    speakingText = text
    emit()
    player.play().catch(() => done(false))
    setTimeout(() => done(true), 8000)
  })
}

// ---- Giọng đọc của thiết bị --------------------------------------------------------------------

export function speechAvailable(): boolean {
  return synth !== null || player !== null
}

/** iPhone/iPad (iPad đời mới báo mình là Mac nhưng có màn cảm ứng). */
export function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

/** Các giọng tiếng Anh trên máy (đã bỏ giọng vui nhộn, gộp giọng trùng), giọng tốt nhất trước. */
export function englishVoices(accent: Accent): SpeechSynthesisVoice[] {
  return rankVoices(voices, accent)
}

/** Giọng sẽ dùng để đọc. `auto` = bỏ qua giọng người học đã chọn (để hiện "Tự động (…)"). */
export function pickVoice(accent: Accent, auto = false): SpeechSynthesisVoice | undefined {
  const preferred = auto ? null : accent === 'uk' ? getSettings().voiceUK : getSettings().voiceUS
  return bestVoice(voices, accent, preferred)
}

/** Có giọng đúng chuẩn Anh–Anh/Anh–Mỹ hay phải dùng giọng tiếng Anh khác. */
export function hasExactVoice(accent: Accent): boolean {
  const want = accent === 'uk' ? 'en-gb' : 'en-us'
  return voices.some((v) => langOf(v) === want)
}

function speakWithVoice(text: string, accent: Accent, slow: boolean, voice?: SpeechSynthesisVoice): Promise<void> {
  if (!synth || !text.trim()) return Promise.resolve()
  player?.pause()
  synth.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const v = voice ?? pickVoice(accent)
    if (v) u.voice = v
    u.lang = v?.lang ?? (accent === 'uk' ? 'en-GB' : 'en-US')
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

export interface SpeakOptions {
  accent: Accent
  slow?: boolean
}

/** Đọc một từ/cụm/câu: ưu tiên bản ghi giọng người thật cho từ và cụm ngắn. */
export async function speak(text: string, { accent, slow = false }: SpeakOptions): Promise<void> {
  const t = text.trim()
  if (!t) return
  if (getSettings().preferRecordings && isShortTerm(t)) {
    let url = cachedWordUrl(t, accent)
    if (url === undefined) {
      // Chưa tra: chờ tối đa 1,5 giây, quá thì dùng giọng máy (lần sau sẽ có sẵn).
      const audio = await Promise.race([resolveWordAudio(t), new Promise<null>((r) => setTimeout(() => r(null), 1500))])
      url = chooseUrl(audio, accent)
    }
    if (url && (await playUrl(url, t, slow))) return
  }
  await speakWithVoice(t, accent, slow)
}

/** Nghe thử một giọng cụ thể của thiết bị (trong Cài đặt). */
export function previewVoice(voice: SpeechSynthesisVoice, accent: Accent): Promise<void> {
  return speakWithVoice('Practice makes perfect. I have an English examination next week.', accent, false, voice)
}

export function stopSpeaking(): void {
  synth?.cancel()
  player?.pause()
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
