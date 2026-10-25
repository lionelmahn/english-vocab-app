import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { duration, ease, riseIn, stagger, tapScale } from '../lib/motion'

/** Khung màn hình: tiêu đề + nội dung xuất hiện lần lượt. */
export function Page({
  title,
  subtitle,
  action,
  back,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: ReactNode
  children: ReactNode
}) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-6">
      {back && (
        <motion.div variants={riseIn} className="-mt-2 mb-1">
          {back}
        </motion.div>
      )}
      <motion.header variants={riseIn} className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.625rem] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </motion.header>
      <div className="flex flex-col gap-3">{children}</div>
    </motion.div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.section variants={riseIn} className={`rounded-3xl border border-line bg-surface p-4 ${className}`}>
      {children}
    </motion.section>
  )
}

export function SectionTitle({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-[0.9375rem] font-semibold ${className}`}>{children}</h2>
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** Nút "nổi": có đáy màu đậm hơn, nhấn thì lún xuống. */
const PRESS = 'transition-[transform,box-shadow] duration-100 active:translate-y-[3px]'
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: `bg-accent text-on-accent shadow-[0_4px_0_0_var(--app-accent-shadow)] active:shadow-[0_1px_0_0_var(--app-accent-shadow)] ${PRESS}`,
  secondary: `border-2 border-line bg-surface text-text shadow-[0_4px_0_0_var(--app-line-shadow)] active:shadow-[0_1px_0_0_var(--app-line-shadow)] ${PRESS}`,
  ghost: 'text-accent',
  danger: `bg-danger text-on-danger shadow-[0_4px_0_0_var(--app-danger-shadow)] active:shadow-[0_1px_0_0_var(--app-danger-shadow)] ${PRESS}`,
}
const DISABLED =
  'disabled:border-transparent disabled:bg-surface-2 disabled:text-subtle disabled:shadow-[0_4px_0_0_var(--app-line-shadow)] disabled:active:translate-y-0'

export function Button({
  variant = 'secondary',
  icon: Icon,
  children,
  className = '',
  ...rest
}: { variant?: ButtonVariant; icon?: LucideIcon; children: ReactNode } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      whileTap={variant === 'ghost' ? tapScale : undefined}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[0.9375rem] font-bold whitespace-nowrap ${BUTTON_STYLES[variant]} ${variant === 'ghost' ? '' : DISABLED} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden className="h-5 w-5" strokeWidth={2.4} />}
      {children}
    </motion.button>
  )
}

/** Nhãn cho tính năng chưa làm, kèm giai đoạn sẽ có. */
export function PhaseBadge({ phase }: { phase: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-warning-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-warning">
      Giai đoạn {phase}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-9 text-center">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-accent-soft"
      >
        <Icon aria-hidden className="h-8 w-8 text-accent" strokeWidth={1.9} />
      </motion.div>
      <p className="text-[1.0625rem] font-semibold">{title}</p>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{body}</p>
      {children && <div className="mt-5 flex w-full flex-col gap-2.5">{children}</div>}
    </Card>
  )
}

export function TextField({
  label,
  error,
  trailing,
  ref,
  ...input
}: { label: string; error?: string | null; trailing?: ReactNode; ref?: Ref<HTMLInputElement> } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span
        className={`flex h-12 items-center gap-2 rounded-2xl border bg-surface px-4 transition-colors focus-within:border-accent ${error ? 'border-danger' : 'border-line'}`}
      >
        <input
          ref={ref}
          className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          aria-invalid={error ? true : undefined}
          {...input}
        />
        {trailing}
      </span>
      {error && <span className="mt-1.5 block text-[0.8125rem] text-danger">{error}</span>}
    </label>
  )
}

/** Thông báo dưới form. Đổi `shakeKey` để rung khi gặp lỗi mới. */
export function FormMessage({ message, shakeKey = 0 }: { message: { tone: 'error' | 'success'; text: string } | null; shakeKey?: number }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={`${message.tone}-${shakeKey}`}
          initial={{ opacity: 0, y: 6 }}
          animate={message.tone === 'error' ? { opacity: 1, y: 0, x: [0, -7, 7, -4, 4, 0] } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.base * 1.5, ease: ease.out }}
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            message.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-strong'
          }`}
        >
          {message.tone === 'error' ? (
            <CircleAlert aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          )}
          <span>{message.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full p-[3px] transition-colors ${checked ? 'bg-accent' : 'bg-surface-2'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className={`block h-6 w-6 rounded-full bg-white shadow-sm ${checked ? 'ml-auto' : ''}`}
      />
    </button>
  )
}
