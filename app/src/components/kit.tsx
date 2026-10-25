import { ArrowLeft, Snail, Volume2, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useSyncExternalStore, type ReactNode, type SelectHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import type { MemoryLevel } from '../core/levels'
import { duration, ease, spring, tapScale } from '../lib/motion'
import { useSettings } from '../lib/settings'
import { getToast, subscribeToast } from '../lib/toast'
import { speak, speechAvailable, useSpeaking } from '../services/speech'

/** Nút quay lại: về trang trước, hoặc về `fallback` nếu mở thẳng từ link. */
export function BackButton({ fallback, label = 'Quay lại' }: { fallback: string; label?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <motion.button
      type="button"
      whileTap={tapScale}
      onClick={() => (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1))}
      className="-ml-2 inline-flex h-10 items-center gap-1 rounded-xl px-2 text-[0.9375rem] font-semibold whitespace-nowrap text-accent"
    >
      <ArrowLeft aria-hidden className="h-5 w-5" />
      {label}
    </motion.button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  tone = 'muted',
  className = '',
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  active?: boolean
  tone?: 'muted' | 'accent' | 'warning' | 'danger'
  className?: string
}) {
  const color = active ? { muted: 'text-text', accent: 'text-accent', warning: 'text-warning', danger: 'text-danger' }[tone] : 'text-muted'
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 ${color} ${className}`}
    >
      <Icon aria-hidden className="h-5 w-5" fill={active && tone === 'warning' ? 'currentColor' : 'none'} strokeWidth={2} />
    </motion.button>
  )
}

/** Thanh chọn 2–3 mục, ô chọn trượt theo. */
export function Segmented<T extends string>({ value, options, onChange, layoutId }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; layoutId: string }) {
  return (
    <div role="tablist" className="flex rounded-2xl bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${active ? 'text-text' : 'text-muted'}`}
          >
            {active && <motion.span layoutId={layoutId} transition={spring.snappy} className="absolute inset-0 rounded-xl bg-surface shadow-sm" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors ${
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted'
      }`}
    >
      {children}
    </motion.button>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' | 'danger' }) {
  const cls = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
  }[tone]
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${cls}`}>{children}</span>
}

/** 5 chấm cấp ghi nhớ (R5.9). */
export function LevelDots({ level, size = 'sm' }: { level: MemoryLevel; size?: 'sm' | 'md' }) {
  const d = size === 'md' ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Cấp ghi nhớ ${level} trên 5`}>
      {[1, 2, 3, 4, 5].map((k) => (
        <motion.span
          key={k}
          initial={false}
          animate={{ scale: k <= level ? 1 : 0.85 }}
          className={`${d} rounded-full transition-colors ${k <= level ? 'bg-accent' : 'bg-line'}`}
        />
      ))}
    </span>
  )
}

export function Select({ label, children, ...rest }: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select
        className="h-12 w-full appearance-none rounded-2xl border border-line bg-surface px-4 text-[0.9375rem] outline-none focus:border-accent"
        {...rest}
      >
        {children}
      </select>
    </label>
  )
}

export function TextArea({ label, ...rest }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        rows={2}
        className="w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] leading-relaxed outline-none placeholder:text-subtle focus:border-accent"
        {...rest}
      />
    </label>
  )
}

/** Nút loa: đọc bình thường; nút ốc sên: đọc chậm (R7.6). */
export function SpeakButtons({ text, size = 'md', slow = true }: { text: string; size?: 'sm' | 'md'; slow?: boolean }) {
  const { accent } = useSettings()
  const speaking = useSpeaking() === text
  if (!speechAvailable()) return null
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <motion.button
        type="button"
        whileTap={{ scale: 0.86 }}
        aria-label="Nghe phát âm"
        onClick={(e) => {
          e.stopPropagation()
          void speak(text, { accent })
        }}
        className={`relative flex ${box} items-center justify-center rounded-full bg-accent-soft text-accent`}
      >
        {speaking && (
          <motion.span
            className="absolute inset-0 rounded-full bg-accent"
            initial={{ opacity: 0.35, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        )}
        <Volume2 aria-hidden className={`relative ${icon}`} />
      </motion.button>
      {slow && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.86 }}
          aria-label="Nghe chậm"
          onClick={(e) => {
            e.stopPropagation()
            void speak(text, { accent, slow: true })
          }}
          className={`flex ${box} items-center justify-center rounded-full bg-surface-2 text-muted`}
        >
          <Snail aria-hidden className={icon} />
        </motion.button>
      )}
    </span>
  )
}

/** Phiên âm kèm nhãn giọng ("Mỹ", "Anh"); chạm để nghe. */
export function IpaPill({ label, ipa, onPlay }: { label: string; ipa: string; onPlay: () => void }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onPlay} className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="font-medium">{ipa}</span>
    </motion.button>
  )
}

// ---- Bảng trượt từ dưới lên (xác nhận, chọn hành động) ---------------------------------------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
          <motion.button
            type="button"
            aria-label="Đóng"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className="relative w-full max-w-lg rounded-t-[28px] bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
            {title && <h2 className="mb-2 text-[1.125rem] font-bold">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ---- Thông báo nhỏ ---------------------------------------------------------------------------

export function Toaster() {
  const t = useSyncExternalStore(subscribeToast, getToast)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <AnimatePresence>
        {t && (
          <motion.div
            key={t.id}
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="rounded-full bg-text px-4 py-2.5 text-sm font-medium text-bg shadow-lg"
          >
            {t.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
