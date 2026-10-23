import { CircleAlert, CloudOff, LoaderCircle, LogIn, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { updateSettings, useSettings } from '../lib/settings'
import { APP_VERSION } from '../lib/version'
import { checkCloud, signOut, useAuth, type CloudCheck } from '../services/auth'

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>
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

/** Trạng thái kết nối máy chủ, kiểm tra thật sau khi đăng nhập. */
function CloudStatus() {
  const auth = useAuth()
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
      return <StatusLine icon={<CloudOff aria-hidden className={icon} />} tone="muted">Đã cấu hình máy chủ. Đăng nhập để sao lưu và đồng bộ.</StatusLine>
    case 'signed_in':
      if (check === 'pending')
        return <StatusLine icon={<LoaderCircle aria-hidden className={`${icon} animate-spin`} />} tone="muted">Đang kiểm tra kết nối…</StatusLine>
      if (check.ok)
        return (
          <StatusLine icon={<ShieldCheck aria-hidden className={icon} />} tone="ok">
            Đã kết nối máy chủ an toàn. Đồng bộ dữ liệu giữa các thiết bị sẽ bật ở giai đoạn 1–2.
          </StatusLine>
        )
      return <StatusLine icon={<CircleAlert aria-hidden className={icon} />} tone="error">Không kiểm tra được máy chủ: {check.message}</StatusLine>
  }
}

export function ProfilePage() {
  const settings = useSettings()
  const auth = useAuth()
  const navigate = useNavigate()
  const installed = isInstalled()
  const [signingOut, setSigningOut] = useState(false)

  const signedIn = auth.status === 'signed_in'
  const name = signedIn ? auth.email : 'Bạn'
  const initial = (signedIn ? auth.email : 'B').charAt(0).toUpperCase()

  return (
    <Page title="Cá nhân">
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent">{initial}</div>
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="text-sm text-muted">
              {signedIn ? 'Đã đăng nhập' : auth.status === 'signed_out' ? 'Chưa đăng nhập' : 'Dữ liệu lưu trên thiết bị này'}
            </p>
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
        <SectionTitle>Trải nghiệm</SectionTitle>
        <SettingRow title="Giảm hiệu ứng" description="Tắt chuyển động trượt, lật thẻ và pháo giấy.">
          <Switch label="Giảm hiệu ứng" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </SettingRow>
        <SettingRow title="Âm thanh hiệu ứng" description="Tiếng báo đúng/sai khi luyện tập.">
          <Switch label="Âm thanh hiệu ứng" checked={settings.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} />
        </SettingRow>
      </Card>

      <Card>
        <SectionTitle>Máy chủ và đồng bộ</SectionTitle>
        <CloudStatus />
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
