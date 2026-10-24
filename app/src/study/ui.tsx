import { Check, ChevronDown, Languages, Snail, Volume2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Buddy } from '../components/Buddy'
import { POS_SHORT } from '../core/pos'
import { findTermSpan } from '../core/vocab'
import type { VocabItem } from '../db/types'
import { formatDueIn } from '../lib/format'
import { useSettings } from '../lib/settings'
import { speak, useSpeaking } from '../services/speech'

/** Các mảnh giao diện dùng chung trong buổi học/ôn. */

// ---- Thanh tiến độ có nhân vật chạy theo ------------------------------------------------------

export function StudyProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="relative h-4 flex-1 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#f6c344] to-[var(--app-sun)]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 110, damping: 20 }}
      />
      <motion.div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" initial={false} animate={{ left: `${Math.max(pct, 3)}%` }} transition={{ type: 'spring', stiffness: 110, damping: 20 }}>
        <Buddy mood="happy" size={38} />
      </motion.div>
    </div>
  )
}

// ---- Nút loa tròn nổi -----------------------------------------------------------------------

export function RoundSpeak({ text, slow = false, size = 'md' }: { text: string; slow?: boolean; size?: 'md' | 'lg' }) {
  const { accent } = useSettings()
  const speaking = useSpeaking() === text
  const box = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16'
  const icon = size === 'lg' ? 'h-11 w-11' : 'h-7 w-7'
  const Icon = slow ? Snail : Volume2
  return (
    <button
      type="button"
      aria-label={slow ? 'Nghe chậm' : 'Nghe phát âm'}
      onClick={(e) => {
        e.stopPropagation()
        void speak(text, { accent, slow })
      }}
      className={`relative flex ${box} shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface shadow-[0_5px_0_0_var(--app-line-shadow)] transition-[transform,box-shadow] duration-100 active:translate-y-[4px] active:shadow-[0_1px_0_0_var(--app-line-shadow)]`}
    >
      {speaking && (
        <motion.span
          className="absolute inset-0 rounded-full bg-sun"
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
      <Icon aria-hidden className={`relative ${icon} ${slow ? 'text-[#c47a3a]' : 'text-sun'}`} strokeWidth={2.4} />
    </button>
  )
}

// ---- Câu ví dụ có gạch chân hoặc che từ -------------------------------------------------------

export function Sentence({ text, term, mode }: { text: string; term: string; mode: 'underline' | 'blank' }) {
  const hit = findTermSpan(text, term)
  if (!hit) return <>{text}</>
  return (
    <>
      {text.slice(0, hit.start)}
      {mode === 'underline' ? (
        <b className="font-extrabold underline decoration-2 underline-offset-4">{text.slice(hit.start, hit.end)}</b>
      ) : (
        <span className="mx-1 inline-block w-24 border-b-2 border-text align-baseline" aria-label="chỗ trống" />
      )}
      {text.slice(hit.end)}
    </>
  )
}

// ---- Phương án chọn ------------------------------------------------------------------------

export type ChoiceState = 'idle' | 'selected' | 'right' | 'wrong' | 'dim'

export function ChoiceCard({ state, onClick, children, label }: { state: ChoiceState; onClick: () => void; children: ReactNode; label?: string }) {
  const cls = {
    idle: 'border-line bg-surface shadow-[0_4px_0_0_var(--app-line-shadow)]',
    selected: 'border-sun bg-sun-soft shadow-[0_4px_0_0_var(--app-sun-shadow)]',
    right: 'border-accent bg-accent text-on-accent shadow-[0_4px_0_0_var(--app-accent-shadow)]',
    wrong: 'border-danger bg-danger text-on-danger shadow-[0_4px_0_0_var(--app-danger-shadow)]',
    dim: 'border-line bg-surface opacity-50 shadow-[0_4px_0_0_var(--app-line-shadow)]',
  }[state]
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={state === 'selected'}
      onClick={onClick}
      animate={state === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : state === 'right' ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.35 }}
      className={`flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-center text-[17px] font-semibold transition-[transform,box-shadow,background-color] duration-100 active:translate-y-[3px] ${cls}`}
    >
      {children}
    </motion.button>
  )
}

// ---- Nút chính hình viên thuốc và liên kết phụ -------------------------------------------------

export function PillButton({ children, disabled, onClick, type = 'button' }: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="h-14 w-full max-w-sm rounded-full bg-accent text-[18px] font-bold text-on-accent shadow-[0_5px_0_0_var(--app-accent-shadow)] transition-[transform,box-shadow] duration-100 active:translate-y-[4px] active:shadow-[0_1px_0_0_var(--app-accent-shadow)] disabled:bg-surface-2 disabled:text-subtle disabled:shadow-[0_5px_0_0_var(--app-line-shadow)] disabled:active:translate-y-0"
    >
      {children}
    </button>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="py-1.5 text-[15px] font-semibold text-muted underline decoration-1 underline-offset-4">
      {children}
    </button>
  )
}

/** Khung một bước: tiêu đề nhỏ, nội dung, chân trang cố định phía dưới. */
export function StepFrame({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <p className="pt-2 text-center text-[17px] font-semibold text-muted">{title}</p>
      <div className="flex flex-1 flex-col gap-5 pt-5">{children}</div>
      <div className="sticky bottom-0 flex flex-col items-center gap-2 bg-bg pt-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">{footer}</div>
    </div>
  )
}

// ---- Bảng kết quả trượt lên (R6.7) --------------------------------------------------------------

export type SheetTone = 'correct' | 'wrong' | 'near'

export function FeedbackSheet({
  tone,
  item,
  title,
  note,
  nextDue,
  actions,
}: {
  tone: SheetTone
  item: VocabItem
  title?: string
  note?: ReactNode
  nextDue?: number | null
  actions: ReactNode
}) {
  const { showTranslations, accent } = useSettings()
  const [collapsed, setCollapsed] = useState(false)
  const [showVi, setShowVi] = useState(showTranslations)
  const [shownAt] = useState(() => Date.now())
  const ex = item.examples[0]
  const ipa = accent === 'uk' ? (item.ipaUk ?? item.ipaUs) : (item.ipaUs ?? item.ipaUk)
  const colors = tone === 'correct' ? 'bg-accent text-on-accent' : tone === 'wrong' ? 'bg-danger text-on-danger' : 'bg-sun text-[#3a2a10]'
  const roundBtn = tone === 'correct' ? 'bg-accent-shadow/40' : tone === 'wrong' ? 'bg-danger-shadow/40' : 'bg-sun-shadow/40'

  // Gắn vào body: khung màn hình đang có hiệu ứng trượt (transform) làm lệch vị trí "fixed".
  return createPortal(
    <motion.div
      role="status"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg"
    >
      <div className="absolute -top-[66px] left-5">
        <Buddy mood={tone === 'wrong' ? 'sad' : 'cheer'} size={74} />
      </div>
      <div className={`relative rounded-t-[30px] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] ${colors}`}>
        <button
          type="button"
          aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
          onClick={() => setCollapsed((c) => !c)}
          className={`absolute -top-6 right-5 flex h-12 w-12 items-center justify-center rounded-full ${colors} shadow-[0_4px_0_0_rgba(0,0,0,0.15)]`}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} className="flex">
            <ChevronDown aria-hidden className="h-6 w-6" strokeWidth={3} />
          </motion.span>
        </button>

        <div className="flex items-start gap-4">
          <button
            type="button"
            aria-label="Nghe phát âm"
            onClick={() => void speak(item.term, { accent })}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_4px_0_0_rgba(0,0,0,0.15)] active:translate-y-[3px]"
          >
            <Volume2 aria-hidden className="h-7 w-7 text-sun" strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            {title && (
              <p className="mb-0.5 flex items-center gap-1.5 text-[15px] font-bold opacity-90">
                {tone === 'correct' ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : tone === 'wrong' ? <X aria-hidden className="h-4 w-4" strokeWidth={3} /> : null}
                {title}
              </p>
            )}
            <p className="text-[26px] leading-tight font-extrabold break-words">
              {item.term} {POS_SHORT[item.partOfSpeech] && <span className="text-[17px] font-semibold opacity-85">({POS_SHORT[item.partOfSpeech]})</span>}
            </p>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {ipa && <p className="mt-1 text-[16px] opacity-90">{ipa}</p>}
                  <p className="mt-1 text-[17px] font-semibold">{item.meaningVi}</p>
                  {ex && (
                    <div className="mt-2.5 text-[16px] leading-relaxed">
                      <p>
                        {ex.en}{' '}
                        {ex.vi && (
                          <button type="button" aria-label={showVi ? 'Ẩn bản dịch' : 'Hiện bản dịch'} onClick={() => setShowVi((v) => !v)} className={`ml-1 inline-flex rounded-lg p-1 align-middle ${roundBtn}`}>
                            <Languages aria-hidden className="h-4 w-4" />
                          </button>
                        )}
                      </p>
                      {showVi && ex.vi && <p className="mt-1 opacity-85">{ex.vi}</p>}
                    </div>
                  )}
                  {note && <div className="mt-2.5 text-[15px] leading-relaxed">{note}</div>}
                  {nextDue != null && <p className="mt-2 text-[13px] font-semibold opacity-80">Ôn lại sau: {formatDueIn(nextDue, shownAt).replace(' nữa', '')}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="mt-5 flex flex-col items-center gap-2">{actions}</div>
      </div>
    </motion.div>,
    document.body,
  )
}

/** Nút trắng trên bảng kết quả. */
export function SheetButton({ children, onClick, subtle = false }: { children: ReactNode; onClick: () => void; subtle?: boolean }) {
  return subtle ? (
    <button type="button" onClick={onClick} className="py-1 text-[15px] font-bold underline decoration-1 underline-offset-4 opacity-90">
      {children}
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="h-14 w-full max-w-sm rounded-full bg-white text-[18px] font-bold text-[#18201c] shadow-[0_5px_0_0_rgba(0,0,0,0.18)] transition-[transform,box-shadow] duration-100 active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.18)]"
    >
      {children}
    </button>
  )
}
