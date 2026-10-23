import { useLiveQuery } from 'dexie-react-hooks'
import { CircleAlert, CloudOff, CloudUpload, FileUp, LoaderCircle, LogIn, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Segmented, Select } from '../components/kit'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { db } from '../db/db'
import { updateSettings, useSettings } from '../lib/settings'
import { APP_VERSION } from '../lib/version'
import { checkCloud, signOut, useAuth, type CloudCheck } from '../services/auth'
import { hasExactVoice, speechAvailable, useVoicesReady } from '../services/speech'
import { syncNow, useSyncStatus } from '../services/sync'

function SettingRow({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function isInstalled(): boolean {
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone || iosStandalone
}

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

/** Kết nối máy chủ (kiểm tra thật sau khi đăng nhập) và trạng thái sao lưu (R11.1). */
function CloudStatus() {
  const auth = useAuth()
  const sync = useSyncStatus()
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)
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
          Chưa đăng nhập. Dữ liệu đang lưu trên thiết bị này{pending > 0 && ` (${pending} thay đổi chờ sao lưu)`}; đăng nhập để sao lưu lên máy chủ.
        </StatusLine>
      )
    case 'signed_in': {
      if (check === 'pending') return <StatusLine icon={<LoaderCircle aria-hidden className={`${icon} animate-spin`} />} tone="muted">Đang kiểm tra kết nối…</StatusLine>
      if (!check.ok) return <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="error">Không kiểm tra được máy chủ: {check.message}</StatusLine>
      return (
        <div className="flex flex-col gap-3">
          <StatusLine icon={<ShieldCheck aria-hidden className={icon} />} tone="ok">
            Đã kết nối máy chủ an toàn.{' '}
            {sync.state === 'syncing'
              ? 'Đang sao lưu…'
              : sync.state === 'error'
                ? `Sao lưu lỗi: ${sync.error}`
                : sync.state === 'offline'
                  ? 'Đang mất mạng, sẽ sao lưu khi có mạng.'
                  : pending > 0
                    ? `${pending} thay đổi chờ sao lưu.`
                    : sync.lastSyncedAt
                      ? `Đã sao lưu lúc ${timeFmt.format(sync.lastSyncedAt)}.`
                      : 'Dữ liệu đã được sao lưu.'}
          </StatusLine>
          {(pending > 0 || sync.state === 'error') && (
            <Button icon={CloudUpload} className="w-full disabled:opacity-60" disabled={sync.state === 'syncing'} onClick={() => void syncNow()}>
              Sao lưu ngay
            </Button>
          )}
          <p className="text-xs leading-relaxed text-subtle">Đồng bộ hai chiều giữa nhiều thiết bị sẽ có ở giai đoạn 2.</p>
        </div>
      )
    }
  }
}

export function ProfilePage() {
  const settings = useSettings()
  const auth = useAuth()
  const navigate = useNavigate()
  const installed = isInstalled()
  const [signingOut, setSigningOut] = useState(false)
  useVoicesReady()

  const signedIn = auth.status === 'signed_in'
  const name = signedIn ? auth.email : 'Bạn'
  const initial = (signedIn ? auth.email : 'B').charAt(0).toUpperCase()
  const voiceMissing = speechAvailable() && !hasExactVoice(settings.accent)

  return (
    <Page title="Cá nhân">
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent">{initial}</div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="text-sm text-muted">{signedIn ? 'Đã đăng nhập' : auth.status === 'signed_out' ? 'Chưa đăng nhập' : 'Dữ liệu lưu trên thiết bị này'}</p>
          </div>
        </div>
        {auth.status === 'signed_out' && (
          <Button variant="primary" icon={LogIn} className="mt-4 w-full" onClick={() => navigate('/login')}>
            Đăng nhập
          </Button>
        )}
        {signedIn && (
          <Button
            icon={LogOut}
            className="mt-4 w-full disabled:opacity-70"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true)
              await signOut()
              setSigningOut(false)
            }}
          >
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </Button>
        )}
      </Card>

      <Card>
        <SectionTitle>Học tập</SectionTitle>
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-[15px] font-medium">Giọng đọc</p>
            <Segmented
              layoutId="accent"
              value={settings.accent}
              onChange={(v) => updateSettings({ accent: v })}
              options={[
                { value: 'us', label: 'Anh–Mỹ' },
                { value: 'uk', label: 'Anh–Anh' },
              ]}
            />
            {voiceMissing && <p className="mt-2 text-xs text-warning">Thiết bị chưa có giọng {settings.accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'}; đang dùng giọng tiếng Anh khác.</p>}
            {!speechAvailable() && <p className="mt-2 text-xs text-warning">Trình duyệt này không hỗ trợ đọc. Các bài nghe sẽ được thay bằng bài gõ từ.</p>}
          </div>
          <div>
            <p className="mb-2 text-[15px] font-medium">Mặt trước của thẻ</p>
            <Segmented
              layoutId="front"
              value={settings.flashcardFront}
              onChange={(v) => updateSettings({ flashcardFront: v })}
              options={[
                { value: 'term', label: 'Từ tiếng Anh' },
                { value: 'meaning', label: 'Nghĩa tiếng Việt' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-[15px] font-medium">Kiểu ôn tập</p>
            <Segmented
              layoutId="style"
              value={settings.reviewStyle}
              onChange={(v) => updateSettings({ reviewStyle: v })}
              options={[
                { value: 'exercises', label: 'Bài luyện' },
                { value: 'flashcard', label: 'Thẻ tự đánh giá' },
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-subtle">
              {settings.reviewStyle === 'exercises' ? 'Trắc nghiệm, gõ từ và nghe viết; app tự chấm.' : 'Lật thẻ rồi tự chọn Quên / Khó / Nhớ / Dễ.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Từ mới mỗi buổi" value={settings.dailyNewWords} onChange={(e) => updateSettings({ dailyNewWords: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} từ
                </option>
              ))}
            </Select>
            <Select label="Tối đa mỗi buổi ôn" value={settings.reviewLimit} onChange={(e) => updateSettings({ reviewLimit: Number(e.target.value) })}>
              {[20, 30, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} từ
                </option>
              ))}
            </Select>
          </div>
          <div>
            <SettingRow title="Tự phát âm" description="Đọc từ khi hiện thẻ và bài nghe.">
              <Switch label="Tự phát âm" checked={settings.autoPlay} onChange={(v) => updateSettings({ autoPlay: v })} />
            </SettingRow>
            <SettingRow title="Hiện bản dịch câu ví dụ" description="Có thể bật/tắt riêng ở từng từ.">
              <Switch label="Hiện bản dịch câu ví dụ" checked={settings.showTranslations} onChange={(v) => updateSettings({ showTranslations: v })} />
            </SettingRow>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Trải nghiệm</SectionTitle>
        <SettingRow title="Giảm hiệu ứng" description="Tắt chuyển động trượt, lật thẻ và pháo giấy.">
          <Switch label="Giảm hiệu ứng" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </SettingRow>
        <SettingRow title="Âm thanh hiệu ứng" description="Tiếng báo đúng/sai khi luyện tập.">
          <Switch label="Âm thanh hiệu ứng" checked={settings.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} />
        </SettingRow>
      </Card>

      <Card>
        <SectionTitle>Máy chủ và sao lưu</SectionTitle>
        <CloudStatus />
      </Card>

      <Card>
        <SectionTitle>Dữ liệu</SectionTitle>
        <Button icon={FileUp} className="w-full" onClick={() => navigate('/import')}>
          Nhập từ file Excel/CSV
        </Button>
      </Card>

      <Card>
        <SectionTitle>Cài app lên điện thoại</SectionTitle>
        {installed ? (
          <p className="flex items-center gap-2 text-sm text-accent">
            <Smartphone aria-hidden className="h-5 w-5" /> Bạn đang dùng bản đã cài.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              <span className="font-semibold text-text">iPhone:</span> mở bằng Safari, chạm nút Chia sẻ, chọn “Thêm vào MH chính”.
            </p>
            <p>
              <span className="font-semibold text-text">Android:</span> mở bằng Chrome, chạm menu ⋮, chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.
            </p>
          </div>
        )}
      </Card>

      <p className="pt-2 text-center text-xs text-subtle">Phiên bản {APP_VERSION}</p>
    </Page>
  )
}
