import { getSettings, type TapStyle } from './settings'

/**
 * Âm thanh hiệu ứng, tạo bằng Web Audio (không cần file âm thanh): mỗi ngữ cảnh một tiếng ngắn và nhẹ. Tiếng chạm
 * (bấm nút, chuyển tab, bật/tắt, mở bảng, lật thẻ) tắt riêng được bằng "Tiếng chạm nút"; mọi tiếng tắt chung bằng
 * "Âm thanh hiệu ứng" trong Cá nhân.
 */

export type Sfx =
  | 'tap'
  | 'nav'
  | 'back'
  | 'select'
  | 'toggleOn'
  | 'toggleOff'
  | 'open'
  | 'close'
  | 'flip'
  | 'success'
  | 'ready'
  | 'message'
  | 'correct'
  | 'almost'
  | 'wrong'
  | 'error'
  | 'reject'
  | 'delete'
  | 'hint'
  | 'star'
  | 'recStart'
  | 'recStop'
  | 'complete'
  | 'achievement'

/** Tiếng chạm: phát ngay khi bấm, tắt riêng được. */
export const TAP_SOUNDS: ReadonlySet<Sfx> = new Set<Sfx>(['tap', 'nav', 'back', 'select', 'toggleOn', 'toggleOff', 'open', 'close', 'flip'])

/** Các tiếng chạm đổi theo "Kiểu tiếng chạm". */
export type StyledSfx = 'tap' | 'nav' | 'back' | 'select' | 'toggleOn' | 'toggleOff'
const STYLED: readonly StyledSfx[] = ['tap', 'nav', 'back', 'select', 'toggleOn', 'toggleOff']

/**
 * Một lớp âm: `tone` là một nốt (có thể trượt cao độ tới `to`), `bell` là nốt kiểu chuông (thêm hai họa âm, tắt
 * dần), `swish` là tiếng gió (nhiễu trắng qua bộ lọc trượt từ `from` tới `to`). `at`, `len` tính bằng giây.
 */
export type Layer =
  | { kind: 'tone'; f: number; to?: number; at?: number; len: number; gain: number; wave?: OscillatorType; attack?: number }
  | { kind: 'bell'; f: number; at?: number; len: number; gain: number }
  | { kind: 'swish'; from: number; to: number; at?: number; len: number; gain: number }

const tone = (f: number, len: number, gain: number, more: { to?: number; at?: number; wave?: OscillatorType; attack?: number } = {}): Layer => ({ kind: 'tone', f, len, gain, ...more })
const bell = (f: number, at: number, len: number, gain: number): Layer => ({ kind: 'bell', f, at, len, gain })
const swish = (from: number, to: number, len: number, gain: number, at = 0): Layer => ({ kind: 'swish', from, to, len, gain, at })
/** Ba nốt cao lấp lánh. */
const sparkle = (at: number, gain: number): Layer[] => [2093, 2637, 3136].map((f, i) => tone(f, 0.12, gain, { at: at + i * 0.045 }))
/** Tiếng "tách" giòn: một chút nhiễu ở dải cao, không có cao độ nên không nghe như gõ gỗ. */
const tick = (from: number, to: number, gain: number, at = 0, len = 0.02): Layer => swish(from, to, len, gain, at)

/**
 * Tiếng chạm theo từng kiểu. Nốt ngắn ở âm vực trung, tắt nhanh (kiểu bản 0.33.0) nghe như gõ mõ, nên cả ba kiểu đều
 * tránh: "Tách nhẹ" chỉ là tiếng tách không cao độ, như bàn phím iPhone; "Bong bóng" trượt nhanh lên cao; "Pha lê" là
 * chuông nhỏ ngân.
 */
export const TAP_STYLES: Record<TapStyle, Record<StyledSfx, readonly Layer[]>> = {
  soft: {
    tap: [tick(4200, 3000, 0.09)],
    nav: [tick(3400, 2400, 0.08, 0, 0.03)],
    back: [tick(3000, 1800, 0.075, 0, 0.035)],
    select: [tick(5400, 4200, 0.09)],
    toggleOn: [tick(3200, 3600, 0.075), tick(4800, 5400, 0.08, 0.05)],
    toggleOff: [tick(5000, 4400, 0.075), tick(3400, 2800, 0.07, 0.05)],
  },
  bubble: {
    tap: [tone(900, 0.045, 0.035, { to: 1800, attack: 0.008 })],
    nav: [tone(1100, 0.05, 0.034, { to: 2000, attack: 0.01 })],
    back: [tone(1600, 0.05, 0.03, { to: 900, attack: 0.01 })],
    select: [tone(1250, 0.045, 0.035, { to: 2400, attack: 0.008 })],
    toggleOn: [tone(1000, 0.04, 0.03, { to: 1500, attack: 0.008 }), tone(1500, 0.05, 0.03, { at: 0.045, to: 2300, attack: 0.008 })],
    toggleOff: [tone(1900, 0.04, 0.028, { to: 1300, attack: 0.008 }), tone(1300, 0.05, 0.026, { at: 0.045, to: 800, attack: 0.008 })],
  },
  glass: {
    tap: [bell(2349, 0, 0.12, 0.024)],
    nav: [bell(1976, 0, 0.14, 0.024)],
    back: [bell(1760, 0, 0.12, 0.022)],
    select: [bell(2637, 0, 0.12, 0.024)],
    toggleOn: [bell(1760, 0, 0.1, 0.022), bell(2637, 0.05, 0.14, 0.022)],
    toggleOff: [bell(2637, 0, 0.1, 0.02), bell(1760, 0.05, 0.14, 0.02)],
  },
}

export const SOUNDS: Record<Sfx, readonly Layer[]> = {
  ...TAP_STYLES.soft,
  // Mở bảng: gió nhẹ đi lên; đóng: đi xuống.
  open: [swish(600, 2200, 0.14, 0.045)],
  close: [swish(2000, 650, 0.12, 0.035)],
  // Lật thẻ: tiếng "phựt" của tấm thẻ.
  flip: [swish(1600, 900, 0.09, 0.05)],
  // Lưu xong, thêm xong: hai tiếng chuông sáng.
  success: [bell(1047, 0, 0.3, 0.045), bell(1568, 0.07, 0.4, 0.04)],
  // AI trả lời xong: ba tiếng chuông nhỏ đi lên.
  ready: [bell(1319, 0, 0.3, 0.035), bell(1760, 0.06, 0.32, 0.03), bell(2093, 0.12, 0.45, 0.026)],
  // Tin nhắn mới trong hội thoại: hai tiếng chuông nhỏ.
  message: [bell(1319, 0, 0.2, 0.03), bell(1760, 0.08, 0.28, 0.028)],
  correct: [bell(880, 0, 0.25, 0.055), bell(1319, 0.09, 0.45, 0.055)],
  // Gần đúng: hai nốt sát nhau, nghe như "suýt nữa".
  almost: [bell(880, 0, 0.22, 0.045), bell(988, 0.1, 0.3, 0.038)],
  // Sai: hai nốt đi xuống ("ồ ồ"), vào chậm để mềm chứ không thành tiếng gõ.
  wrong: [tone(392, 0.2, 0.05, { to: 370, attack: 0.025 }), tone(311, 0.28, 0.05, { at: 0.13, to: 294, attack: 0.025 })],
  error: [bell(659, 0, 0.25, 0.035), bell(523, 0.1, 0.3, 0.035)],
  // Gõ quá số chữ, thao tác không được: hai tiếng tách trầm.
  reject: [tick(1800, 1300, 0.08, 0, 0.03), tick(1500, 1000, 0.07, 0.06, 0.03)],
  delete: [tone(420, 0.22, 0.045, { to: 140, attack: 0.025 }), swish(900, 300, 0.16, 0.025)],
  hint: sparkle(0, 0.022),
  // Đánh dấu yêu thích: một tiếng chuông kèm lấp lánh.
  star: [bell(1568, 0, 0.3, 0.035), ...sparkle(0.05, 0.018)],
  recStart: [bell(1047, 0, 0.16, 0.035), bell(1568, 0.07, 0.22, 0.035)],
  recStop: [bell(1568, 0, 0.16, 0.035), bell(1047, 0.07, 0.22, 0.035)],
  // Xong buổi học: hợp âm rải Đô–Mi–Son–Đô rồi một tiếng ngân cao.
  complete: [523, 659, 784, 1047].map((f, i) => bell(f, i * 0.08, 0.35, 0.042)).concat(bell(2093, 0.34, 0.6, 0.022)),
  // Đạt huy hiệu: rải nhanh lên cao và lấp lánh.
  achievement: [784, 988, 1175, 1568, 1976].map((f, i) => bell(f, i * 0.06, 0.4, 0.036)).concat(sparkle(0.32, 0.02)),
}

// ---- Phát tiếng ---------------------------------------------------------------------------------

let ctx: AudioContext | null = null
let out: AudioNode | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
  try {
    if (!ctx) {
      ctx = new AudioContext()
      // Nhiều tiếng chồng lên nhau (chạm rồi báo đúng) qua bộ nén để không bị rè.
      const master = ctx.createGain()
      master.gain.value = 0.9
      master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination)
      out = master
    }
    // iPhone tạm dừng âm thanh khi app chạy nền; mở lại ở lần chạm tiếp theo.
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined)
    return ctx
  } catch {
    return null
  }
}

function envelope(a: AudioContext, t0: number, len: number, gain: number, attack = 0.006): GainNode {
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
  g.connect(out!)
  return g
}

function osc(a: AudioContext, t0: number, f: number, len: number, gain: number, wave: OscillatorType = 'sine', to?: number, attack?: number) {
  const o = a.createOscillator()
  o.type = wave
  o.frequency.setValueAtTime(f, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + len * 0.8)
  o.connect(envelope(a, t0, len, gain, attack))
  o.start(t0)
  o.stop(t0 + len + 0.02)
}

function render(a: AudioContext, layer: Layer) {
  const t0 = a.currentTime + 0.005 + (layer.at ?? 0)
  if (layer.kind === 'tone') return osc(a, t0, layer.f, layer.len, layer.gain, layer.wave, layer.to, layer.attack)
  if (layer.kind === 'bell') {
    osc(a, t0, layer.f, layer.len, layer.gain, 'sine', undefined, 0.003)
    osc(a, t0, layer.f * 2.76, layer.len * 0.5, layer.gain * 0.25, 'sine', undefined, 0.003)
    osc(a, t0, layer.f * 5.4, layer.len * 0.25, layer.gain * 0.08, 'sine', undefined, 0.002)
    return
  }
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const src = a.createBufferSource()
  src.buffer = noise
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(layer.from, t0)
  filter.frequency.exponentialRampToValueAtTime(layer.to, t0 + layer.len)
  src.connect(filter).connect(envelope(a, t0, layer.len, layer.gain, layer.len * 0.3))
  src.start(t0, Math.random() * 0.5)
  src.stop(t0 + layer.len + 0.02)
}

let pendingTap: ReturnType<typeof setTimeout> | undefined
/** Lúc phát tiếng sự kiện (không phải tiếng chạm) gần nhất. */
let lastEvent = 0

/** Các lớp âm của một tiếng, theo kiểu tiếng chạm đang chọn. */
export function layersOf(name: Sfx, style: TapStyle = getSettings().tapStyle): readonly Layer[] {
  return (STYLED as readonly Sfx[]).includes(name) ? (TAP_STYLES[style] ?? TAP_STYLES.soft)[name as StyledSfx] : SOUNDS[name]
}

/** Tiếng này đang được bật trong cài đặt không. */
export function sfxAllowed(name: Sfx, settings: { soundEffects: boolean; tapSounds: boolean } = getSettings()): boolean {
  return settings.soundEffects && (settings.tapSounds || !TAP_SOUNDS.has(name))
}

/** Phát một tiếng. Tiếng chạm của lần bấm đang chờ phát thì bỏ: tiếng của chính sự việc (mở bảng, báo đúng…) thay nó. */
export function play(name: Sfx): void {
  clearTimeout(pendingTap)
  pendingTap = undefined
  if (!sfxAllowed(name) || (typeof document !== 'undefined' && document.hidden)) return
  const a = audio()
  if (!a || !out) return
  if (!TAP_SOUNDS.has(name)) lastEvent = Date.now()
  for (const layer of layersOf(name)) render(a, layer)
}

/** Phát nếu chưa có tiếng sự kiện nào trong `ms` vừa qua (ví dụ thông báo "Đã xóa" ngay sau tiếng xóa thì thôi). */
export function playIfQuiet(name: Sfx, ms = 400): void {
  if (Date.now() - lastEvent < ms) return
  play(name)
}

const TAPPABLE = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary'

/**
 * Tiếng chạm cho cả app: bấm nút hoặc link thì phát tiếng theo `data-sfx` của nút (hoặc vùng chứa nó), mặc định
 * "tap"; `data-sfx="none"` để im. Tiếng được hẹn sau lượt xử lý cú bấm, nên nếu cú bấm gây ra tiếng riêng (mở bảng,
 * báo đúng, bắt đầu ghi âm) thì chỉ nghe tiếng riêng đó. Trả về hàm gỡ.
 */
export function installTapSounds(root: Document = document): () => void {
  const onClick = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.(TAPPABLE)
    if (!el || el.getAttribute('aria-disabled') === 'true') return
    const kind = el.closest('[data-sfx]')?.getAttribute('data-sfx') ?? 'tap'
    if (!(kind in SOUNDS)) return
    clearTimeout(pendingTap)
    pendingTap = setTimeout(() => play(kind as Sfx), 0)
  }
  // iPhone chỉ cho mở âm thanh trong lúc người dùng chạm: chuẩn bị sẵn ở lần chạm đầu.
  const unlock = () => {
    if (getSettings().soundEffects) audio()
  }
  root.addEventListener('click', onClick, true)
  root.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  return () => {
    root.removeEventListener('click', onClick, true)
    root.removeEventListener('pointerdown', unlock, { capture: true })
  }
}

/** Hẹn giờ của lần nghe thử đang phát: nghe thử lần mới thì bỏ phần còn lại của lần cũ. */
let demoTimers: ReturnType<typeof setTimeout>[] = []

function playSequence(names: Sfx[], gap: number) {
  demoTimers.forEach(clearTimeout)
  play(names[0])
  demoTimers = names.slice(1).map((name, i) => setTimeout(() => play(name), (i + 1) * gap))
}

/** Nghe thử kiểu tiếng chạm vừa chọn: chạm, chọn, bật, chuyển tab. */
export function playTapStyleDemo(): void {
  playSequence(['tap', 'select', 'toggleOn', 'nav'], 280)
}

/** Nghe thử vài tiếng tiêu biểu (Cá nhân → Âm thanh hiệu ứng). */
export function playDemo(): void {
  playSequence(['tap', 'toggleOn', 'open', 'success', 'correct', 'almost', 'wrong', 'complete'], 650)
}
