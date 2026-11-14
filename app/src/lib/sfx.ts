import { getSettings } from './settings'

/**
 * Âm thanh hiệu ứng, tạo bằng Web Audio (không cần file âm thanh): mỗi ngữ cảnh một tiếng ngắn và nhẹ. Tiếng chạm
 * (bấm nút, chuyển tab, bật/tắt, mở bảng, lật thẻ) tắt riêng được bằng "Tiếng chạm nút"; mọi tiếng tắt chung bằng
 * "Âm thanh hiệu ứng" trong Cá nhân.
 *
 * Tiếng của từng ngữ cảnh do người dùng tự chọn trên trang "Phòng thử âm thanh" (15/11/2026): mỗi họ tiếng (bong bóng,
 * hoạt hình, phím đàn mềm…) biến các nốt của ngữ cảnh thành lớp âm, đúng công thức của trang đó.
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

/**
 * Một lớp âm: `tone` là một nốt (có thể trượt cao độ tới `to`, rung `vib` lần mỗi giây), `bell` là nốt kiểu chuông
 * (thêm họa âm theo `ratios`, tắt dần), `swish` là tiếng gió (nhiễu trắng qua bộ lọc trượt từ `from` tới `to`).
 * `at`, `len` tính bằng giây.
 */
export type Layer =
  | { kind: 'tone'; f: number; to?: number; at?: number; len: number; gain: number; wave?: OscillatorType; attack?: number; vib?: number }
  | { kind: 'bell'; f: number; at?: number; len: number; gain: number; ratios?: readonly number[]; gains?: readonly number[] }
  | { kind: 'swish'; from: number; to: number; at?: number; len: number; gain: number }

type ToneOpts = { to?: number; at?: number; wave?: OscillatorType; attack?: number; vib?: number }
const tone = (f: number, len: number, gain: number, more: ToneOpts = {}): Layer => ({ kind: 'tone', f, len, gain, ...more })
const bell = (f: number, at: number, len: number, gain: number, ratios?: readonly number[], gains?: readonly number[]): Layer => ({ kind: 'bell', f, at, len, gain, ratios, gains })
const swish = (from: number, to: number, len: number, gain: number, at = 0): Layer => ({ kind: 'swish', from, to, len, gain, at })
/** Ba nốt cao lấp lánh. */
const sparkle = (at: number, gain: number): Layer[] => [2093, 2637, 3136].map((f, i) => tone(f, 0.12, gain, { at: at + i * 0.045 }))
const lim = (f: number) => Math.min(5200, Math.max(150, f))

/** Một nốt của ngữ cảnh: cao độ (Hz), lúc bắt đầu và độ dài (giây). */
type Note = readonly [f: number, at: number, len: number]

/** Họ tiếng: biến một nốt thành các lớp âm (giống hệt "Phòng thử âm thanh"). */
export const FAMILIES = {
  /** Bóp nhỏ trượt lên cao. */
  bubble: (f: number, at: number, len: number, g: number): Layer[] => [tone(f * 0.6, Math.min(0.08, len + 0.03), 0.035 * g, { to: f * 1.3, at, attack: 0.008 })],
  /** Tiếng "tõm" trong và cao. */
  drop: (f: number, at: number, _len: number, g: number): Layer[] => [
    tone(f * 0.9, 0.05, 0.034 * g, { to: lim(f * 2.1), at, attack: 0.004 }),
    tone(lim(f * 2.1), 0.1, 0.012 * g, { at: at + 0.03, attack: 0.01 }),
  ],
  /** Chuông thủy tinh nhỏ. */
  glass: (f: number, at: number, len: number, g: number): Layer[] => [bell(lim(f * 1.6), at, len + 0.16, 0.026 * g)],
  /** Hộp nhạc lên dây cót. */
  musicbox: (f: number, at: number, len: number, g: number): Layer[] => [bell(lim(f * 1.5), at, len + 0.45, 0.03 * g, [3.0, 4.16], [0.16, 0.06])],
  /** Đàn ngón tay, ấm và tròn. */
  kalimba: (f: number, at: number, len: number, g: number): Layer[] => [bell(lim(f * 0.75), at, len + 0.6, 0.04 * g, [5.9, 8.4], [0.14, 0.05])],
  /** Máy chơi game cổ điển. */
  chip: (f: number, at: number, len: number, g: number): Layer[] => [tone(f, Math.max(0.06, len), 0.016 * g, { at, wave: 'square', attack: 0.002 })],
  /** Hoạt hình: trượt cao độ, rung vui. */
  toon: (f: number, at: number, len: number, g: number): Layer[] => [tone(f * 0.55, len + 0.09, 0.035 * g, { to: f * 1.25, at, vib: 16, attack: 0.01 })],
  /** Đàn điện tử êm, hơi ngân. */
  synth: (f: number, at: number, len: number, g: number): Layer[] => [
    tone(f, len + 0.35, 0.03 * g, { at, attack: 0.006 }),
    tone(lim(f * 2), len + 0.15, 0.008 * g, { at, wave: 'triangle', attack: 0.006 }),
  ],
} as const
export type Family = keyof typeof FAMILIES

const play_ = (family: Family, notes: readonly Note[], g = 1): Layer[] => notes.flatMap(([f, at, len]) => FAMILIES[family](f, at, len, g))

/** Tiếng của từng ngữ cảnh: họ tiếng người dùng chọn cùng các nốt của ngữ cảnh đó. */
export const SOUNDS: Record<Sfx, readonly Layer[]> = {
  tap: play_('bubble', [[1047, 0, 0.04]]),
  nav: play_('bubble', [[880, 0, 0.05]]),
  select: play_('toon', [[1319, 0, 0.04]]),
  back: play_('toon', [
    [1175, 0, 0.035],
    [880, 0.045, 0.045],
  ]),
  toggleOn: play_('toon', [
    [880, 0, 0.045],
    [1319, 0.06, 0.06],
  ]),
  toggleOff: play_('toon', [
    [1319, 0, 0.045],
    [880, 0.06, 0.06],
  ]),
  open: play_('toon', [
    [784, 0, 0.04],
    [1047, 0.04, 0.04],
    [1319, 0.08, 0.06],
  ]),
  close: play_('toon', [
    [1319, 0, 0.04],
    [1047, 0.04, 0.04],
    [784, 0.08, 0.06],
  ]),
  // Lật thẻ: một luồng gió.
  flip: [swish(1800, 800, 0.1, 0.06)],
  correct: play_('synth', [
    [1047, 0, 0.09],
    [1568, 0.1, 0.2],
  ]),
  almost: play_('synth', [
    [1047, 0, 0.09],
    [1175, 0.12, 0.18],
  ]),
  wrong: play_('synth', [
    [440, 0, 0.14],
    [349, 0.16, 0.24],
  ]),
  hint: play_(
    'kalimba',
    [
      [1568, 0, 0.05],
      [2093, 0.05, 0.05],
      [2637, 0.1, 0.08],
    ],
    0.8,
  ),
  reject: play_('glass', [
    [392, 0, 0.05],
    [392, 0.08, 0.05],
  ]),
  success: play_('kalimba', [
    [1319, 0, 0.08],
    [1760, 0.09, 0.16],
  ]),
  ready: play_('synth', [
    [1047, 0, 0.06],
    [1319, 0.07, 0.06],
    [1568, 0.14, 0.14],
  ]),
  message: play_('synth', [
    [1568, 0, 0.07],
    [1319, 0.09, 0.12],
  ]),
  error: play_('drop', [
    [587, 0, 0.1],
    [494, 0.13, 0.18],
  ]),
  delete: play_('drop', [
    [784, 0, 0.05],
    [587, 0.06, 0.05],
    [392, 0.12, 0.12],
  ]),
  star: play_(
    'toon',
    [
      [1568, 0, 0.05],
      [2093, 0.06, 0.05],
      [2637, 0.12, 0.05],
      [3136, 0.18, 0.12],
    ],
    0.8,
  ),
  recStart: play_('chip', [
    [880, 0, 0.06],
    [1319, 0.08, 0.1],
  ]),
  recStop: play_('chip', [
    [1319, 0, 0.06],
    [880, 0.08, 0.1],
  ]),
  // Xong buổi học: hộp nhạc rải Đô–Mi–Son–Đô.
  complete: play_('musicbox', [
    [523, 0, 0.09],
    [659, 0.09, 0.09],
    [784, 0.18, 0.09],
    [1047, 0.27, 0.35],
  ]),
  // Đạt huy hiệu: chuông rải nhanh lên cao và lấp lánh (giữ như bản 0.33.0).
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
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(len, attack + 0.01))
  g.connect(out!)
  return g
}

function osc(a: AudioContext, t0: number, f: number, len: number, gain: number, more: { wave?: OscillatorType; to?: number; attack?: number; vib?: number } = {}) {
  const o = a.createOscillator()
  o.type = more.wave ?? 'sine'
  o.frequency.setValueAtTime(f, t0)
  if (more.to) o.frequency.exponentialRampToValueAtTime(more.to, t0 + len * 0.8)
  if (more.vib) {
    // Rung cao độ (họ "hoạt hình"): một nốt thấp điều khiển tần số nốt chính, biên độ 5%.
    const lfo = a.createOscillator()
    const depth = a.createGain()
    lfo.frequency.value = more.vib
    depth.gain.value = f * 0.05
    lfo.connect(depth).connect(o.frequency)
    lfo.start(t0)
    lfo.stop(t0 + len + 0.05)
  }
  o.connect(envelope(a, t0, len, gain, more.attack))
  o.start(t0)
  o.stop(t0 + len + 0.03)
}

function render(a: AudioContext, layer: Layer) {
  const t0 = a.currentTime + 0.01 + (layer.at ?? 0)
  if (layer.kind === 'tone') return osc(a, t0, layer.f, layer.len, layer.gain, layer)
  if (layer.kind === 'bell') {
    const ratios = layer.ratios ?? [2.76, 5.4]
    const gains = layer.gains ?? [0.25, 0.08]
    osc(a, t0, layer.f, layer.len, layer.gain, { attack: 0.003 })
    ratios.forEach((r, i) => osc(a, t0, layer.f * r, layer.len * (i === 0 ? 0.5 : 0.25), layer.gain * (gains[i] ?? 0), { attack: 0.002 }))
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
  for (const layer of SOUNDS[name]) render(a, layer)
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

/** Nghe thử một lượt như khi học (Cá nhân → Giao diện và âm thanh): chạm, mở bảng, chọn, đúng, sai, lưu, xong buổi. */
export function playDemo(): void {
  const names: Sfx[] = ['tap', 'open', 'select', 'correct', 'select', 'wrong', 'hint', 'success', 'close', 'nav', 'complete']
  demoTimers.forEach(clearTimeout)
  play(names[0])
  demoTimers = names.slice(1).map((name, i) => setTimeout(() => play(name), (i + 1) * 650))
}
