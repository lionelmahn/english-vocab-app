import { Bell, BellOff, LogIn, Send, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton, Select } from '../components/kit'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { weekdaysLabel } from '../core/profile'
import { DUE_MIN_OPTIONS, DUE_PER_DAY_OPTIONS, sanitizeReminders, type ReminderPrefs } from '../core/reminders'
import { formatDate } from '../lib/format'
import { showToast } from '../lib/toast'
import { useAuth } from '../services/auth'
import { useProfile, updateProfile } from '../services/profile'
import { disablePush, enablePush, listDevices, pushState, removeDevice, sendTest, usePushVersion, type PushDevice, type PushState } from '../services/push'

/** Nhắc học theo giờ, nhắc ôn khi có từ đến hạn, giờ yên lặng (R9.3, R9.4, R9.6) và quyền thông báo trên máy này (R14.5). */
export function RemindersPage() {
  const profile = useProfile()
  const auth = useAuth()
  const navigate = useNavigate()
  const version = usePushVersion()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [devices, setDevices] = useState<PushDevice[] | string | null>(null)

  useEffect(() => {
    let cancelled = false
    pushState().then((s) => !cancelled && setState(s))
    if (auth.status === 'signed_in') listDevices().then((d) => !cancelled && setDevices(d))
    return () => {
      cancelled = true
    }
  }, [auth.status, version])

  if (!profile) return null
  const prefs = sanitizeReminders(profile.reminders)
  const setPrefs = (patch: Partial<ReminderPrefs>) => void updateProfile({ reminders: { ...prefs, ...patch } })

  async function run(action: () => Promise<string | null>, done: string) {
    setBusy(true)
    setMessage(null)
    const error = await action()
    setBusy(false)
    if (error) setMessage({ tone: 'error', text: error })
    else showToast(done)
  }

  return (
    <Page title="Nhắc nhở" subtitle="Nhắc học đúng giờ và nhắc ôn khi có từ đến hạn" back={<BackButton fallback="/me" />} action={<HelpButton topic="reminders" />}>
      <Card>
        <SectionTitle>Trên máy này</SectionTitle>
        <DeviceStatus
          state={state}
          busy={busy}
          onEnable={() => run(enablePush, 'Đã bật nhắc nhở trên máy này')}
          onDisable={() => run(disablePush, 'Đã tắt nhắc nhở trên máy này')}
          onTest={async () => {
            setBusy(true)
            setMessage(null)
            const r = await sendTest()
            setBusy(false)
            setMessage({ tone: r.ok ? 'ok' : 'error', text: r.message })
          }}
          onLogin={() => navigate('/login')}
        />
        {message && <p className={`mt-3 text-[13px] leading-snug ${message.tone === 'ok' ? 'text-accent' : 'text-danger'}`}>{message.text}</p>}
      </Card>

      <Card>
        <SectionTitle className="mb-1">Nhắc gì, lúc nào</SectionTitle>
        <p className="mb-3 text-xs text-subtle">Áp dụng cho mọi máy đã bật nhắc nhở. Máy chủ kiểm tra 15 phút một lần nên thông báo có thể đến trễ vài phút.</p>
        <div className="flex flex-col divide-y divide-line">
          <div>
            <Row
              title="Nhắc giờ học"
              description={
                profile.studyTime
                  ? `Lúc ${profile.studyTime} vào ngày học (${weekdaysLabel(profile.studyWeekdays)}), nếu hôm đó bạn chưa học.`
                  : 'Chưa đặt giờ học nên chưa nhắc được.'
              }
            >
              <Switch label="Nhắc giờ học" checked={prefs.study} onChange={(v) => setPrefs({ study: v })} />
            </Row>
            {!profile.studyTime && (
              <div className="pb-3">
                <Button className="h-10 w-full text-sm" onClick={() => navigate('/me/goals')}>
                  Đặt giờ học
                </Button>
              </div>
            )}
          </div>
          <div>
            <Row
              title="Nhắc khi có từ đến hạn"
              description={`Khi có từ ${prefs.dueMin} từ đến hạn trở lên, tối đa ${prefs.duePerDay} lần mỗi ngày, cách lần nhắc trước ít nhất 3 tiếng.`}
            >
              <Switch label="Nhắc khi có từ đến hạn" checked={prefs.due} onChange={(v) => setPrefs({ due: v })} />
            </Row>
            {prefs.due && (
              <div className="grid grid-cols-2 gap-3 pb-3">
                <Select label="Khi có ít nhất" value={prefs.dueMin} onChange={(e) => setPrefs({ dueMin: Number(e.target.value) })}>
                  {[...new Set([...DUE_MIN_OPTIONS, prefs.dueMin])]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} từ đến hạn
                      </option>
                    ))}
                </Select>
                <Select label="Tối đa mỗi ngày" value={prefs.duePerDay} onChange={(e) => setPrefs({ duePerDay: Number(e.target.value) })}>
                  {[...new Set([...DUE_PER_DAY_OPTIONS, prefs.duePerDay])]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} lần
                      </option>
                    ))}
                </Select>
              </div>
            )}
          </div>
          <div className="pt-3">
            <p className="text-[15px] font-medium">Giờ yên lặng</p>
            <p className="mt-0.5 mb-2 text-[13px] leading-snug text-muted">Không nhắc gì trong khoảng này, kể cả giờ học.</p>
            <div className="grid grid-cols-2 gap-3">
              <TimeField label="Từ" value={prefs.quietStart} onChange={(v) => setPrefs({ quietStart: v })} />
              <TimeField label="Đến" value={prefs.quietEnd} onChange={(v) => setPrefs({ quietEnd: v })} />
            </div>
          </div>
        </div>
      </Card>

      {auth.status === 'signed_in' && (
        <Card>
          <SectionTitle>Các máy đang nhận nhắc nhở</SectionTitle>
          {devices === null ? (
            <p className="text-sm text-muted">Đang tải…</p>
          ) : typeof devices === 'string' ? (
            <p className="text-sm text-danger">{devices}</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted">Chưa có máy nào.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <Bell aria-hidden className="h-5 w-5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">
                      {d.device || 'Máy không rõ tên'}
                      {state?.kind === 'on' && state.endpoint === d.endpoint && <span className="font-normal text-muted"> · máy này</span>}
                    </span>
                    <span className="block text-[12px] text-subtle">Bật từ {formatDate(Date.parse(d.created_at))}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Ngừng nhắc trên ${d.device || 'máy này'}`}
                    className="rounded-xl p-2 text-muted"
                    onClick={async () => {
                      const error = await removeDevice(d.id)
                      if (error) setMessage({ tone: 'error', text: error })
                      else showToast('Máy đó sẽ không nhận nhắc nhở nữa')
                    }}
                  >
                    <Trash2 aria-hidden className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Page>
  )
}

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>
      </div>
      {children}
    </div>
  )
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="flex h-12 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
        <input type="time" aria-label={`Giờ yên lặng ${label.toLowerCase()}`} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-full w-full bg-transparent text-[15px] outline-none" />
      </span>
    </label>
  )
}

function DeviceStatus({
  state,
  busy,
  onEnable,
  onDisable,
  onTest,
  onLogin,
}: {
  state: PushState | null
  busy: boolean
  onEnable: () => void
  onDisable: () => void
  onTest: () => void
  onLogin: () => void
}) {
  const text = (children: ReactNode) => <p className="text-sm leading-relaxed text-muted">{children}</p>
  if (!state) return text('Đang kiểm tra…')
  switch (state.kind) {
    case 'not-configured':
      return text('Bản app này chưa cài nhắc nhở.')
    case 'needs-install':
      return text(
        <>
          Trên iPhone và iPad, thông báo chỉ chạy khi app đã cài lên màn hình chính: mở bằng Safari, chạm nút Chia sẻ, chọn “Thêm vào MH chính”, rồi mở app từ màn hình
          chính và quay lại trang này.
        </>,
      )
    case 'unsupported':
      return text('Trình duyệt này không nhận được thông báo. Hãy mở app đã cài trên điện thoại.')
    case 'signed-out':
      return (
        <div className="flex flex-col gap-3">
          {text('Đăng nhập để nhận nhắc nhở: máy chủ cần biết bạn là ai để gửi đúng lúc.')}
          <Button variant="primary" icon={LogIn} className="w-full" onClick={onLogin}>
            Đăng nhập
          </Button>
        </div>
      )
    case 'denied':
      return text('Bạn đã chặn thông báo của app. Vào Cài đặt của máy → Thông báo → Ôn từ vựng → bật Cho phép thông báo, rồi quay lại trang này.')
    case 'off':
      return (
        <div className="flex flex-col gap-3">
          {text('Máy này chưa nhận nhắc nhở. Bấm bật rồi chọn “Cho phép” khi máy hỏi.')}
          <Button variant="primary" icon={Bell} className="w-full" disabled={busy} onClick={onEnable}>
            {busy ? 'Đang bật…' : 'Bật nhắc nhở trên máy này'}
          </Button>
        </div>
      )
    case 'on':
      return (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Bell aria-hidden className="h-5 w-5" /> Đã bật trên máy này.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button icon={Send} className="h-11 text-sm" disabled={busy} onClick={onTest}>
              Gửi thử
            </Button>
            <Button icon={BellOff} className="h-11 text-sm" disabled={busy} onClick={onDisable}>
              Tắt trên máy này
            </Button>
          </div>
        </div>
      )
  }
}
