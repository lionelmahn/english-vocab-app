import { Bell, KeyRound, LogIn, LogOut, Mic, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton } from '../components/kit'
import { Button, Card, FormMessage, Page, SectionTitle, TextField } from '../components/ui'
import { formatDate } from '../lib/format'
import { showToast } from '../lib/toast'
import {
  deleteAccount,
  pendingChanges,
  permissionStates,
  sessionInfo,
  signOutOthers,
  wipeThisDevice,
  type MicrophonePermissionState,
  type NotificationPermissionState,
  type SessionInfo,
} from '../services/account'
import { updatePassword, useAuth } from '../services/auth'

const MIN_PASSWORD = 8

/** Tài khoản (R1.6) và quyền riêng tư (R14.5). */
export function AccountPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const signedIn = auth.status === 'signed_in'
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [permissions, setPermissions] = useState<{ notifications: NotificationPermissionState; microphone: MicrophonePermissionState } | null>(null)

  useEffect(() => {
    let cancelled = false
    permissionStates().then((p) => !cancelled && setPermissions(p))
    if (signedIn) sessionInfo().then((s) => !cancelled && setSession(s))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  return (
    <Page title="Tài khoản và quyền riêng tư" back={<BackButton fallback="/me" />} action={<HelpButton topic="account" />}>
      <Card>
        <SectionTitle>Tài khoản</SectionTitle>
        {!signedIn ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted">Chưa đăng nhập. Dữ liệu chỉ nằm trên máy này; đăng nhập để đồng bộ giữa các máy.</p>
            {auth.status === 'signed_out' && (
              <Button variant="primary" icon={LogIn} className="w-full" onClick={() => navigate('/login')}>
                Đăng nhập
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-sm leading-relaxed text-muted">
              <p>
                Email: <b className="text-text">{auth.email}</b>
              </p>
              {session?.lastSignInAt && <p>Lần đăng nhập gần nhất: {formatDate(Date.parse(session.lastSignInAt))}</p>}
              {session?.createdAt && <p>Tạo tài khoản: {formatDate(Date.parse(session.createdAt))}</p>}
            </div>
            <ChangePassword />
            <div className="flex flex-col gap-2">
              <Button
                icon={LogOut}
                className="w-full"
                onClick={async () => {
                  if (!window.confirm('Đăng xuất mọi máy khác (giữ máy này)? Các máy kia thôi đồng bộ trong vòng khoảng 1 tiếng và thôi nhận nhắc nhở.')) return
                  const error = await signOutOthers()
                  showToast(error ?? 'Đã đăng xuất mọi máy khác')
                }}
              >
                Đăng xuất mọi máy khác
              </Button>
              <p className="text-xs leading-relaxed text-subtle">
                Dùng khi mất máy hoặc lỡ đăng nhập trên máy lạ. Máy chủ không cho app xem danh sách các máy đang đăng nhập; các máy đang nhận nhắc nhở xem ở trang Nhắc nhở.
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Quyền trên máy này</SectionTitle>
        <div className="flex flex-col divide-y divide-line">
          <PermissionRow
            icon={<Bell aria-hidden className="h-5 w-5" />}
            title="Thông báo"
            state={permissions ? NOTIFICATION_TEXT[permissions.notifications] : 'Đang kiểm tra…'}
            note="Dùng để nhắc học và nhắc ôn. Bật, tắt ở trang Nhắc nhở; đã chặn thì mở lại trong Cài đặt của máy → Thông báo."
            action={
              <Button className="h-9 px-3 text-sm" onClick={() => navigate('/me/reminders')}>
                Nhắc nhở
              </Button>
            }
          />
          <PermissionRow
            icon={<Mic aria-hidden className="h-5 w-5" />}
            title="Micro"
            state={permissions ? MIC_TEXT[permissions.microphone] : 'Đang kiểm tra…'}
            note="Chỉ dùng khi bạn tự ghi âm cách đọc của một từ (trang chi tiết từ → Phát âm → Ghi âm) hoặc luyện đọc. Đổi quyền trong cài đặt của trình duyệt (iPhone: Cài đặt → Safari → Micro)."
          />
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Dữ liệu của bạn đi đâu</SectionTitle>
        <ul className="mt-2 flex flex-col gap-2.5 text-sm leading-relaxed text-muted">
          <li>
            <b className="text-text">Trên máy này:</b> mọi dữ liệu (từ vựng, lịch ôn, lịch sử học, âm thanh, cài đặt), để học được cả khi mất mạng.
          </li>
          <li>
            <b className="text-text">Máy chủ Supabase (khi đăng nhập):</b> từ vựng, bộ từ, lịch ôn, lịch sử học, hồ sơ, bản ghi âm và đăng ký nhắc nhở, để đồng bộ giữa các máy và gửi nhắc nhở.
            Chỉ tài khoản của bạn đọc được.
          </li>
          <li>
            <b className="text-text">Wiktionary, Wikimedia:</b> khi tra từ hoặc nghe bản ghi giọng người thật, app gửi từ cần tra, không kèm thông tin của bạn. Tắt “Ưu tiên giọng người thật” ở
            Cá nhân thì app không tải bản ghi nữa.
          </li>
          <li className="flex gap-2 text-accent">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            App không có quảng cáo, không theo dõi và không gửi dữ liệu của bạn cho ai khác.
          </li>
        </ul>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Xóa dữ liệu</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-subtle">Không hoàn tác được. Nên tạo bản sao lưu trước (Cá nhân → Sao lưu, khôi phục, xuất file).</p>
        <WipeDevice signedIn={signedIn} />
        {signedIn && (
          <div className="mt-5 border-t border-line pt-4">
            <DeleteAccount />
          </div>
        )}
      </Card>
    </Page>
  )
}

const NOTIFICATION_TEXT: Record<NotificationPermissionState, string> = {
  granted: 'Đã cho phép',
  denied: 'Đã chặn',
  default: 'Chưa hỏi',
  unsupported: 'Trình duyệt này không hỗ trợ (trên iPhone cần cài app lên màn hình chính)',
}

const MIC_TEXT: Record<MicrophonePermissionState, string> = {
  granted: 'Đã cho phép',
  denied: 'Đã chặn',
  prompt: 'Sẽ hỏi khi bạn ghi âm',
  unknown: 'Trình duyệt không cho biết; sẽ hỏi khi bạn ghi âm',
}

function PermissionRow({ icon, title, state, note, action }: { icon: ReactNode; title: string; state: string; note: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-medium">
          {title}: <span className="font-normal text-muted">{state}</span>
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-subtle">{note}</p>
      </div>
      {action}
    </div>
  )
}

function ChangePassword() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <Button icon={KeyRound} className="w-full" onClick={() => setOpen(true)}>
        Đổi mật khẩu
      </Button>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return setMessage({ tone: 'error', text: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.` })
    if (confirm !== password) return setMessage({ tone: 'error', text: 'Hai mật khẩu chưa khớp nhau.' })
    setBusy(true)
    const error = await updatePassword(password)
    setBusy(false)
    if (error) return setMessage({ tone: 'error', text: error })
    setMessage(null)
    setPassword('')
    setConfirm('')
    setOpen(false)
    showToast('Đã đổi mật khẩu')
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <TextField label="Mật khẩu mới" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <TextField label="Nhập lại mật khẩu mới" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <FormMessage message={message} />
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-11 text-sm" onClick={() => setOpen(false)}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" className="h-11 text-sm disabled:opacity-70" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu mật khẩu'}
        </Button>
      </div>
    </form>
  )
}

/** Gõ chữ XÓA (có hoặc không dấu) để mở nút xóa. */
function TypedConfirm({ label, busy, onConfirm, icon }: { label: string; busy: boolean; onConfirm: () => void; icon: typeof Trash2 }) {
  const [text, setText] = useState('')
  const ok = /^x[oó]a$/i.test(text.normalize('NFC').trim())
  return (
    <div className="mt-3 flex flex-col gap-2">
      <TextField label="Gõ XÓA để xác nhận" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      <Button variant="danger" icon={icon} className="w-full disabled:opacity-70" disabled={!ok || busy} onClick={onConfirm}>
        {busy ? 'Đang xóa…' : label}
      </Button>
    </div>
  )
}

function WipeDevice({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <p className="text-[0.9375rem] font-medium">Xóa dữ liệu trên máy này</p>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
        Xóa sổ tay, lịch sử, âm thanh, cài đặt và phiên đăng nhập trên máy này rồi mở lại app như mới. {signedIn ? 'Dữ liệu trên máy chủ vẫn còn; đăng nhập lại là tải về.' : 'Chưa đăng nhập nên dữ liệu sẽ mất hẳn.'}
      </p>
      {!open ? (
        <Button
          icon={Trash2}
          className="mt-3 w-full"
          onClick={async () => {
            setPending(signedIn ? await pendingChanges() : 0)
            setOpen(true)
          }}
        >
          Xóa dữ liệu trên máy này
        </Button>
      ) : (
        <>
          {!!pending && (
            <p className="mt-3 text-[0.8125rem] leading-snug text-warning">
              Còn {pending} thay đổi chưa gửi lên máy chủ. Bấm “Đồng bộ ngay” ở trang Cá nhân trước, nếu không các thay đổi đó sẽ mất.
            </p>
          )}
          <TypedConfirm
            label="Xóa dữ liệu trên máy này"
            icon={Trash2}
            busy={busy}
            onConfirm={async () => {
              setBusy(true)
              await wipeThisDevice()
            }}
          />
        </>
      )}
    </div>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <p className="text-[0.9375rem] font-medium">Xóa tài khoản</p>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
        Xóa tài khoản và mọi dữ liệu trên máy chủ: từ vựng, lịch ôn, lịch sử học, bản ghi âm, nhắc nhở. Các máy khác bị đăng xuất. Dữ liệu trên máy này vẫn giữ (dùng tiếp không cần
        tài khoản); muốn xóa nốt thì dùng nút ở trên.
      </p>
      {!open ? (
        <Button icon={UserX} className="mt-3 w-full" onClick={() => setOpen(true)}>
          Xóa tài khoản
        </Button>
      ) : (
        <>
          <TypedConfirm
            label="Xóa tài khoản và dữ liệu trên máy chủ"
            icon={UserX}
            busy={busy}
            onConfirm={async () => {
              setBusy(true)
              setError(null)
              const message = await deleteAccount()
              setBusy(false)
              if (message) setError(message)
              else showToast('Đã xóa tài khoản. Dữ liệu trên máy này vẫn còn.')
            }}
          />
          {error && <p className="mt-2 text-[0.8125rem] leading-snug text-danger">{error}</p>}
        </>
      )}
    </div>
  )
}
