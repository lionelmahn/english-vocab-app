import { ImageOff, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import type { VocabItem } from '../db/types'
import { showToast } from '../lib/toast'
import { removeItemImages, setItemImage, useItemImage } from '../services/images'
import { Button, Card, SectionTitle } from './ui'

/**
 * Hình minh họa của từ (R2.6): chọn ảnh từ máy hoặc chụp bằng camera; app thu nhỏ trước khi lưu.
 * Ảnh hiện ở trang này và ở mặt sau thẻ từ khi học.
 */
export function WordImageCard({ item }: { item: VocabItem }) {
  const pic = useItemImage(item.id)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (pic === undefined) return null

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await setItemImage(item.id, file)
      showToast(pic?.image ? 'Đã đổi ảnh' : 'Đã thêm ảnh')
    } catch (err) {
      showToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle>Hình minh họa</SectionTitle>
      {pic.image ? (
        pic.url ? (
          <img src={pic.url} alt={`Hình minh họa cho “${item.term}”`} className="mx-auto max-h-64 w-full rounded-2xl bg-surface-2 object-contain" />
        ) : (
          <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-6 text-sm text-muted">
            <ImageOff aria-hidden className="h-5 w-5 shrink-0" /> Ảnh nằm ở máy khác, chưa tải về được (cần mạng và đăng nhập).
          </p>
        )
      ) : (
        <p className="text-sm leading-relaxed text-muted">Gắn một bức ảnh giúp nhớ từ nhanh hơn. Ảnh được thu nhỏ trước khi lưu và đồng bộ sang các máy khác.</p>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onPick(e)} />
      <div className={`mt-3 grid gap-2 ${pic.image ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Button icon={busy ? LoaderCircle : ImagePlus} className="h-11 px-2! text-sm disabled:opacity-60" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Đang xử lý…' : pic.image ? 'Đổi ảnh' : 'Thêm ảnh'}
        </Button>
        {pic.image && (
          <Button
            icon={Trash2}
            className="h-11 px-2! text-sm text-danger"
            disabled={busy}
            onClick={async () => {
              await removeItemImages([item.id])
              showToast('Đã xóa ảnh')
            }}
          >
            Xóa ảnh
          </Button>
        )}
      </div>
    </Card>
  )
}
