import { describe, expect, it } from 'vitest'
import { encodeWav, peakOf, toBase64 } from './wav'

describe('đổi bản ghi sang WAV để nhận dạng giọng nói', () => {
  it('đầu file WAV 16 kHz một kênh 16 bit; mẫu bị kẹp trong khoảng -1..1', () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -1, 2]), 16000)
    const view = new DataView(bytes.buffer)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint32(40, true)).toBe(8)
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 16383, -32767, 32767])
    expect(toBase64(bytes.slice(0, 4))).toBe('UklGRg==')
    expect(peakOf(new Float32Array([0.01, -0.4, 0.2]))).toBeCloseTo(0.4)
  })
})
