import { describe, expect, it } from 'vitest'
import { planWordAudio, summarize, type WordAudioInput } from './offlineAudio'

const US = 'https://upload.wikimedia.org/en-us-apple.mp3'
const UK = 'https://upload.wikimedia.org/en-uk-apple.mp3'
const base: WordAudioInput = {
  term: 'apple',
  accent: 'us',
  own: null,
  ownLocal: false,
  flagged: new Set(),
  hasClip: false,
  recordings: { us: US, uk: UK },
  preferRecordings: true,
  saved: new Set(),
}

describe('planWordAudio — mỗi từ đọc bằng gì khi mất mạng (R11.6, R11.8)', () => {
  it('bản ghi Wiktionary của giọng đang chọn: chưa tải thì cần tải, đã tải thì sẵn sàng', () => {
    expect(planWordAudio(base)).toEqual({ state: 'missing', url: US })
    expect(planWordAudio({ ...base, accent: 'uk' })).toEqual({ state: 'missing', url: UK })
    expect(planWordAudio({ ...base, saved: new Set([US]) })).toEqual({ state: 'saved', url: US })
  })

  it('bỏ bản bị báo đọc sai, lấy bản của giọng kia', () => {
    expect(planWordAudio({ ...base, flagged: new Set([US]) })).toEqual({ state: 'missing', url: UK })
  })

  it('bản người học chọn đi trước: ghi âm trên máy là sẵn sàng, ở máy khác thì tải từ kho, bản Wiktionary đã chọn thì tải file đó', () => {
    expect(planWordAudio({ ...base, own: { id: 'a1', source: 'recording' }, ownLocal: true })).toEqual({ state: 'own' })
    expect(planWordAudio({ ...base, own: { id: 'a1', source: 'upload', storagePath: 'u/a1.m4a' } })).toEqual({ state: 'missing', ownId: 'a1' })
    const chosen = 'https://upload.wikimedia.org/LL-apple.mp3'
    expect(planWordAudio({ ...base, own: { id: 'a2', source: 'dictionary', remoteUrl: chosen } })).toEqual({ state: 'missing', url: chosen })
    // Bản ghi âm hỏng (không có trên máy, chưa lên kho): dùng nguồn kế tiếp.
    expect(planWordAudio({ ...base, own: { id: 'a3', source: 'recording' }, hasClip: true })).toEqual({ state: 'clip' })
  })

  it('Giọng iPhone đã có trên máy', () => {
    expect(planWordAudio({ ...base, hasClip: true })).toEqual({ state: 'clip' })
  })

  it('giọng máy: không có bản ghi, câu dài, hoặc tắt ưu tiên giọng người thật; chưa tra thì chưa biết', () => {
    expect(planWordAudio({ ...base, recordings: null })).toEqual({ state: 'voice' })
    expect(planWordAudio({ ...base, term: 'I would like an apple, please.' })).toEqual({ state: 'voice' })
    expect(planWordAudio({ ...base, preferRecordings: false })).toEqual({ state: 'voice' })
    expect(planWordAudio({ ...base, recordings: undefined })).toEqual({ state: 'unknown' })
  })

  it('tổng hợp theo nhóm từ', () => {
    const plans = [planWordAudio(base), planWordAudio({ ...base, saved: new Set([US]) }), planWordAudio({ ...base, hasClip: true }), planWordAudio({ ...base, recordings: null }), planWordAudio({ ...base, recordings: undefined })]
    expect(summarize(plans)).toEqual({ total: 5, ready: 2, saved: 1, pending: 2, voice: 1 })
  })
})
