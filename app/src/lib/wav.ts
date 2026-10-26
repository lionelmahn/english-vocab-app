/**
 * Đổi bản ghi âm (m4a trên iPhone, webm trên máy khác) thành WAV 16 kHz một kênh để gửi đi nhận dạng giọng nói (R7.3):
 * định dạng nào Whisper cũng đọc được, và nhỏ (khoảng 32 KB mỗi giây).
 */

export interface PreparedAudio {
  base64: string
  seconds: number
  /** Biên độ lớn nhất (0–1): quá nhỏ là gần như im lặng, không cần gửi. */
  peak: number
}

/** Dưới mức này coi như không nói gì (micro có lọc ồn nên tiếng nói thường trên 0,05). */
export const SILENCE_PEAK = 0.015

export function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  out.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  out.setUint32(16, 16, true)
  out.setUint16(20, 1, true)
  out.setUint16(22, 1, true)
  out.setUint32(24, rate, true)
  out.setUint32(28, rate * 2, true)
  out.setUint16(32, 2, true)
  out.setUint16(34, 16, true)
  text(36, 'data')
  out.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Uint8Array(out.buffer)
}

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function peakOf(samples: Float32Array): number {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  return peak
}

export async function prepareSpeech(blob: Blob, rate = 16000): Promise<PreparedAudio> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void ctx.close()
  }
  // Trộn về một kênh và đổi tần số lấy mẫu bằng OfflineAudioContext.
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const samples = (await off.startRendering()).getChannelData(0)
  return { base64: toBase64(encodeWav(samples, rate)), seconds: decoded.duration, peak: peakOf(samples) }
}
