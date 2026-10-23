import { getSettings } from './settings'

/** Âm báo ngắn khi đúng/sai, tạo bằng Web Audio (không cần file âm thanh). Tắt được trong Cá nhân. */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, length: number, type: OscillatorType, gain: number) {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + start
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + length)
  osc.connect(g).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + length + 0.02)
}

export function playCorrect() {
  if (!getSettings().soundEffects) return
  tone(880, 0, 0.12, 'sine', 0.12)
  tone(1320, 0.08, 0.18, 'sine', 0.1)
}

export function playWrong() {
  if (!getSettings().soundEffects) return
  tone(220, 0, 0.18, 'triangle', 0.12)
  tone(180, 0.1, 0.22, 'triangle', 0.1)
}

export function playComplete() {
  if (!getSettings().soundEffects) return
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'sine', 0.09))
}
