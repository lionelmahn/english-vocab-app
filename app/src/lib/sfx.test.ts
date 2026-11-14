import { describe, expect, it } from 'vitest'
import { FAMILIES, SOUNDS, sfxAllowed, TAP_SOUNDS, type Layer, type Sfx } from './sfx'

const end = (l: Layer) => (l.at ?? 0) + l.len

describe('âm thanh hiệu ứng', () => {
  it('mọi tiếng đều ngắn, nhỏ, trong dải nghe được, không có tiếng kiểu gõ mõ', () => {
    for (const [name, layers] of Object.entries(SOUNDS) as [Sfx, readonly Layer[]][]) {
      expect(layers.length, name).toBeGreaterThan(0)
      // Tiếng chạm ngắn để bấm liên tục không bị dồn; tiếng sự kiện dài nhất cũng dưới một giây rưỡi (hộp nhạc ngân lâu).
      expect(Math.max(...layers.map(end)), name).toBeLessThanOrEqual(TAP_SOUNDS.has(name) ? 0.25 : 1.5)
      for (const l of layers) {
        if (l.kind === 'swish') {
          expect(l.gain, name).toBeLessThanOrEqual(0.1)
          continue
        }
        expect(l.gain, name).toBeLessThanOrEqual(0.06)
        for (const f of [l.f, l.kind === 'tone' ? (l.to ?? l.f) : l.f]) {
          expect(f, name).toBeGreaterThanOrEqual(150)
          expect(f, name).toBeLessThanOrEqual(5200)
        }
        // Nốt ngắn ở âm vực trung, vào nhanh tắt nhanh mà không trượt cao độ nghe như gõ mõ (người dùng không thích).
        // Nốt trượt nhanh lên cao (bong bóng, hoạt hình) thì nghe như tiếng bóp, không tính.
        if (l.kind === 'tone') {
          const sweep = !!l.to && Math.abs(Math.log2(l.to / l.f)) >= 0.5
          const knock = l.len < 0.1 && l.f < 850 && (l.attack ?? 0.006) < 0.015 && !sweep
          expect(knock, `${name}: ${l.f} Hz`).toBe(false)
        }
      }
    }
  })

  it('mỗi ngữ cảnh dùng đúng họ tiếng người dùng chọn trên trang “Phòng thử âm thanh”', () => {
    const familyOf = (name: Sfx): string | undefined => {
      const first = SOUNDS[name][0]
      if (!first || first.kind === 'swish') return first?.kind
      return Object.keys(FAMILIES).find((fam) => {
        const probe = FAMILIES[fam as keyof typeof FAMILIES](1000, 0, 0.05, 1)[0]
        return probe.kind === first.kind && (probe.kind !== 'tone' || first.kind !== 'tone' || ((probe.wave ?? 'sine') === (first.wave ?? 'sine') && !!probe.vib === !!first.vib && (!!probe.to === !!first.to)))
          && (probe.kind !== 'bell' || first.kind !== 'bell' || JSON.stringify(probe.ratios ?? null) === JSON.stringify(first.ratios ?? null))
      })
    }
    expect(familyOf('tap')).toBe('bubble')
    expect(familyOf('nav')).toBe('bubble')
    for (const name of ['select', 'back', 'toggleOn', 'toggleOff', 'open', 'close', 'star'] as Sfx[]) expect(familyOf(name), name).toBe('toon')
    for (const name of ['correct', 'almost', 'wrong', 'ready', 'message'] as Sfx[]) expect(SOUNDS[name][1]).toMatchObject({ kind: 'tone', wave: 'triangle' })
    expect(familyOf('hint')).toBe('kalimba')
    expect(familyOf('success')).toBe('kalimba')
    expect(familyOf('complete')).toBe('musicbox')
    expect(familyOf('reject')).toBe('glass')
    expect(SOUNDS.recStart[0]).toMatchObject({ kind: 'tone', wave: 'square' })
    expect(SOUNDS.error[0]).toMatchObject({ kind: 'tone', attack: 0.004 })
    expect(SOUNDS.flip).toEqual([{ kind: 'swish', from: 1800, to: 800, len: 0.1, gain: 0.06, at: 0 }])
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
