import { KeyRound, LinkIcon, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, EmptyState, FormMessage, Page, TextField } from '../components/ui'
import { updatePassword, useAuth } from '../services/auth'

const MIN_LENGTH = 8

/** Mở từ link "đặt lại mật khẩu" trong email (R1.3). */
export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [busy, setBusy] = useState(false)

  if (auth.status === 'loading') {
    return (
      <Page title="Đặt mật khẩu mới">
        <div className="flex justify-center py-10 text-muted">
          <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="flex">
            <LoaderCircle aria-label="Đang tải" className="h-7 w-7" />
          </motion.span>
        </div>
      </Page>
    )
  }

  if (auth.status !== 'signed_in') {
    return (
      <Page title="Đặt mật khẩu mới">
        <EmptyState icon={LinkIcon} title="Link không còn hiệu lực" body="Link đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Hãy gửi lại link mới.">
          <Button variant="primary" onClick={() => navigate('/login')}>
            Gửi lại link
          </Button>
        </EmptyState>
      </Page>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (password.length < MIN_LENGTH) next.password = `Mật khẩu cần ít nhất ${MIN_LENGTH} ký tự.`
    else if (confirm !== password) next.confirm = 'Hai mật khẩu chưa khớp nhau.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    setMessage(null)
    const error = await updatePassword(password)
    setBusy(false)
    if (error) {
      setMessage({ tone: 'error', text: error })
      setShakeKey((k) => k + 1)
      return
    }
    setMessage({ tone: 'success', text: 'Đã đổi mật khẩu.' })
    setTimeout(() => navigate('/me', { replace: true }), 900)
  }

  return (
    <Page title="Đặt mật khẩu mới" subtitle={auth.email}>
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value)
              setErrors({})
            }}
          />
          <TextField
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            value={confirm}
            error={errors.confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setErrors({})
            }}
          />
          <FormMessage message={message} shakeKey={shakeKey} />
          <Button type="submit" variant="primary" icon={KeyRound} disabled={busy} className="mt-1 w-full disabled:opacity-70">
            {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
          </Button>
        </form>
      </Card>
    </Page>
  )
}
