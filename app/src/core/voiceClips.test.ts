import { describe, expect, it } from 'vitest'
import { clipKey, clipTargets, decodeBase64, parsePasted, pasteFingerprint, shortcutRunUrl, sniffAudio } from './voiceClips'

/** File m4a giả: chỉ cần phần đầu "....ftypM4A ". */
function fakeM4a(tag: string): string {
  const bytes = new Uint8Array([0, 0, 0, 32, ...[...'ftypM4A '].map((c) => c.charCodeAt(0)), ...[...tag].map((c) => c.charCodeAt(0))])
  return btoa(String.fromCharCode(...bytes))
}

describe('giọng iPhone qua Phím tắt', () => {
  it('khóa không phân biệt hoa thường, khoảng trắng', () => {
    expect(clipKey('  Never  give up. ')).toBe('never give up.')
  })

  it('đường dẫn chạy phím tắt: mỗi mục một dòng', () => {
    const url = shortcutRunUrl('VocabVoice', ['give up', 'Never\ngive up.'])
    expect(url.startsWith('shortcuts://run-shortcut?name=VocabVoice&input=text&text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe('give up\nNever give up.')
  })

  it('từ vựng trước, câu ví dụ sau, bỏ mục đã có và mục trùng', () => {
    const items = [
      { term: 'give up', examples: [{ en: 'Never give up.' }] },
      { term: 'resilient', examples: [{ en: 'Kids are resilient.' }, { en: 'never give up.' }] },
    ]
    const targets = clipTargets(items, new Set(['resilient']))
    expect(targets).toEqual([
      { text: 'give up', kind: 'term' },
      { text: 'Never give up.', kind: 'sentence' },
      { text: 'Kids are resilient.', kind: 'sentence' },
    ])
  })

  it('nhận diện file âm thanh', () => {
    expect(sniffAudio(decodeBase64(fakeM4a('a'))!)).toBe('audio/mp4')
    expect(sniffAudio(new TextEncoder().encode('hello world, not audio'))).toBeNull()
    expect(decodeBase64('không phải base64')).toBeNull()
  })

  it('đọc kết quả nối bằng "|", kể cả Base64 có ngắt dòng', () => {
    const a = fakeM4a('one')
    const b = fakeM4a('two')
    const wrapped = `${a.slice(0, 10)}\r\n${a.slice(10)}`
    const r = parsePasted(`${wrapped} | ${b}`, 2)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.clips.map((c) => c.mime)).toEqual(['audio/mp4', 'audio/mp4'])
  })

  it('mỗi file một dòng cũng được', () => {
    expect(parsePasted(`${fakeM4a('1')}\n${fakeM4a('2')}\n${fakeM4a('3')}`, 3).ok).toBe(true)
  })

  it('số file không khớp số mục đã gửi thì từ chối', () => {
    expect(parsePasted(`${fakeM4a('1')}|${fakeM4a('2')}`, 3)).toEqual({ ok: false, reason: 'count', got: 2 })
  })

  it('bảng tạm trống hoặc không phải âm thanh thì báo lỗi', () => {
    expect(parsePasted('   ', 2)).toEqual({ ok: false, reason: 'empty' })
    expect(parsePasted('Never give up.', 1).ok).toBe(false)
  })

  it('nhận ra phím tắt mã hóa chữ thay vì âm thanh', () => {
    const b64 = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t)))
    expect(parsePasted(`${b64('give up')}|${b64('Never give up.')}`, 2)).toEqual({ ok: false, reason: 'text', sample: 'give up' })
  })

  it('dấu vết giúp nhận ra kết quả cũ', () => {
    const raw = `${fakeM4a('1')}|${fakeM4a('2')}`
    expect(pasteFingerprint(raw)).toBe(pasteFingerprint(` ${raw}\n`))
    expect(pasteFingerprint(raw)).not.toBe(pasteFingerprint(`${fakeM4a('3')}|${fakeM4a('4')}`))
  })
})
