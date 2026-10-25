import 'fake-indexeddb/auto'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createScheduler } from '../core/scheduler'
import { VocabDatabase } from '../db/db'
import { createRepo, type ItemInput } from '../db/repo'
import { addImageData, currentImage, imagePath, removeItemImages, uploadPendingImages, type ImageStorage } from './images'
import { syncOnce } from './syncEngine'
import { addUser, startTestServer, testRemote } from './testServer'

/** Hình minh họa của từ (R2.6): lưu trên máy, tải lên kho, đồng bộ sang máy khác. */

const scheduler = createScheduler()
const T0 = Date.parse('2026-10-26T08:00:00Z')
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
  const db = new VocabDatabase(`images-${crypto.randomUUID()}`)
  opened.push(db)
  return db
}

function memoryStorage() {
  const files = new Map<string, ArrayBuffer>()
  const storage: ImageStorage = {
    async upload(path, data) {
      files.set(path, data.slice(0))
    },
    async download(path) {
      const f = files.get(path)
      if (!f) throw new Error(`images: Object not found ${path}`)
      return f.slice(0)
    },
    async remove(paths) {
      paths.forEach((p) => files.delete(p))
    },
  }
  return { files, storage }
}

const jpeg = (n: number) => ({ data: new Uint8Array([0xff, 0xd8, n]).buffer, mime: 'image/jpeg', width: 640, height: 480 })
const input = (term: string): ItemInput => ({ term, partOfSpeech: 'noun', meaningVi: term, examples: [], acceptedAnswers: [], tags: [], favorite: false, difficult: false })

describe('ảnh của một từ', () => {
  it('thêm ảnh, đổi ảnh (ảnh cũ bị bỏ), xóa ảnh', async () => {
    const db = open()
    const first = await addImageData('item-1', jpeg(1), db, T0)
    const second = await addImageData('item-1', jpeg(2), db, T0 + 1)
    let rows = await db.itemImages.where('itemId').equals('item-1').toArray()
    expect(currentImage(rows)?.id).toBe(second.id)
    expect(rows.find((r) => r.id === first.id)?.deletedAt).toBe(T0 + 1)
    expect(await db.imageBlobs.get(second.id)).toMatchObject({ mime: 'image/jpeg' })
    expect((await db.outbox.toArray()).filter((e) => e.table === 'itemImages')).not.toHaveLength(0)
    expect(await removeItemImages(['item-1'], db, T0 + 2)).toBe(1)
    rows = await db.itemImages.where('itemId').equals('item-1').toArray()
    expect(currentImage(rows)).toBeNull()
  })

  it('xóa từ thì bỏ luôn ảnh của từ', async () => {
    const db = open()
    const repo = createRepo(db, scheduler)
    const id = await repo.createItem(input('apple'), [], T0)
    await addImageData(id, jpeg(1), db, T0)
    await repo.deleteItems([id], T0 + 1)
    expect(currentImage(await db.itemImages.where('itemId').equals(id).toArray())).toBeNull()
  })

  it('tải lên kho theo thư mục tài khoản; ảnh đã bỏ thì xóa file trên kho và trên máy', async () => {
    const db = open()
    const { files, storage } = memoryStorage()
    const a = await addImageData('item-1', jpeg(1), db, T0)
    expect(await uploadPendingImages(db, storage, 'u1', T0 + 1)).toBe(1)
    expect([...files.keys()]).toEqual([imagePath('u1', a)])
    expect((await db.itemImages.get(a.id))?.storagePath).toBe('u1/' + a.id + '.jpg')
    const b = await addImageData('item-1', jpeg(2), db, T0 + 2)
    expect(await uploadPendingImages(db, storage, 'u1', T0 + 3)).toBe(2)
    expect([...files.keys()]).toEqual([imagePath('u1', b)])
    expect(await db.imageBlobs.get(a.id)).toBeUndefined()
    expect((await db.itemImages.get(a.id))?.storagePath).toBeUndefined()
    // Không còn gì để làm.
    expect(await uploadPendingImages(db, storage, 'u1', T0 + 4)).toBe(0)
  })
})

describe('đồng bộ ảnh giữa hai máy', () => {
  it('máy A thêm ảnh, máy B nhận dòng ảnh có đường dẫn file; A xóa thì B cũng mất ảnh', async () => {
    const { files, storage } = memoryStorage()
    const [a, b] = [open(), open()]
    const ctx = { scheduler, now: () => T0 + 10_000, userId: user }
    const syncA = async () => {
      await syncOnce(a, testRemote(pg, user), ctx)
      if ((await uploadPendingImages(a, storage, user, T0 + 5000)) > 0) await syncOnce(a, testRemote(pg, user), ctx)
    }
    const img = await addImageData('11111111-1111-1111-1111-111111111111', jpeg(7), a, T0)
    await syncA()
    await syncOnce(b, testRemote(pg, user), ctx)
    const seen = currentImage(await b.itemImages.toArray())
    expect(seen?.id).toBe(img.id)
    expect(seen?.storagePath).toBe(imagePath(user, img))
    expect(files.has(seen!.storagePath!)).toBe(true)

    await removeItemImages([img.itemId], a, T0 + 6000)
    await syncA()
    await syncOnce(b, testRemote(pg, user), ctx)
    expect(currentImage(await b.itemImages.toArray())).toBeNull()
    expect(files.size).toBe(0)
  })

  it('máy chủ chưa chạy file SQL hình: các bảng khác vẫn đồng bộ, dòng ảnh chờ trong hàng đợi', async () => {
    const bare = await startTestServer({ images: false })
    try {
      const me = await addUser(bare)
      const db = open()
      const repo = createRepo(db, scheduler)
      await repo.createItem(input('apple'), [], T0)
      await addImageData('item-x', jpeg(1), db, T0)
      const res = await syncOnce(db, testRemote(bare, me), { scheduler, now: () => T0, userId: me })
      expect(res.skipped).toContain('itemImages')
      const left = await db.outbox.toArray()
      expect(left.every((e) => e.table === 'itemImages')).toBe(true)
      expect(left).not.toHaveLength(0)
    } finally {
      await bare.close()
    }
  }, 60_000)
})
