import { motion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { activeSlot, fillSlots, hintLetters, letterCount, slotTemplate, type Slot } from '../core/letters'

export type SlotsState = 'typing' | 'right' | 'wrong' | 'near'

/**
 * Ô chữ "Điền từ": mỗi chữ cái một gạch dưới, ô đang gõ được tô vàng.
 * Một ô nhập ẩn phủ lên trên để bàn phím điện thoại hoạt động bình thường.
 */
export function LetterSlots({
  term,
  value,
  onChange,
  onEnter,
  hints = 0,
  state = 'typing',
}: {
  term: string
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  hints?: number
  state?: SlotsState
}) {
  const template = useMemo(() => slotTemplate(term), [term])
  const prefix = hintLetters(template, hints)
  const filled = fillSlots(template, prefix + value)
  const active = state === 'typing' ? activeSlot(template, prefix + value) : -1
  const total = letterCount(template)
  const small = total > 14
  const localRef = useRef<HTMLInputElement | null>(null)
  // Tự bật bàn phím khi bài hiện ra.
  useEffect(() => {
    const t = setTimeout(() => localRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])
  // Thứ tự chữ cái của từng ô (để tô xám các chữ được gợi ý).
  const ordinal = useMemo(() => {
    let n = 0
    return template.map((s) => (s.kind === 'letter' ? n++ : -1))
  }, [template])

  // Tách theo từ để xuống dòng không cắt đôi một từ.
  const words: { slot: Slot; index: number }[][] = [[]]
  template.forEach((slot, index) => {
    if (slot.kind === 'fixed' && slot.char === ' ') words.push([])
    else words[words.length - 1].push({ slot, index })
  })

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
          <div key={wi} className={`flex ${small ? 'gap-1' : 'gap-1.5'}`}>
            {w.map(({ slot, index }) =>
              slot.kind === 'fixed' ? (
                <span key={index} className={`${small ? 'text-[20px]' : 'text-[24px]'} font-bold text-muted`}>
                  {slot.char}
                </span>
              ) : (
                <span key={index} className={`relative flex ${small ? 'h-8 w-[18px]' : 'h-9 w-[22px]'} items-end justify-center`}>
                  <motion.span
                    key={filled[index] ?? 'empty'}
                    initial={filled[index] ? { y: -6, opacity: 0 } : false}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className={`${small ? 'text-[20px]' : 'text-[24px]'} leading-none font-bold ${ordinal[index] < prefix.length ? 'text-subtle' : 'text-text'}`}
                  >
                    {filled[index] ?? ''}
                  </motion.span>
                  <span className={`absolute -bottom-1 left-0 h-[3px] w-full rounded-full ${index === active ? 'animate-pulse bg-sun' : 'bg-line'}`} />
                </span>
              ),
            )}
          </div>
        ))}
      </div>
      <input
        ref={localRef}
        value={value}
        readOnly={state !== 'typing'}
        onChange={(e) => {
          const letters = [...e.target.value].filter((c) => /[\p{L}\p{N}\s'’-]/u.test(c)).join('')
          if ([...letters].filter((c) => /[\p{L}\p{N}]/u.test(c)).length + prefix.length <= total + 3) onChange(letters)
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
        className="absolute inset-0 h-full w-full cursor-text rounded-3xl bg-transparent text-[16px] text-transparent caret-transparent opacity-0 outline-none"
      />
    </motion.div>
  )
}
