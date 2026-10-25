import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { commit, db, type VocabDatabase } from '../db/db'
import type { ID, ItemImage } from '../db/types'
import { getAuth } from './auth'
import { getSupabase } from './supabase'

/**
 * Hình minh họa của từ (R2.6). Ảnh được thu nhỏ ngay trên máy (cạnh dài tối đa 1024 px, JPEG) rồi lưu trên máy trước;
 * khi có mạng và đã đăng nhập thì tải lên kho "images" riêng tư, các máy khác tải về khi cần hiện.
 */

export const IMAGE_BUCKET = 'images'
/** Khớp giới hạn của kho trên máy chủ. */
export const MAX_IMAGE_BYTES = 1024 * 1024
export const MAX_IMAGE_SIDE = 1024
const TRANSFER_BATCH = 20

/** Kho file: Supabase Storage khi chạy thật, bộ nhớ khi test. */
export interface ImageStorage {
  upload(path: string, data: ArrayBuffer, mime: string): Promise<void>
  download(path: string): Promise<ArrayBuffer>
  remove(paths: string[]): Promise<void>
}

export function supabaseImageStorage(client: SupabaseClient): ImageStorage {
  const bucket = () => client.storage.from(IMAGE_BUCKET)
  return {
    async upload(path, data, mime) {
      const { error } = await bucket().upload(path, new Blob([data], { type: mime }), { contentType: mime, upsert: true })
      if (error) throw new Error(`images: ${error.message}`)
    },
    async download(path) {
      const { data, error } = await bucket().download(path)
      if (error || !data) throw new Error(`images: ${error?.message ?? 'không tải được ảnh'}`)
      return data.arrayBuffer()
    },
    async remove(paths) {
      const { error } = await bucket().remove(paths)
      if (error) throw new Error(`images: ${error.message}`)
    },
  }
}

export function imagePath(userId: string, image: Pick<ItemImage, 'id' | 'mime'>): string {
  return `${userId}/${image.id}.${image.mime === 'image/png' ? 'png' : image.mime === 'image/webp' ? 'webp' : 'jpg'}`
}

export interface ImageData {
  data: ArrayBuffer
  mime: string
  width: number
  height: number
}

/**
 * Thu nhỏ và nén ảnh thành JPEG (cạnh dài tối đa `maxSide`); vẽ lại qua canvas nên thông tin vị trí (EXIF) bị bỏ.
 * Ảnh còn quá 1 MB thì giảm chất lượng rồi giảm kích thước cho tới khi vừa.
 */
export async function shrinkImage(file: Blob, maxSide = MAX_IMAGE_SIDE): Promise<ImageData> {
  const url = URL.createObjectURL(file)
  try {
    // Chờ bằng onload: img.decode() có thể treo khi trang đang chạy nền.
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    let side = maxSide
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
      const width = Math.max(1, Math.round(img.naturalWidth * scale))
      const height = Math.max(1, Math.round(img.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Trình duyệt không xử lý được ảnh.')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      const quality = attempt < 2 ? 0.82 - attempt * 0.12 : 0.7
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) throw new Error('Không nén được ảnh.')
      if (blob.size <= MAX_IMAGE_BYTES) return { data: await blob.arrayBuffer(), mime: 'image/jpeg', width, height }
      if (attempt >= 1) side = Math.round(side * 0.75)
    }
    throw new Error('Ảnh quá lớn.')
  } catch (e) {
    throw new Error((e as Error).message === 'Ảnh quá lớn.' ? 'Ảnh quá lớn, hãy chọn ảnh khác.' : 'Không đọc được ảnh này. Hãy chọn ảnh JPEG hoặc PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Ảnh đang dùng của một từ: dòng còn hiệu lực mới nhất. */
export function currentImage(rows: readonly ItemImage[]): ItemImage | null {
  return rows.filter((r) => r.deletedAt === null).sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1))[0] ?? null
}

/** Gắn ảnh (đã thu nhỏ) cho từ; ảnh cũ của từ bị bỏ. */
export async function addImageData(itemId: ID, image: ImageData, database: VocabDatabase = db, now = Date.now()): Promise<ItemImage> {
  const old = (await database.itemImages.where('itemId').equals(itemId).toArray()).filter((r) => r.deletedAt === null)
  const row: ItemImage = { id: crypto.randomUUID(), itemId, mime: image.mime, width: image.width, height: image.height, createdAt: now, updatedAt: now, deletedAt: null }
  await database.imageBlobs.put({ id: row.id, data: image.data, mime: image.mime })
  await commit(database, [{ table: 'itemImages', rows: [row, ...old.map((r) => ({ ...r, deletedAt: now, updatedAt: now }))] }], now)
  return row
}

export async function setItemImage(itemId: ID, file: Blob): Promise<void> {
  await addImageData(itemId, await shrinkImage(file))
}

/** Bỏ ảnh của các từ (khi xóa ảnh hoặc xóa từ). File trên kho được xóa ở lượt đồng bộ sau. */
export async function removeItemImages(itemIds: ID[], database: VocabDatabase = db, now = Date.now()): Promise<number> {
  const rows = (await database.itemImages.where('itemId').anyOf(itemIds).toArray()).filter((r) => r.deletedAt === null)
  await commit(database, [{ table: 'itemImages', rows: rows.map((r) => ({ ...r, deletedAt: now, updatedAt: now })) }], now)
  return rows.length
}

// ---- Hiện ảnh --------------------------------------------------------------------------------

const urls = new Map<ID, string>()
const downloading = new Map<ID, Promise<boolean>>()

async function localUrl(id: ID): Promise<string | null> {
  const cached = urls.get(id)
  if (cached) return cached
  const blob = await db.imageBlobs.get(id)
  if (!blob) return null
  const url = URL.createObjectURL(new Blob([blob.data], { type: blob.mime }))
  urls.set(id, url)
  return url
}

/** Tải ảnh từ kho về máy (một lần cho mỗi ảnh). */
function fetchImage(image: ItemImage): Promise<boolean> {
  const running = downloading.get(image.id)
  if (running) return running
  const p = (async () => {
    try {
      const auth = getAuth()
      const client = getSupabase()
      if (auth.status !== 'signed_in' || !client || !image.storagePath) return false
      const data = await supabaseImageStorage(await client).download(image.storagePath)
      await db.imageBlobs.put({ id: image.id, data, mime: image.mime ?? 'image/jpeg' })
      return true
    } catch {
      return false
    } finally {
      downloading.delete(image.id)
    }
  })()
  downloading.set(image.id, p)
  return p
}

/** Ảnh của một từ để hiện: đường dẫn ảnh, null nếu không có hoặc chưa tải được, undefined khi đang đọc. */
export function useItemImage(itemId: ID): { image: ItemImage | null; url: string | null } | undefined {
  const image = useLiveQuery(async () => currentImage(await db.itemImages.where('itemId').equals(itemId).toArray()), [itemId])
  const [loaded, setLoaded] = useState<{ id: ID; url: string | null } | null>(null)
  useEffect(() => {
    if (!image) return
    let alive = true
    void (async () => {
      let url = await localUrl(image.id)
      if (!url && (await fetchImage(image))) url = await localUrl(image.id)
      if (alive) setLoaded({ id: image.id, url })
    })()
    return () => {
      alive = false
    }
  }, [image])
  if (image === undefined) return undefined
  if (image === null) return { image: null, url: null }
  return { image, url: loaded?.id === image.id ? loaded.url : null }
}

// ---- Đồng bộ file ------------------------------------------------------------------------------

/**
 * Tải lên kho các ảnh chưa có trên máy chủ, xóa file của ảnh đã bỏ, và dọn file trên máy của ảnh đã bỏ.
 * Trả về số dòng đã đổi (cần gửi lên).
 */
export async function uploadPendingImages(database: VocabDatabase, storage: ImageStorage, userId: string, now = Date.now(), limit = TRANSFER_BATCH): Promise<number> {
  const all = await database.itemImages.toArray()
  const changed: ItemImage[] = []
  for (const r of all.filter((x) => x.deletedAt === null && !x.storagePath)) {
    if (changed.length >= limit) break
    const file = await database.imageBlobs.get(r.id)
    // Ảnh thêm ở máy khác mà chưa tải lên: máy đó sẽ tải lên.
    if (!file) continue
    const path = imagePath(userId, { id: r.id, mime: file.mime })
    await storage.upload(path, file.data, file.mime)
    changed.push({ ...r, mime: file.mime, storagePath: path, updatedAt: now })
  }
  const trash = all.filter((x) => x.deletedAt !== null && x.storagePath)
  if (trash.length > 0) {
    await storage.remove(trash.map((x) => x.storagePath!))
    changed.push(...trash.map((x) => ({ ...x, storagePath: undefined, updatedAt: now })))
  }
  await database.imageBlobs.bulkDelete(all.filter((x) => x.deletedAt !== null).map((x) => x.id))
  await commit(database, [{ table: 'itemImages', rows: changed }], now)
  return changed.length
}

/** Phần ảnh của một lượt đồng bộ. Trả về true nếu có dòng mới cần gửi lên máy chủ. */
export async function syncImages(client: SupabaseClient, userId: string): Promise<boolean> {
  return (await uploadPendingImages(db, supabaseImageStorage(client), userId)) > 0
}
