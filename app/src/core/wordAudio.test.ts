import { describe, expect, it } from 'vitest'
import { accentOf, chooseUrl, isShortTerm, pickAudioFiles } from './wordAudio'

describe('bản ghi phát âm giọng người thật', () => {
  it('phân loại giọng theo tên file', () => {
    expect(accentOf('File:En-us-examination.ogg')).toBe('us')
    expect(accentOf('en-uk-examination.ogg')).toBe('uk')
    expect(accentOf('En-gb-water.ogg')).toBe('uk')
    expect(accentOf('LL-Q1860 (eng)-Vealhurl-water.wav')).toBe('other')
  })

  it('chỉ lấy file của đúng từ, mỗi giọng một file', () => {
    const files = [
      'File:Wikipedia-logo-v2.svg',
      'File:en-us-examination.ogg',
      'File:en-us-examinations.ogg',
      'File:En-uk-examination.ogg',
      'File:LL-Q1860 (eng)-Persent101-examination.wav',
      'File:En-us-examination-2.ogg',
    ]
    expect(pickAudioFiles('examination', files)).toEqual({
      us: 'en-us-examination.ogg',
      uk: 'En-uk-examination.ogg',
      other: 'LL-Q1860 (eng)-Persent101-examination.wav',
    })
  })

  it('cụm từ có khoảng trắng hoặc gạch nối', () => {
    expect(pickAudioFiles('give up', ['File:En-us-give up.ogg'])).toEqual({ us: 'En-us-give up.ogg' })
    expect(pickAudioFiles('give up', ['File:En-us-give_up.ogg'])).toEqual({ us: 'En-us-give_up.ogg' })
  })

  it('bỏ file của ngôn ngữ khác trùng chữ, nhận giọng Anh khác (Úc, Canada…)', () => {
    const files = ['File:De-abundant.ogg', 'File:LL-Q188 (deu)-Jeuwre-abundant.wav', 'File:Fr-abundant.ogg']
    expect(pickAudioFiles('abundant', files)).toEqual({})
    expect(pickAudioFiles('abundant', [...files, 'File:En-au-abundant.ogg'])).toEqual({ other: 'En-au-abundant.ogg' })
    expect(pickAudioFiles('give up', ['File:LL-Q1860 (eng)-Vealhurl-give_up.wav'])).toEqual({ other: 'LL-Q1860 (eng)-Vealhurl-give_up.wav' })
  })

  it('chọn đường dẫn theo giọng ưu tiên, thiếu thì lấy giọng khác', () => {
    expect(chooseUrl({ us: 'u', uk: 'k' }, 'uk')).toBe('k')
    expect(chooseUrl({ us: 'u' }, 'uk')).toBe('u')
    expect(chooseUrl({ other: 'o' }, 'us')).toBe('o')
    expect(chooseUrl(null, 'us')).toBeNull()
  })

  it('câu ví dụ không tra bản ghi', () => {
    expect(isShortTerm('learn by heart')).toBe(true)
    expect(isShortTerm('I have an English examination next week.')).toBe(false)
  })
})
