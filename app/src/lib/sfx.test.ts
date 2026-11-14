import { describe, expect, it } from 'vitest'
import { layersOf, SOUNDS, sfxAllowed, TAP_SOUNDS, TAP_STYLES, type Layer, type Sfx } from './sfx'

const end = (l: Layer) => (l.at ?? 0) + l.len

function checkLayers(name: string, layers: readonly Layer[], maxLen: number) {
  expect(layers.length, name).toBeGreaterThan(0)
  expect(Math.max(...layers.map(end)), name).toBeLessThanOrEqual(maxLen)
  for (const l of layers) {
    if (l.kind === 'swish') {
      // Tiếng gió, tiếng tách: nhiễu qua bộ lọc nên cần mức to hơn một chút mới nghe ngang nốt nhạc.
      expect(l.gain, name).toBeLessThanOrEqual(0.1)
      for (const f of [l.from, l.to]) expect(f, name).toBeGreaterThanOrEqual(120)
      for (const f of [l.from, l.to]) expect(f, name).toBeLessThanOrEqual(6000)
    } else {
      expect(l.gain, name).toBeLessThanOrEqual(0.06)
      for (const f of [l.f, l.kind === 'tone' ? (l.to ?? l.f) : l.f]) {
        expect(f, name).toBeGreaterThanOrEqual(120)
        expect(f, name).toBeLessThanOrEqual(3200)
      }
      // Nốt ngắn ở âm vực trung, vào nhanh tắt nhanh nghe như gõ mõ (người dùng không thích): không còn tiếng nào như vậy.
      const short = l.kind === 'tone' && l.len < 0.1 && l.f < 850 && (l.attack ?? 0.006) < 0.015
      expect(short, `${name}: ${l.kind} ${l.f}`).toBe(false)
    }
  }
}

describe('âm thanh hiệu ứng', () => {
  it('mọi tiếng đều ngắn, nhỏ, trong dải nghe êm, không có tiếng kiểu gõ mõ', () => {
    for (const [name, layers] of Object.entries(SOUNDS)) checkLayers(name, layers, TAP_SOUNDS.has(name as Sfx) ? 0.2 : 1)
    for (const [style, sounds] of Object.entries(TAP_STYLES)) {
      expect(Object.keys(sounds).sort(), style).toEqual(['back', 'nav', 'select', 'tap', 'toggleOff', 'toggleOn'])
      for (const [name, layers] of Object.entries(sounds)) checkLayers(`${style}.${name}`, layers, 0.2)
    }
  })

  it('tiếng chạm đổi theo kiểu đã chọn; tiếng sự kiện thì không', () => {
    expect(layersOf('tap', 'glass')).toBe(TAP_STYLES.glass.tap)
    expect(layersOf('toggleOn', 'bubble')).toBe(TAP_STYLES.bubble.toggleOn)
    expect(layersOf('correct', 'glass')).toBe(SOUNDS.correct)
    // Cài đặt cũ hoặc hỏng: dùng kiểu mặc định.
    expect(layersOf('tap', 'old' as never)).toBe(TAP_STYLES.soft.tap)
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
