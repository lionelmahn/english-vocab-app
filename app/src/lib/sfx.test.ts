import { describe, expect, it } from 'vitest'
import { SOUNDS, sfxAllowed, TAP_SOUNDS, type Layer, type Sfx } from './sfx'

const end = (l: Layer) => (l.at ?? 0) + l.len

describe('âm thanh hiệu ứng', () => {
  it('mọi tiếng đều ngắn, nhỏ và trong dải nghe êm', () => {
    for (const [name, layers] of Object.entries(SOUNDS)) {
      expect(layers.length, name).toBeGreaterThan(0)
      // Tiếng chạm thật ngắn để bấm liên tục không bị dồn; tiếng sự kiện dài nhất cũng dưới một giây.
      expect(Math.max(...layers.map(end)), name).toBeLessThanOrEqual(TAP_SOUNDS.has(name as Sfx) ? 0.2 : 1)
      for (const l of layers) {
        expect(l.gain, name).toBeLessThanOrEqual(0.06)
        const freqs = l.kind === 'swish' ? [l.from, l.to] : [l.f, l.kind === 'tone' ? (l.to ?? l.f) : l.f]
        for (const f of freqs) expect(f, name).toBeGreaterThanOrEqual(120)
        for (const f of freqs) expect(f, name).toBeLessThanOrEqual(3200)
      }
    }
  })

  it('“Âm thanh hiệu ứng” tắt mọi tiếng; “Tiếng chạm nút” chỉ tắt tiếng chạm', () => {
    expect(sfxAllowed('correct', { soundEffects: false, tapSounds: true })).toBe(false)
    expect(sfxAllowed('tap', { soundEffects: false, tapSounds: true })).toBe(false)
    expect(sfxAllowed('tap', { soundEffects: true, tapSounds: false })).toBe(false)
    expect(sfxAllowed('open', { soundEffects: true, tapSounds: false })).toBe(false)
    expect(sfxAllowed('correct', { soundEffects: true, tapSounds: false })).toBe(true)
    expect(sfxAllowed('success', { soundEffects: true, tapSounds: true })).toBe(true)
  })
})
