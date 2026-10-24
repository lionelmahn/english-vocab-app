import { describe, expect, it } from 'vitest'
import { bestVoice, rankVoices, voiceLabel, voiceTier, type VoiceInfo } from './voices'

const v = (name: string, lang: string, voiceURI: string): VoiceInfo => ({ name, lang, voiceURI })

// Danh sách giống iPhone trả về cho trang web (chỉ giọng có sẵn của máy).
const iphone = [
  v('Samantha', 'en-US', 'com.apple.voice.super-compact.en-US.Samantha'),
  v('Samantha', 'en-US', 'com.apple.voice.compact.en-US.Samantha'),
  v('Bahh', 'en-US', 'com.apple.speech.synthesis.voice.Bahh'),
  v('Wobble', 'en-US', 'com.apple.speech.synthesis.voice.Wobble'),
  v('Good News', 'en-US', 'com.apple.speech.synthesis.voice.GoodNews'),
  v('Jester', 'en-US', 'com.apple.speech.synthesis.voice.Hysterical'),
  v('Albert', 'en-US', 'com.apple.speech.synthesis.voice.Albert'),
  v('Rocko (English (US))', 'en-US', 'com.apple.eloquence.en-US.Rocko'),
  v('Daniel', 'en-GB', 'com.apple.voice.compact.en-GB.Daniel'),
  v('Linh', 'vi-VN', 'com.apple.voice.compact.vi-VN.Linh'),
]

describe('chọn giọng đọc của thiết bị', () => {
  it('nhận biết chất lượng qua mã giọng (iPhone/Mac) hoặc tên (Windows/Chrome)', () => {
    expect(voiceTier(v('Evan', 'en-US', 'com.apple.voice.enhanced.en-US.Evan'))).toBe('enhanced')
    expect(voiceTier(v('Zoe', 'en-US', 'com.apple.voice.premium.en-US.Zoe'))).toBe('premium')
    expect(voiceTier(v('Samantha', 'en-US', 'com.apple.voice.super-compact.en-US.Samantha'))).toBe('low')
    expect(voiceTier(v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', 'x'))).toBe('premium')
    expect(voiceTier(v('Bahh', 'en-US', 'com.apple.speech.synthesis.voice.Bahh'))).toBe('novelty')
    expect(voiceTier(v('Grandpa (English (US))', 'en-US', 'com.apple.eloquence.en-US.Grandpa'))).toBe('novelty')
  })

  it('bỏ giọng vui nhộn, gộp Samantha trùng tên, đúng giọng Mỹ lên đầu', () => {
    const list = rankVoices(iphone, 'us')
    expect(list.map((x) => x.voiceURI)).toEqual(['com.apple.voice.compact.en-US.Samantha', 'com.apple.voice.compact.en-GB.Daniel'])
  })

  it('giọng Anh–Anh: Daniel lên đầu', () => {
    expect(bestVoice(iphone, 'uk')?.name).toBe('Daniel')
  })

  it('giữ giọng người học đã chọn; máy không còn giọng đó thì tự chọn', () => {
    expect(bestVoice(iphone, 'us', 'com.apple.voice.compact.en-GB.Daniel')?.name).toBe('Daniel')
    expect(bestVoice(iphone, 'us', 'com.apple.voice.enhanced.en-US.Evan')?.voiceURI).toBe('com.apple.voice.compact.en-US.Samantha')
  })

  it('giọng Nâng cao/Cao cấp (khi máy cho dùng) được ưu tiên hơn giọng thường', () => {
    const mac = [...iphone, v('Evan', 'en-US', 'com.apple.voice.enhanced.en-US.Evan'), v('Zoe', 'en-US', 'com.apple.voice.premium.en-US.Zoe')]
    expect(rankVoices(mac, 'us').map((x) => x.name)).toEqual(['Zoe', 'Evan', 'Samantha', 'Daniel'])
  })

  it('tên hiển thị kèm chất lượng', () => {
    expect(voiceLabel(v('Evan', 'en-US', 'com.apple.voice.enhanced.en-US.Evan'))).toBe('Evan (Nâng cao) · en-US')
    expect(voiceLabel(v('Samantha', 'en-US', 'com.apple.voice.compact.en-US.Samantha'))).toBe('Samantha · en-US')
    expect(voiceLabel(v('Google US English', 'en_US', 'Google US English'))).toBe('Google US English · en-US')
  })
})
