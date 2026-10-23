import { ArrowLeft, CloudOff, Eye, EyeOff, LoaderCircle, LogIn, Mail } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, EmptyState, FormMessage, Page, TextField } from '../components/ui'
import { riseIn } from '../lib/motion'
import { sendPasswordReset, signIn, useAuth } from '../services/auth'

type Mode = 'signin' | 'reset'
type Message = { tone: 'error' | 'success'; text: string } | null

const EMAIL_RE = /^\S+@\S+\.\S+$/

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [message, setMessage] = useState<Message>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (auth.status === 'signed_in') navigate('/me', { replace: true })
  }, [auth.status, navigate])

  const back = (
    <Button variant="ghost" icon={ArrowLeft} className="-ml-3 h-10 px-3" onClick={() => navigate('/me')}>
      Quay lại
    </Button>
  )

  if (auth.status === 'disabled') {
    return (
      <Page title="Đăng nhập" action={back}>
        <EmptyState icon={CloudOff} title="App chưa kết nối máy chủ" body="Cần cấu hình Supabase trước khi đăng nhập. Xem hướng dẫn phát hành, mục 5." />
      </Page>
    )
  }

  function switchMode(next: Mode) {
    setMode(next)
    setErrors({})
    setMessage(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) nextErrors.email = 'Nhập một địa chỉ email hợp lệ.'
    if (mode === 'signin' && !password) nextErrors.password = 'Nhập mật khẩu.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setMessage(null)
    const error = mode === 'signin' ? await signIn(email, password) : await sendPasswordReset(email)
    setBusy(false)
    if (error) {
      setMessage({ tone: 'error', text: error })
      setShakeKey((k) => k + 1)
      return
    }
    if (mode === 'reset') {
      setMessage({ tone: 'success', text: 'Đã gửi email. Mở link trong email để đặt mật khẩu mới (kiểm tra cả thư mục Spam).' })
    }
    // Đăng nhập thành công: useEffect ở trên chuyển về trang Cá nhân.
  }

  return (
    <Page title={mode === 'signin' ? 'Đăng nhập' : 'Quên mật khẩu'} subtitle={mode === 'signin' ? 'Để sao lưu và đồng bộ giữa các thiết bị' : 'Nhận link đặt lại mật khẩu qua email'} action={back}>
      <Card>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="ban@example.com"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErrors((x) => ({ ...x, email: undefined }))
            }}
          />
          {mode === 'signin' && (
            <TextField
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              error={errors.password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors((x) => ({ ...x, password: undefined }))
              }}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="-mr-1 flex h-9 w-9 items-center justify-center rounded-xl text-subtle"
                >
                  {showPassword ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
                </button>
              }
            />
          )}

          <FormMessage message={message} shakeKey={shakeKey} />

          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="mt-1 w-full disabled:opacity-70"
            icon={busy ? undefined : mode === 'signin' ? LogIn : Mail}
          >
            {busy && (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} className="flex">
                <LoaderCircle aria-hidden className="h-5 w-5" />
              </motion.span>
            )}
            {mode === 'signin' ? 'Đăng nhập' : 'Gửi link đặt lại mật khẩu'}
          </Button>
        </form>
      </Card>

      <motion.div variants={riseIn} className="flex justify-center">
        <Button variant="ghost" onClick={() => switchMode(mode === 'signin' ? 'reset' : 'signin')}>
          {mode === 'signin' ? 'Quên mật khẩu?' : 'Quay lại đăng nhập'}
        </Button>
      </motion.div>

      <motion.p variants={riseIn} className="px-2 text-center text-xs leading-relaxed text-subtle">
        Bản cá nhân không có trang đăng ký. Tài khoản được tạo sẵn trong Supabase.
      </motion.p>
    </Page>
  )
}
