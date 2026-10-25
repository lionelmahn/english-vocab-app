import { useLiveQuery } from 'dexie-react-hooks'
import { CircleAlert, CloudOff, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../db/db'
import { checkCloud, useAuth, type CloudCheck } from '../services/auth'
import { syncNow, useSyncStatus, type SyncStatus } from '../services/sync'
import { Button } from './ui'

function StatusLine({ icon, tone, children }: { icon: ReactNode; tone: 'ok' | 'muted' | 'error'; children: ReactNode }) {
  const color = tone === 'ok' ? 'text-accent' : tone === 'error' ? 'text-danger' : 'text-subtle'
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 ${color}`}>{icon}</span>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </div>
  )
}

const timeFmt = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' })

function syncText(sync: SyncStatus, pending: number): string {
  if (sync.state === 'syncing') return 'Đang đồng bộ…'
  if (sync.state === 'error') return `Đồng bộ lỗi: ${sync.error}`
  if (sync.state === 'offline') return 'Đang mất mạng, sẽ đồng bộ khi có mạng lại.'
  if (pending > 0) return `${pending} thay đổi chờ gửi.`
  if (!sync.lastSyncedAt) return 'Đang chờ đồng bộ.'
  const last = sync.last
  const details = [last?.received && `nhận ${last.received} thay đổi`, last?.merged && `gộp ${last.merged} chỗ sửa trên nhiều máy`].filter(Boolean)
  return `Đã đồng bộ lúc ${timeFmt.format(sync.lastSyncedAt)}${details.length ? ` (${details.join(', ')})` : ''}.`
}

/** Kết nối máy chủ (kiểm tra thật sau khi đăng nhập) và trạng thái đồng bộ (R11.1, R11.5, R11.8). */
export function CloudStatus() {
  const auth = useAuth()
  const sync = useSyncStatus()
  // Âm thanh, hình chờ kho trên máy chủ mở thì không tính là "chờ gửi" (báo riêng bên dưới).
  const pending = useLiveQuery(
    () => db.outbox.filter((e) => !(sync.audio === 'not_ready' && e.table === 'audioAssets') && !(sync.images === 'not_ready' && e.table === 'itemImages')).count(),
    [sync.audio, sync.images],
    0,
  )
  const userId = auth.status === 'signed_in' ? auth.userId : null
  const [checked, setChecked] = useState<{ userId: string; result: CloudCheck } | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    checkCloud().then((result) => {
      if (!cancelled) setChecked({ userId, result })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const check: CloudCheck | 'pending' = checked && checked.userId === userId ? checked.result : 'pending'
  const icon = 'h-5 w-5'

  switch (auth.status) {
    case 'disabled':
      return <StatusLine icon={<CloudOff aria-hidden className={icon} />} tone="muted">Chưa kết nối máy chủ. Dữ liệu đang lưu trên thiết bị này.</StatusLine>
    case 'loading':
      return <StatusLine icon={<LoaderCircle aria-hidden className={`${icon} animate-spin`} />} tone="muted">Đang kiểm tra đăng nhập…</StatusLine>
    case 'signed_out':
      return (
        <StatusLine icon={<CloudOff aria-hidden className={icon} />} tone="muted">
          Chưa đăng nhập. Dữ liệu đang lưu trên thiết bị này{pending > 0 && ` (${pending} thay đổi chờ gửi)`}; đăng nhập để đồng bộ giữa các thiết bị.
        </StatusLine>
      )
    case 'signed_in': {
      if (check === 'pending') return <StatusLine icon={<LoaderCircle aria-hidden className={`${icon} animate-spin`} />} tone="muted">Đang kiểm tra kết nối…</StatusLine>
      if (!check.ok) return <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="error">Không kiểm tra được máy chủ: {check.message}</StatusLine>
      return (
        <div className="flex flex-col gap-3">
          <StatusLine icon={<ShieldCheck aria-hidden className={icon} />} tone="ok">
            Đã kết nối máy chủ an toàn. {syncText(sync, pending)}
          </StatusLine>
          {sync.audio === 'not_ready' && (
            <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="muted">
              Kho âm thanh trên máy chủ chưa mở: bản ghi âm và Giọng iPhone đang chỉ lưu trên máy này. Chạy file SQL âm thanh (supabase/migrations/20261025000000_audio_storage.sql) trong Supabase để đồng bộ.
            </StatusLine>
          )}
          {sync.audio === 'error' && (
            <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="muted">
              Chưa tải được file âm thanh lên/về ({sync.audioError}). Dữ liệu học vẫn đồng bộ bình thường; sẽ thử lại lần sau.
            </StatusLine>
          )}
          {sync.images === 'not_ready' && (
            <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="muted">
              Kho hình minh họa trên máy chủ chưa mở: ảnh gắn cho từ đang chỉ lưu trên máy này. Chạy file SQL hình (supabase/migrations/20261028000000_item_images.sql) trong Supabase để đồng bộ.
            </StatusLine>
          )}
          {sync.images === 'error' && (
            <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="muted">
              Chưa tải được ảnh lên ({sync.imagesError}). Dữ liệu học vẫn đồng bộ bình thường; sẽ thử lại lần sau.
            </StatusLine>
          )}
          <Button icon={RefreshCw} className="w-full disabled:opacity-60" disabled={sync.state === 'syncing'} onClick={() => void syncNow()}>
            {sync.state === 'syncing' ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
          </Button>
          <p className="text-xs leading-relaxed text-subtle">
            Tự đồng bộ giữa các thiết bị đăng nhập cùng tài khoản. Sửa cùng lúc trên hai máy thì giữ cả hai thay đổi; cùng sửa một chỗ thì giữ bản sửa sau. Lượt học không bao giờ bị mất hay tính hai lần.
          </p>
        </div>
      )
    }
  }
}
