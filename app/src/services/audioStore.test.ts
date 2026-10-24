import 'fake-indexeddb/auto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler } from '../core/scheduler'
import { VocabDatabase } from '../db/db'
import type { AudioAsset } from '../db/types'
import {
  audioPath,
  baseMime,
  chooseDictionary,
  ensureClipAssets,
  flagDictionary,
  flaggedUrls,
  materializeClips,
  pickChosen,
  removeAsset,
  retireClipAssets,
  saveWordAudio,
  uploadPendingAudio,
  wordAssets,
  type AudioStorage,
} from './audioStore'
import { syncOnce } from './syncEngine'
import { addUser, startTestServer, testRemote } from './testServer'

/** Âm thanh của người học (R7.8, R13.8) và Giọng iPhone đồng bộ giữa hai máy qua kho file. */

const scheduler = createScheduler()
const T0 = Date.parse('2026-10-25T08:00:00Z')
const MIN = 60_000
const opened: VocabDatabase[] = []
let pg: PGlite
let user: string

beforeAll(async () => {
  pg = await startTestServer()
}, 60_000)
afterAll(async () => {
  await pg.close()
})
beforeEach(async () => {
  user = await addUser(pg)
})
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

function open() {
  const db = new VocabDatabase(`audio-${crypto.randomUUID()}`)
  opened.push(db)
  return db
}

/** Kho file trong bộ nhớ, ghi lại thao tác để kiểm tra. */
function memoryStorage() {
  const files = new Map<string, ArrayBuffer>()
  const storage: AudioStorage = {
    async upload(path, data) {
      files.set(path, data.slice(0))
    },
    async download(path) {
      const f = files.get(path)
      if (!f) throw new Error(`audio: Object not found ${path}`)
      return f.slice(0)
    },
    async remove(paths) {
      paths.forEach((p) => files.delete(p))
    },
  }
  return { files, storage }
}

const bytes = (...n: number[]) => new Uint8Array(n).buffer
const text = (b: ArrayBuffer) => [...new Uint8Array(b)].join(',')
const word = { term: 'Record', partOfSpeech: 'noun' as const }

describe('chọn bản phát cho một từ', () => {
  it('ghi âm mới thay bản cũ cùng giọng, giữ bản của giọng kia', async () => {
    const db = open()
    const us1 = await saveWordAudio(word, 'us', 'recording', { data: bytes(1), mime: 'audio/webm;codecs=opus' }, db, T0)
    const uk = await saveWordAudio(word, 'uk', 'upload', { data: bytes(2), mime: 'audio/mpeg' }, db, T0 + 1)
    const us2 = await saveWordAudio(word, 'us', 'recording', { data: bytes(3), mime: 'audio/mp4' }, db, T0 + 2)
    const assets = await wordAssets('record', db)
    expect(assets.map((a) => a.id).sort()).toEqual([uk.id, us2.id].sort())
    expect(us1.mime).toBe('audio/webm')
    expect(await db.audioBlobs.get(us1.id)).toBeUndefined()
    expect(pickChosen(assets, 'us')?.id).toBe(us2.id)
    expect(pickChosen(assets, 'uk')?.id).toBe(uk.id)
    // Gỡ bản giọng Anh: giọng Anh dùng tạm bản giọng Mỹ của người học.
    await removeAsset(uk, db, T0 + 3)
    expect(pickChosen(await wordAssets('record', db), 'uk')?.id).toBe(us2.id)
  })

  it('báo sai một bản Wiktionary rồi chọn bản khác', async () => {
    const db = open()
    const bad = 'https://upload.wikimedia.org/a.mp3'
    const good = 'https://upload.wikimedia.org/b.mp3'
    await chooseDictionary(word, 'us', bad, 'En-us-record.ogg', db, T0)
    await flagDictionary(word, 'us', bad, 'En-us-record.ogg', db, T0 + 1)
    // Báo sai lần nữa không tạo thêm dòng.
    await flagDictionary(word, 'us', bad, undefined, db, T0 + 2)
    let assets = await wordAssets('record', db)
    expect(pickChosen(assets, 'us')).toBeNull()
    expect([...flaggedUrls(assets)]).toEqual([bad])
    await chooseDictionary(word, 'us', good, 'LL-Q1860 (eng)-X-record.wav', db, T0 + 3)
    assets = await wordAssets('record', db)
    expect(pickChosen(assets, 'us')?.remoteUrl).toBe(good)
    // Chọn lại đúng bản đã báo sai thì bỏ báo sai.
    await chooseDictionary(word, 'us', bad, 'En-us-record.ogg', db, T0 + 4)
    assets = await wordAssets('record', db)
    expect(flaggedUrls(assets).size).toBe(0)
    expect(assets.filter((a) => a.status === 'active')).toHaveLength(1)
  })

  it('đường dẫn file trong kho theo tài khoản và loại file', () => {
    expect(audioPath('u1', { id: 'a', mime: baseMime('audio/webm; codecs=opus') })).toBe('u1/a.webm')
    expect(audioPath('u1', { id: 'b', mime: 'audio/mp4' })).toBe('u1/b.m4a')
    expect(audioPath('u1', { id: 'c', mime: undefined })).toBe('u1/c.audio')
  })
})

describe('đồng bộ file âm thanh giữa hai máy', () => {
  function device(storage: AudioStorage) {
    const db = open()
    const remote = testRemote(pg, user)
    let clock = T0
    const sync = async () => {
      // Đúng thứ tự của services/sync.ts: dữ liệu, rồi file, rồi gửi đường dẫn file.
      await syncOnce(db, remote, { scheduler, now: () => clock, userId: user })
      await ensureClipAssets(db, 'us', clock)
      const changed = await uploadPendingAudio(db, storage, user, clock)
      const clips = await materializeClips(db, storage)
      if (changed > 0) await syncOnce(db, remote, { scheduler, now: () => clock, userId: user })
      return clips
    }
    return { db, sync, tick: (ms = MIN) => (clock += ms), now: () => clock }
  }

  const clip = (text: string, data: ArrayBuffer, createdAt: number) => ({ key: text.toLowerCase(), text, data, mime: 'audio/mp4', createdAt })

  it('Giọng iPhone tạo trên điện thoại có trên máy tính; tạo lại thì máy tính nhận bản mới; xóa thì xóa cả hai', async () => {
    const { files, storage } = memoryStorage()
    const phone = device(storage)
    const laptop = device(storage)

    await phone.db.voiceClips.put(clip('Apple', bytes(1, 1), T0 - 5 * MIN))
    await phone.sync()
    expect(files.size).toBe(1)
    const [asset] = await phone.db.audioAssets.toArray()
    expect(asset).toMatchObject({ key: 'apple', source: 'tts', storagePath: `${user}/${asset.id}.m4a` })

    expect(await laptop.sync()).toEqual(['apple'])
    expect(text((await laptop.db.voiceClips.get('apple'))!.data)).toBe('1,1')
    // Đồng bộ lần nữa không tải lại.
    expect(await laptop.sync()).toEqual([])
    expect(await phone.sync()).toEqual([])

    // Tạo lại trên điện thoại (bản mới đè lên).
    phone.tick()
    await phone.db.voiceClips.put(clip('Apple', bytes(2, 2), phone.now()))
    phone.tick()
    await phone.sync()
    expect(files.size).toBe(1)
    laptop.tick(3 * MIN)
    expect(await laptop.sync()).toEqual(['apple'])
    expect(text((await laptop.db.voiceClips.get('apple'))!.data)).toBe('2,2')

    // Xóa giọng iPhone trên máy tính: điện thoại cũng xóa, file trong kho cũng xóa.
    laptop.tick()
    await retireClipAssets(laptop.db, laptop.now())
    await laptop.sync()
    expect(files.size).toBe(0)
    phone.tick(5 * MIN)
    expect(await phone.sync()).toEqual(['apple'])
    expect(await phone.db.voiceClips.count()).toBe(0)

    // Tạo lại sau khi xóa: đồng bộ như bản mới.
    phone.tick()
    await phone.db.voiceClips.put(clip('Apple', bytes(3), phone.now()))
    phone.tick()
    await phone.sync()
    laptop.tick(5 * MIN)
    expect(await laptop.sync()).toEqual(['apple'])
    expect(text((await laptop.db.voiceClips.get('apple'))!.data)).toBe('3')
  }, 30_000)

  it('hai máy cùng tạo một câu: giữ một bản', async () => {
    const { files, storage } = memoryStorage()
    const phone = device(storage)
    const laptop = device(storage)
    await phone.db.voiceClips.put(clip('Hello', bytes(1), T0 - MIN))
    await laptop.db.voiceClips.put(clip('Hello', bytes(2), T0 - MIN))
    await phone.sync()
    laptop.tick()
    await laptop.sync()
    phone.tick(2 * MIN)
    await phone.sync()
    laptop.tick(2 * MIN)
    await laptop.sync()
    const live = (db: VocabDatabase) => db.audioAssets.filter((a: AudioAsset) => a.deletedAt === null).toArray()
    const [a, b] = [await live(phone.db), await live(laptop.db)]
    expect(a).toHaveLength(1)
    expect(b.map((x) => x.id)).toEqual(a.map((x) => x.id))
    expect(files.size).toBe(1)
    expect(text((await phone.db.voiceClips.get('hello'))!.data)).toBe(text((await laptop.db.voiceClips.get('hello'))!.data))
  }, 30_000)

  it('ghi âm của một từ lên kho và phát được ở máy kia', async () => {
    const { files, storage } = memoryStorage()
    const phone = device(storage)
    const laptop = device(storage)
    const mine = await saveWordAudio(word, 'us', 'recording', { data: bytes(9, 9), mime: 'audio/mp4' }, phone.db, T0)
    await phone.sync()
    const path = `${user}/${mine.id}.m4a`
    expect([...files.keys()]).toEqual([path])
    await laptop.sync()
    const there = await laptop.db.audioAssets.get(mine.id)
    expect(there?.storagePath).toBe(path)
    expect(text(await storage.download(there!.storagePath!))).toBe('9,9')

    // Ghi lại: bản cũ bị bỏ, file cũ xóa khỏi kho.
    phone.tick()
    const again = await saveWordAudio(word, 'us', 'recording', { data: bytes(8), mime: 'audio/mp4' }, phone.db, phone.now())
    await phone.sync()
    expect([...files.keys()]).toEqual([`${user}/${again.id}.m4a`])
  }, 30_000)
})
