import { describe, expect, it } from 'vitest'
import { editDistance, judgePronunciation, speechTokens, usSpelling } from './pronounce'

/** Kết quả thật của Whisper large-v3-turbo với giọng máy (bản 0.31.0) dùng làm dữ liệu thử. */
describe('chấm phát âm (R7.3)', () => {
  it('tách chữ: bỏ dấu câu, giữ dấu nháy, đổi số thành chữ', () => {
    expect(speechTokens('Take care of.')).toEqual(['take', 'care', 'of'])
    expect(speechTokens('3.')).toEqual(['three'])
    expect(speechTokens("It’s 21 well-known")).toEqual(["it's", 'twenty', 'one', 'well', 'known'])
    expect(editDistance('rise', 'rice')).toBe(1)
  })

  it('từ: nghe đúng, nghe ra từ đồng âm, gần đúng (khác một hai chữ cái), khác hẳn, không nghe thấy', () => {
    expect(judgePronunciation('rise', 'Rise.')).toEqual({ verdict: 'match', heard: 'Rise.' })
    expect(judgePronunciation('three', '3.').verdict).toBe('match')
    expect(judgePronunciation('write', 'Right.')).toEqual({ verdict: 'match', heard: 'Right.', homophone: 'right' })
    expect(judgePronunciation('take care of', 'Take care of.').verdict).toBe('match')
    expect(judgePronunciation('rise', 'Rice.').verdict).toBe('close')
    expect(judgePronunciation('ship', 'Sheep.').verdict).toBe('close')
    expect(judgePronunciation('berry', 'Beery').verdict).toBe('close')
    expect(judgePronunciation('decision', 'The season.').verdict).toBe('miss')
    expect(judgePronunciation('rise', '')).toEqual({ verdict: 'empty', heard: '' })
  })

  it('câu: đủ mọi chữ mới là đúng; thiếu chữ thì đánh dấu chữ máy không nghe ra', () => {
    const target = 'We need to make up for lost time this week.'
    expect(judgePronunciation(target, 'We need to make up for lost time this week.').verdict).toBe('match')
    const r = judgePronunciation(target, 'We need to make up for last time this weak')
    expect(r.verdict).toBe('close')
    expect(r.words!.filter((w) => !w.ok).map((w) => w.text)).toEqual(['lost'])
    expect(judgePronunciation(target, 'We need it.').verdict).toBe('miss')
  })
})

describe('chấm phát âm: kết quả thật khi thử trên iPhone (bản 0.31.1)', () => {
  it('cách viết Anh–Anh và Anh–Mỹ đọc như nhau; từ ngắn như four, hour, your không bị đổi', () => {
    expect(['favourite', 'colour', 'centre', 'realise', 'programme', 'four', 'hour', 'your', 'here', 'rise'].map(usSpelling)).toEqual([
      'favorite', 'color', 'center', 'realize', 'program', 'four', 'hour', 'your', 'here', 'rise',
    ])
    expect(judgePronunciation('favorite', 'Favourite.').verdict).toBe('match')
    expect(judgePronunciation('center', 'Centre').verdict).toBe('match')
  })

  it('"favorite" nghe thành "Favourites": gần đúng, chỉ rõ thêm "s" ở cuối; thiếu âm cuối cũng được chỉ ra', () => {
    expect(judgePronunciation('favorite', 'Favourites')).toEqual({ verdict: 'close', heard: 'Favourites', ending: { kind: 'extra', text: 's' } })
    expect(judgePronunciation('walked', 'Walk.')).toMatchObject({ verdict: 'close', ending: { kind: 'missing', text: 'ed' } })
  })

  it('"favorite" nghe thành "for you Boris": khác hẳn, báo là bị tách thành nhiều chữ rời', () => {
    expect(judgePronunciation('favorite', 'for you Boris')).toEqual({ verdict: 'miss', heard: 'for you Boris', split: true })
  })
})
