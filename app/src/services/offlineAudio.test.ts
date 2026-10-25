import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { resolveManyWordAudio } from './audio'
import { downloadAudio, offlineAudioUrl, removeAudio, type DownloadProgress } from './offlineAudio'

const file = (name: string) => `https://upload.wikimedia.org/wikipedia/commons/transcoded/x/${name}.mp3`

beforeEach(async () => {
  await Promise.all([db.offlineAudio.clear(), db.audioCache.clear(), db.audioAssets.clear(), db.voiceClips.clear(), db.audioBlobs.clear()])
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tải âm thanh để dùng khi không có mạng (R11.8)', () => {
  it('tải file bản ghi của giọng đang chọn, phát từ máy, bỏ qua từ đã có Giọng iPhone; xóa theo nhóm từ', async () => {
    const now = Date.now()
    await db.audioCache.bulkPut([
      { key: 'apple', audio: { us: file('en-us-apple'), uk: file('en-uk-apple') }, fetchedAt: now },
      { key: 'run', audio: { uk: file('en-uk-run') }, fetchedAt: now },
      { key: 'give up', audio: null, fetchedAt: now },
      { key: 'book', audio: { us: file('en-us-book') }, fetchedAt: now },
    ])
    await db.voiceClips.put({ key: 'book', text: 'book', data: new ArrayBuffer(4), mime: 'audio/mp4', createdAt: now })
    const fetched: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      fetched.push(url)
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } })
    })
    const words = [{ term: 'apple' }, { term: 'run' }, { term: 'give up' }, { term: 'book' }]
    const progress: DownloadProgress[] = []
    const result = await downloadAudio(words, 'us', true, (p) => progress.push(p), new AbortController().signal)

    expect(result).toEqual({ saved: 2, failed: 0 })
    expect(fetched.sort()).toEqual([file('en-uk-run'), file('en-us-apple')])
    expect(progress.at(-1)).toEqual({ phase: 'downloading', done: 2, total: 2, failed: 0 })
    expect(await db.offlineAudio.get(file('en-us-apple'))).toMatchObject({ mime: 'audio/mpeg', size: 3 })
    expect(await offlineAudioUrl(file('en-us-apple'))).toMatch(/^blob:/)
    expect(await offlineAudioUrl(file('en-uk-apple'))).toBeNull()

    // Tải lại: không còn gì để tải.
    expect(await downloadAudio(words, 'us', true, () => undefined, new AbortController().signal)).toEqual({ saved: 0, failed: 0 })
    expect(fetched).toHaveLength(2)

    expect(await removeAudio([{ term: 'apple' }])).toBe(1)
    expect(await db.offlineAudio.count()).toBe(1)
    expect(await offlineAudioUrl(file('en-us-apple'))).toBeNull()
  })

  it('file lỗi được đếm riêng, phần đã tải vẫn giữ', async () => {
    await db.audioCache.bulkPut([
      { key: 'apple', audio: { us: file('en-us-apple') }, fetchedAt: Date.now() },
      { key: 'run', audio: { us: file('en-us-run') }, fetchedAt: Date.now() },
    ])
    vi.stubGlobal('fetch', async (url: string) => (url.includes('run') ? new Response('', { status: 404 }) : new Response(new Uint8Array([9]))))
    expect(await downloadAudio([{ term: 'apple' }, { term: 'run' }], 'us', true, () => undefined, new AbortController().signal)).toEqual({ saved: 1, failed: 1 })
    expect(await db.offlineAudio.count()).toBe(1)
  })
})

describe('resolveManyWordAudio — tra nhiều từ một lượt', () => {
  it('một lần gọi Wiktionary cho cả nhóm, một lần gọi Commons cho các file; lưu kết quả trên máy', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      if (url.startsWith('https://en.wiktionary.org')) {
        return Response.json({
          query: {
            pages: [
              { title: 'cat', images: [{ title: 'File:En-us-cat.ogg' }, { title: 'File:En-uk-cat.ogg' }] },
              { title: 'dog', images: [{ title: 'File:Dog.jpg' }] },
            ],
          },
        })
      }
      return Response.json({
        query: {
          pages: [
            { title: 'File:En-us-cat.ogg', videoinfo: [{ url: 'https://upload.wikimedia.org/a/En-us-cat.ogg', derivatives: [{ type: 'audio/mpeg', src: file('en-us-cat') }] }] },
            { title: 'File:En-uk-cat.ogg', videoinfo: [{ url: 'https://upload.wikimedia.org/a/En-uk-cat.ogg', derivatives: [{ type: 'audio/mpeg', src: file('en-uk-cat') }] }] },
          ],
        },
      })
    })
    await resolveManyWordAudio(['cat', 'dog'])
    expect(calls.filter((c) => c.startsWith('https://en.wiktionary.org'))).toHaveLength(1)
    expect(calls.filter((c) => c.startsWith('https://commons.wikimedia.org'))).toHaveLength(1)
    expect((await db.audioCache.get('cat'))?.audio).toEqual({ us: file('en-us-cat'), uk: file('en-uk-cat') })
    expect((await db.audioCache.get('dog'))?.audio).toBeNull()
    // Đã tra rồi: không gọi mạng nữa.
    await resolveManyWordAudio(['cat', 'dog'])
    expect(calls).toHaveLength(2)
  })
})
