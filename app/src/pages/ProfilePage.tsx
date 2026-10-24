import { useLiveQuery } from 'dexie-react-hooks'
import { AudioLines, CalendarDays, ChevronRight, CircleAlert, CloudOff, DatabaseBackup, FileUp, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, Smartphone, Target, Volume2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Segmented, Select } from '../components/kit'
import { SELF_LEVELS, timeZoneOffset, weekdaysLabel } from '../core/profile'
import { useProfile } from '../services/profile'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { db } from '../db/db'
import { updateSettings, useSettings } from '../lib/settings'
import { APP_VERSION } from '../lib/version'
import { checkCloud, signOut, useAuth, type CloudCheck } from '../services/auth'
import { voiceLabel } from '../core/voices'
import { englishVoices, hasExactVoice, isAppleDevice, isAppleMobile, pickVoice, previewVoice, speechAvailable, useVoicesReady } from '../services/speech'
import { useClipKeys } from '../services/voiceClips'
import { syncNow, useSyncStatus, type SyncStatus } from '../services/sync'

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

/** Kết nối máy chủ (kiểm tra thật sau khi đăng nhập) và trạng thái đồng bộ (R11.1, R11.5). */
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

/** Nguồn phát âm: bản ghi giọng người thật và giọng máy (chọn, nghe thử, hướng dẫn tải giọng tốt hơn). */
function VoiceSettings() {
  const settings = useSettings()
  useVoicesReady()
  const [help, setHelp] = useState(false)
  const accent = settings.accent
  const list = englishVoices(accent)
  const current = accent === 'uk' ? settings.voiceUK : settings.voiceUS
  const pinned = list.find((v) => v.voiceURI === current)
  const auto = pickVoice(accent, true)
  const apple = isAppleMobile()
  const appleDevice = isAppleDevice()
  const clipKeys = useClipKeys()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-3">
      <SettingRow title="Ưu tiên giọng người thật" description="Bản ghi phát âm từng từ từ Wiktionary. Câu ví dụ và từ chưa có bản ghi dùng giọng máy.">
        <Switch label="Ưu tiên giọng người thật" checked={settings.preferRecordings} onChange={(v) => updateSettings({ preferRecordings: v })} />
      </SettingRow>
      {appleDevice && (
        <button
          type="button"
          onClick={() => navigate('/voice')}
          className="flex items-center gap-3 rounded-2xl border-2 border-accent/40 bg-accent-soft p-3 text-left transition-transform active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <AudioLines aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-accent-strong">Giọng iPhone (Nâng cao/Cao cấp)</span>
            <span className="block text-[13px] leading-snug text-muted">
              {clipKeys.size > 0 ? `Đã có ${clipKeys.size} âm thanh. ` : ''}Dùng giọng bạn tải trong Cài đặt, qua app Phím tắt.
            </span>
          </span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-accent" />
        </button>
      )}
      {(list.length > 0 || apple) && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label="Giọng máy"
              value={pinned ? pinned.voiceURI : ''}
              onChange={(e) => updateSettings(accent === 'uk' ? { voiceUK: e.target.value || null } : { voiceUS: e.target.value || null })}
            >
              <option value="">{apple ? 'Tự động: giọng chọn trong Cài đặt' : `Tự động (${auto ? voiceLabel(auto).split(' · ')[0] : 'giọng tốt nhất'})`}</option>
              {list.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {voiceLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <Button icon={Volume2} className="h-12 shrink-0 px-4" onClick={() => void previewVoice(pickVoice(accent), accent)}>
            Nghe thử
          </Button>
        </div>
      )}
      <div>
        <p className="mb-2 text-[15px] font-medium">Tốc độ giọng máy</p>
        <Segmented
          layoutId="speech-speed"
          value={settings.speechSpeed}
          onChange={(v) => {
            updateSettings({ speechSpeed: v })
            void previewVoice(pickVoice(accent), accent)
          }}
          options={[
            { value: 'slower', label: 'Rất chậm' },
            { value: 'slow', label: 'Chậm' },
            { value: 'normal', label: 'Vừa' },
            { value: 'fast', label: 'Nhanh' },
          ]}
        />
      </div>
      {apple && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">
          {pinned && (
            <p className="font-semibold text-warning">
              Đang dùng giọng “{pinned.name}” có sẵn của máy. Chọn “Tự động” để dùng giọng Nâng cao/Cao cấp bạn đã tải.
            </p>
          )}
          <p>
            Cách chắc chắn nhất là <b className="text-text">Giọng iPhone</b> ở trên. Ngoài ra, để <b className="text-text">Tự động</b>, app nhờ iPhone đọc bằng giọng bạn chọn trong{' '}
            <b className="text-text">Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Anh</b>, kể cả giọng tải thêm “Nâng cao”, “Cao cấp” (các giọng này không hiện trong danh sách
            trên vì Apple ẩn chúng với ứng dụng web).
          </p>
          <p>
            Giọng chọn trong Cài đặt phải <b className="text-text">cùng giọng với app</b>: app đang để {accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'} thì chọn giọng{' '}
            {accent === 'uk' ? 'Anh (Jamie, Serena, Kate, Oliver…)' : 'Mỹ (Evan, Ava, Zoe, Nathan…)'}. Khác giọng thì iPhone đọc bằng giọng mặc định{' '}
            {accent === 'uk' ? 'Daniel' : 'Samantha'}.
          </p>
          <p>
            Lưu ý: iOS 26 có lỗi đôi khi bỏ qua giọng đã chọn và vẫn đọc bằng giọng mặc định (đã có người báo Apple, chưa được sửa), hay gặp khi mở app từ màn hình chính.
          </p>
          <p>Đổi giọng trong Cài đặt xong, tắt hẳn app (vuốt lên khỏi màn đa nhiệm) rồi mở lại và bấm “Nghe thử”.</p>
          <p>Muốn cả từ vựng cũng đọc bằng giọng này thì tắt “Ưu tiên giọng người thật”.</p>
        </div>
      )}
      {!apple && (
        <>
          <button type="button" onClick={() => setHelp((h) => !h)} className="self-start text-sm font-semibold text-accent">
            {help ? 'Ẩn hướng dẫn' : 'Giọng máy nghe chưa hay? Tải giọng chất lượng cao'}
          </button>
          {help && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">
              <p>
                <b className="text-text">Android:</b> Cài đặt → Hệ thống → Ngôn ngữ → Đầu ra chuyển văn bản thành lời nói → Dịch vụ của Google → Cài đặt → Cài đặt dữ liệu giọng nói → Tiếng Anh (Mỹ/Vương
                quốc Anh) → tải giọng chất lượng cao. Sau đó tắt hẳn trình duyệt rồi mở lại app.
              </p>
              <p>
                <b className="text-text">Máy tính:</b> Chrome có sẵn giọng “Google US English / UK English”; Edge có giọng “Online (Natural)” rất tự nhiên.
              </p>
              <p>
                <b className="text-text">iPhone/iPad:</b> Apple không cho ứng dụng web dùng giọng tải thêm, chỉ dùng được giọng có sẵn của máy.
              </p>
            </div>
          )}
        </>
      )}
      <p className="text-[11px] leading-relaxed text-subtle">Bản ghi phát âm: Wiktionary / Wikimedia Commons, giấy phép CC BY-SA, CC BY hoặc phạm vi công cộng.</p>
    </div>
  )
}

export function ProfilePage() {
  const settings = useSettings()
  const auth = useAuth()
  const navigate = useNavigate()
  const installed = isInstalled()
  const [signingOut, setSigningOut] = useState(false)
  useVoicesReady()

  const profile = useProfile()

  const signedIn = auth.status === 'signed_in'
  const name = profile?.displayName || (signedIn ? auth.email : 'Bạn')
  const level = SELF_LEVELS.find((l) => l.value === profile?.selfLevel)?.label
  const about = [level, profile?.learningPurpose].filter(Boolean).join(' · ')
  const voiceMissing = speechAvailable() && !hasExactVoice(settings.accent)

  return (
    <Page title="Cá nhân">
      <Card>
        <button type="button" onClick={() => navigate('/me/profile')} className="flex w-full items-center gap-4 text-left">
          <Avatar src={profile?.avatarUrl} name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{about || 'Thêm tên, ảnh, trình độ và mục đích học'}</p>
            <p className="truncate text-xs text-subtle">
              {signedIn ? `Đã đăng nhập · ${auth.email}` : auth.status === 'signed_out' ? 'Chưa đăng nhập' : 'Dữ liệu lưu trên thiết bị này'}
            </p>
          </div>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
        </button>
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

      {profile && (
        <Card>
          <SectionTitle>Mục tiêu và lịch học</SectionTitle>
          <div className="flex flex-col gap-2.5 text-[15px]">
            <p className="flex items-center gap-3">
              <Target aria-hidden className="h-5 w-5 shrink-0 text-accent" />
              {profile.dailyNewWords} từ mới · {profile.dailyMinutes} phút mỗi ngày
            </p>
            <p className="flex items-center gap-3">
              <CalendarDays aria-hidden className="h-5 w-5 shrink-0 text-accent" />
              {weekdaysLabel(profile.studyWeekdays)}
              {profile.studyTime ? ` · lúc ${profile.studyTime}` : ''} · {timeZoneOffset(profile.timeZone)}
            </p>
          </div>
          <Button className="mt-4 w-full" onClick={() => navigate('/me/goals')}>
            Đổi mục tiêu và lịch học
          </Button>
        </Card>
      )}

      <Card>
        <SectionTitle className="mb-1">Học tập</SectionTitle>
        <p className="mb-3 text-xs text-subtle">Đồng bộ giữa các thiết bị đăng nhập cùng tài khoản; riêng giọng máy đã chọn là của từng máy.</p>
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
          <VoiceSettings />
          <div>
            <p className="text-[15px] font-medium">Mặt trước thẻ khi ôn</p>
            <p className="mt-0.5 mb-2 text-[13px] leading-snug text-muted">Dùng cho kiểu ôn “Thẻ tự đánh giá”. Học từ mới luôn hiện tiếng Anh trước.</p>
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
          <Select label="Tối đa mỗi buổi ôn" value={settings.reviewLimit} onChange={(e) => updateSettings({ reviewLimit: Number(e.target.value) })}>
            {[...new Set([20, 30, 50, 100, 200, settings.reviewLimit])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} từ
                </option>
              ))}
          </Select>
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
        <SectionTitle className="mb-1">Trải nghiệm</SectionTitle>
        <p className="mb-2 text-xs text-subtle">Chỉ áp dụng trên máy này.</p>
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
        <SectionTitle>Dữ liệu</SectionTitle>
        <div className="flex flex-col gap-2">
          <Button icon={DatabaseBackup} className="w-full" onClick={() => navigate('/backup')}>
            Sao lưu và khôi phục
          </Button>
          <Button icon={FileUp} className="w-full" onClick={() => navigate('/import')}>
            Nhập từ file Excel/CSV
          </Button>
        </div>
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
