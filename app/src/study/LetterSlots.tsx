import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { activeSlot, fillSlots, letterCount, lettersOnly, slotTemplate, type Slot } from '../core/letters'

export type SlotsState = 'typing' | 'right' | 'wrong' | 'near'

const SLOT_SIZES = {
  normal: { gap: 'gap-1.5', slot: 'h-9 w-[1.375rem]', text: 'text-[1.5rem]' },
  small: { gap: 'gap-1', slot: 'h-8 w-[1.125rem]', text: 'text-[1.25rem]' },
  tiny: { gap: 'gap-[0.1875rem]', slot: 'h-7 w-[0.9375rem]', text: 'text-[1.0625rem]' },
}

/** Gõ ra chữ có dấu tiếng Việt cho một từ tiếng Anh: nhắc chuyển bàn phím (Telex biến "ar" thành "ả", "dd" thành "đ"). */
export function KeyboardHint({ typed, term }: { typed: string; term: string }) {
  const termIsAscii = /^[\x20-\x7e’]*$/.test(term)
  const typedAccented = lettersOnly(typed).some((c) => c > '\x7f')
  if (!termIsAscii || !typedAccented) return null
  return (
    <p className="mt-3 text-center text-[0.8125rem] leading-snug text-warning">
      Bàn phím đang gõ tiếng Việt nên chữ bị thêm dấu. Bấm nút 🌐 trên bàn phím để chuyển sang tiếng Anh.
    </p>
  )
}

/**
 * Ô chữ "Điền từ": mỗi chữ cái một gạch dưới, ô đang gõ được tô vàng. Vài ô có chữ gợi ý hiện mờ
 * (vị trí ngẫu nhiên); người học vẫn gõ đủ mọi chữ, chữ gõ vào thay chỗ chữ mờ.
 * Một ô nhập ẩn phủ lên trên để bàn phím điện thoại hoạt động bình thường.
 */
export function LetterSlots({
  term,
  value,
  onChange,
  onEnter,
  revealed,
  state = 'typing',
}: {
  term: string
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  revealed: ReadonlySet<number>
  state?: SlotsState
}) {
  const template = useMemo(() => slotTemplate(term), [term])
  const filled = fillSlots(template, value)
  const active = state === 'typing' ? activeSlot(template, value) : -1
  const total = letterCount(template)
  const extra = lettersOnly(value).slice(total)
  const localRef = useRef<HTMLInputElement | null>(null)

  // Đã điền đủ ô mà gõ thêm: không nhận chữ thừa, ô chữ cuối rung lên và gạch dưới nháy đỏ.
  const lastLetter = useMemo(() => template.reduce((last, s, i) => (s.kind === 'letter' ? i : last), -1), [template])
  const lastRef = useRef<HTMLSpanElement | null>(null)
  const [overflow, setOverflow] = useState(false)
  const overflowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(overflowTimer.current), [])
  function nudgeFull() {
    lastRef.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
      { duration: 320, easing: 'ease-out' },
    )
    navigator.vibrate?.(30)
    setOverflow(true)
    clearTimeout(overflowTimer.current)
    overflowTimer.current = setTimeout(() => setOverflow(false), 400)
  }

  // Tự bật bàn phím khi bài hiện ra.
  useEffect(() => {
    const t = setTimeout(() => localRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  // Tách theo từ để xuống dòng không cắt đôi một từ.
  const words: { slot: Slot; index: number }[][] = [[]]
  template.forEach((slot, index) => {
    if (slot.kind === 'fixed' && slot.char === ' ') words.push([])
    else words[words.length - 1].push({ slot, index })
  })

  // Cỡ ô theo từ dài nhất (một từ không được xuống dòng giữa chừng): "responsibility" 14 chữ vẫn vừa khung điện thoại.
  // Kích thước tính bằng rem nên theo cỡ chữ đã chọn; quá chật (cỡ chữ rất lớn) thì xuống dòng thay vì tràn khung.
  const longest = Math.max(...words.map((w) => w.filter((x) => x.slot.kind === 'letter').length))
  const size = SLOT_SIZES[longest > 10 || total > 22 ? 'tiny' : longest > 8 || total > 14 ? 'small' : 'normal']

  const border = state === 'right' ? 'border-accent' : state === 'wrong' ? 'border-danger' : state === 'near' ? 'border-sun' : 'border-line'

  return (
    <motion.div
      animate={state === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : {}}
      transition={{ duration: 0.35 }}
      className={`relative mx-auto w-full rounded-3xl border-2 bg-surface px-4 py-6 transition-colors ${border}`}
      onClick={() => localRef.current?.focus()}
    >
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-4" aria-hidden>
        {words.map((w, wi) => (
          <div key={wi} className={`flex flex-wrap justify-center gap-y-4 ${size.gap}`}>
            {w.map(({ slot, index }) =>
              slot.kind === 'fixed' ? (
                <span key={index} className={`${size.text} font-bold text-muted`}>
                  {slot.char}
                </span>
              ) : (
                <span key={index} ref={index === lastLetter ? lastRef : undefined} className={`relative flex ${size.slot} items-end justify-center`}>
                  {filled[index] ? (
                    <motion.span
                      key={`typed-${filled[index]}`}
                      initial={{ y: -6, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.12 }}
                      className={`${size.text} leading-none font-bold text-text`}
                    >
                      {filled[index]}
                    </motion.span>
                  ) : revealed.has(index) && state === 'typing' ? (
                    <motion.span
                      key="hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.35 }}
                      transition={{ duration: 0.2 }}
                      className={`${size.text} leading-none font-semibold text-muted`}
                    >
                      {slot.char}
                    </motion.span>
                  ) : null}
                  <span
                    className={`absolute -bottom-1 left-0 h-[3px] w-full rounded-full transition-colors ${
                      overflow && index === lastLetter ? 'bg-danger' : index === active ? 'animate-pulse bg-sun' : 'bg-line'
                    }`}
                  />
                </span>
              ),
            )}
          </div>
        ))}
      </div>
      {extra.length > 0 && state === 'typing' && (
        <p className="mt-4 text-center text-[0.8125rem] text-danger">
          Thừa {extra.length} chữ: <span className="font-semibold">{extra.join('')}</span>
        </p>
      )}
      <KeyboardHint typed={value} term={term} />
      <input
        ref={localRef}
        value={value}
        readOnly={state !== 'typing'}
        onChange={(e) => {
          // Không "giành" nội dung với bàn phím: giữ cả dấu thanh rời (bộ gõ Telex dùng khi ghép chữ),
          // luôn nhận thao tác xóa, và để giới hạn rộng vì Telex có thể tách "ả" thành "ar" khi xóa.
          const next = [...e.target.value].filter((c) => /[\p{L}\p{M}\p{N}\s'’-]/u.test(c)).join('')
          const count = lettersOnly(next).length
          const inputType = (e.nativeEvent as InputEvent).inputType ?? ''
          // Xóa luôn được nhận (kể cả khi bộ gõ tách dấu làm số chữ tạm tăng); thêm chữ khi đã đủ ô thì rung.
          if (inputType.startsWith('delete') || count <= total || count < lettersOnly(value).length) onChange(next)
          else nudgeFull()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter()
          }
        }}
        aria-label="Câu trả lời"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        className="absolute inset-0 h-full w-full cursor-text rounded-3xl bg-transparent text-[1rem] text-transparent caret-transparent opacity-0 outline-none"
      />
    </motion.div>
  )
}
