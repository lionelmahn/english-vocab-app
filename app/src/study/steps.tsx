import { Lightbulb, Pointer, Volume2 } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { checkAnswer } from '../core/answers'
import type { ChoiceSource, TermSource } from '../core/exercises'
import type { AttemptResult, ExerciseKind } from '../core/grading'
import { composeAnswer, letterCount, nextHintSlot, pickReveals, scaffoldCount, slotTemplate } from '../core/letters'
import { POS_SHORT } from '../core/pos'
import { contextSentence } from '../core/vocab'
import type { CardStateRow, VocabItem } from '../db/types'
import { formatDueIn } from '../lib/format'
import { useSettings } from '../lib/settings'
import { playCorrect, playWrong } from '../lib/sfx'
import { speak } from '../services/speech'
import { KeyboardHint, LetterSlots, type SlotsState } from './LetterSlots'
import { ChoiceCard, FeedbackSheet, PillButton, RoundMic, RoundSpeak, Sentence, SheetButton, StepFrame, TextLink, type ChoiceState, type SheetTone } from './ui'
import { Sheet } from '../components/kit'
import { SpeakPractice } from '../components/SpeakPractice'

/** Kết quả trả về sau khi ghi một lượt: lịch ôn mới (nếu có) để hiện "ôn lại sau…" (R5.11). */
export interface AnswerOutcome {
  card: CardStateRow | null
}
export type AnswerFn = (result: AttemptResult) => Promise<AnswerOutcome>

interface Shown {
  tone: SheetTone
  title: string
  card: CardStateRow | null
  note?: ReactNode
}

function useAutoPlay(text: string, enabled = true) {
  const { autoPlay, accent } = useSettings()
  useEffect(() => {
    if (!enabled || !autoPlay) return
    const t = setTimeout(() => void speak(text, { accent }), 300)
    return () => clearTimeout(t)
  }, [text, enabled, autoPlay, accent])
}

/** Enter: kiểm tra, hoặc đi tiếp khi đã có kết quả. Bỏ qua khi đang gõ trong ô nhập (ô nhập tự xử lý). */
function useEnter(handler: () => void) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement)?.tagName === 'INPUT') return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function TermLabel({ item }: { item: VocabItem }) {
  return (
    <>
      {item.meaningVi}
      {POS_SHORT[item.partOfSpeech] && <span className="font-semibold text-muted"> ({POS_SHORT[item.partOfSpeech]})</span>}
    </>
  )
}

// ---- Thẻ lật ---------------------------------------------------------------------------------

function FlipCard({
  flipped,
  front,
  back,
  onFlip,
  onSwipe,
  showTapHint,
}: {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  onFlip: () => void
  onSwipe?: (dir: -1 | 1) => void
  showTapHint?: boolean
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-9, 9])

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!onSwipe) return
    if (info.offset.x > 110 || info.velocity.x > 600) onSwipe(1)
    else if (info.offset.x < -110 || info.velocity.x < -600) onSwipe(-1)
  }

  const face =
    'absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto rounded-[30px] border-2 border-line bg-surface px-6 pt-12 pb-8 text-center shadow-[0_6px_0_0_var(--app-line-shadow)] [backface-visibility:hidden]'
  return (
    <motion.div
      style={{ x, rotate, perspective: 1400 }}
      drag={onSwipe ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      className="relative h-full min-h-[380px] w-full flex-1 cursor-pointer touch-pan-y select-none"
      onClick={onFlip}
    >
      <motion.div className="relative h-full min-h-[380px] w-full" style={{ transformStyle: 'preserve-3d' }} initial={false} animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: 'spring', stiffness: 240, damping: 26 }}>
        <div className={face}>
          {front}
          {showTapHint && (
            <motion.span
              aria-hidden
              className="absolute right-5 bottom-4 text-[#f08a8a]"
              animate={{ scale: [1, 0.86, 1], rotate: [0, -6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Pointer className="h-8 w-8" fill="#fde2e2" strokeWidth={1.8} />
            </motion.span>
          )}
        </div>
        <div className={face} style={{ transform: 'rotateY(180deg)' }}>
          {back}
        </div>
      </motion.div>
    </motion.div>
  )
}

function TermBack({ item }: { item: VocabItem }) {
  const { accent } = useSettings()
  const ipa = accent === 'uk' ? (item.ipaUk ?? item.ipaUs) : (item.ipaUs ?? item.ipaUk)
  return (
    <>
      <p className="text-[2rem] leading-tight font-extrabold break-words">{item.term}</p>
      {ipa && <p className="text-[1.125rem] text-muted">{ipa}</p>}
      <p className="mt-1 text-[1.375rem] leading-snug font-bold">
        <TermLabel item={item} />
      </p>
      {item.examples[0]?.vi && <p className="mt-2 text-[0.9375rem] text-muted italic">{item.examples[0].vi}</p>}
    </>
  )
}

// ---- Thẻ từ mới (R4.2, R4.3, R4.8) ------------------------------------------------------------

/**
 * Thẻ giới thiệu từ mới: luôn hiện tiếng Anh trước (câu ngữ cảnh có gạch chân từ, hoặc chính từ đó),
 * lật ra mới thấy nghĩa. Cài đặt "Mặt trước thẻ" chỉ áp dụng cho kiểu ôn bằng thẻ tự đánh giá.
 */
export function IntroStep({ item, onNext, onKnown }: { item: VocabItem; onNext: (dir: -1 | 1) => void; onKnown: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const [practice, setPractice] = useState(false)
  const sentence = contextSentence(item)
  useAutoPlay(item.term)
  useEnter(() => (practice ? undefined : flipped ? onNext(1) : setFlipped(true)))

  // Mặt trước: từ cần học in đậm ở trên, câu ví dụ (gạch chân từ) ngay bên dưới.
  const contextFront = (
    <>
      <p className="text-[2.125rem] leading-tight font-extrabold break-words">{item.term}</p>
      {sentence ? (
        <p className="mt-4 text-[1.25rem] leading-relaxed">
          <Sentence text={sentence} term={item.term} mode="underline" />
        </p>
      ) : (
        POS_SHORT[item.partOfSpeech] && <p className="text-[1rem] text-muted">({POS_SHORT[item.partOfSpeech]})</p>
      )}
    </>
  )
  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <div className="relative mt-12 flex flex-1 flex-col">
        <div className="absolute -top-8 left-1/2 z-10 flex -translate-x-1/2 gap-4">
          <RoundSpeak text={item.term} />
          <RoundSpeak text={item.term} slow />
          <RoundMic onClick={() => setPractice(true)} />
        </div>
        <FlipCard
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          onSwipe={flipped ? (dir) => onNext(dir) : undefined}
          showTapHint={!flipped}
          front={contextFront}
          back={<TermBack item={item} />}
        />
      </div>
      <div className="sticky bottom-0 flex flex-col items-center gap-2 bg-bg pt-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <PillButton disabled={!flipped} onClick={() => onNext(1)}>
          Tiếp tục
        </PillButton>
        <TextLink onClick={onKnown}>Mình đã biết từ này</TextLink>
      </div>
      <Sheet open={practice} onClose={() => setPractice(false)} title="Luyện đọc">
        {practice && <SpeakPractice text={item.term} />}
      </Sheet>
    </div>
  )
}

// ---- Khung chung cho bài có chấm điểm ---------------------------------------------------------

function useAnswer(onAnswer: AnswerFn) {
  const [shown, setShown] = useState<Shown | null>(null)
  const busy = useRef(false)
  const submit = useCallback(
    async (result: AttemptResult, tone: SheetTone, title: string, note?: ReactNode) => {
      if (busy.current) return
      busy.current = true
      if (tone === 'correct') playCorrect()
      else playWrong()
      const { card } = await onAnswer(result)
      setShown({ tone, title, card, note })
      busy.current = false
    },
    [onAnswer],
  )
  return { shown, submit }
}

const DONT_KNOW: AttemptResult = { kind: 'dont_know' }

function stateFor(id: string, targetId: string, selected: string | null, answered: boolean): ChoiceState {
  if (!answered) return selected === id ? 'selected' : 'idle'
  if (id === targetId) return 'right'
  return id === selected ? 'wrong' : 'dim'
}

// ---- Chọn nghĩa: trong câu (R6.1) hoặc nghe rồi chọn (R6.10) --------------------------------

export function MeaningChoiceStep({
  item,
  choices,
  listen,
  onAnswer,
  onContinue,
  onNoAudio,
}: {
  item: VocabItem
  choices: ChoiceSource[]
  listen: boolean
  onAnswer: AnswerFn
  onContinue: () => void
  onNoAudio?: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const { shown, submit } = useAnswer(onAnswer)
  const sentence = listen ? null : contextSentence(item)
  const exercise: ExerciseKind = listen ? 'listen_choose' : 'mcq_meaning'
  useAutoPlay(item.term, listen)

  function check() {
    if (!selected || shown) return
    const ok = selected === item.id
    void submit({ kind: 'answer', exercise, correct: ok }, ok ? 'correct' : 'wrong', ok ? 'Chính xác!' : 'Chưa đúng')
  }
  useEnter(() => (shown ? onContinue() : check()))

  return (
    <StepFrame
      title={listen ? 'Nghe và chọn đáp án đúng' : sentence ? 'Chọn nghĩa của từ được gạch chân' : 'Chọn nghĩa đúng'}
      footer={
        <>
          <PillButton disabled={!selected || !!shown} onClick={check}>
            Kiểm tra
          </PillButton>
          {!shown && <TextLink onClick={() => void submit(DONT_KNOW, 'wrong', 'Ghi nhớ lại nhé')}>Mình không thuộc từ này</TextLink>}
          {!shown && listen && onNoAudio && <TextLink onClick={onNoAudio}>Tạm thời không nghe được</TextLink>}
        </>
      }
    >
      {listen ? (
        <div className="flex justify-center py-4">
          <RoundSpeak text={item.term} size="lg" />
        </div>
      ) : sentence ? (
        <div className="rounded-3xl border-2 border-accent bg-surface px-5 py-5 text-center text-[1.3125rem] leading-relaxed">
          <Sentence text={sentence} term={item.term} mode="underline" />
        </div>
      ) : (
        <p className="py-4 text-center text-[2.125rem] leading-tight font-extrabold break-words">{item.term}</p>
      )}
      <div className="flex flex-col gap-3">
        {choices.map((c) => (
          <ChoiceCard key={c.id} state={stateFor(c.id, item.id, selected, !!shown)} onClick={() => !shown && setSelected(c.id)}>
            {c.meaningVi}
          </ChoiceCard>
        ))}
      </div>
      <AnimatePresence>
        {shown && (
          <FeedbackSheet key="sheet" tone={shown.tone} item={item} title={shown.title} nextDue={shown.card?.due} actions={<SheetButton onClick={onContinue}>Tiếp tục</SheetButton>} />
        )}
      </AnimatePresence>
    </StepFrame>
  )
}

// ---- Chọn âm thanh đúng theo nghĩa hoặc chỗ trống trong câu (R6.11) ---------------------------

export function AudioChoiceStep({
  item,
  choices,
  onAnswer,
  onContinue,
  onNoAudio,
}: {
  item: VocabItem
  choices: TermSource[]
  onAnswer: AnswerFn
  onContinue: () => void
  onNoAudio: () => void
}) {
  const { accent } = useSettings()
  const [selected, setSelected] = useState<string | null>(null)
  const { shown, submit } = useAnswer(onAnswer)
  const sentence = contextSentence(item)

  function check() {
    if (!selected || shown) return
    const ok = selected === item.id
    void submit({ kind: 'answer', exercise: 'audio_choice', correct: ok }, ok ? 'correct' : 'wrong', ok ? 'Chính xác!' : 'Chưa đúng')
  }
  useEnter(() => (shown ? onContinue() : check()))

  return (
    <StepFrame
      title="Nghe và chọn đáp án đúng"
      footer={
        <>
          <PillButton disabled={!selected || !!shown} onClick={check}>
            Kiểm tra
          </PillButton>
          {!shown && <TextLink onClick={() => void submit(DONT_KNOW, 'wrong', 'Ghi nhớ lại nhé')}>Mình không thuộc từ này</TextLink>}
          {!shown && <TextLink onClick={onNoAudio}>Tạm thời không nghe được</TextLink>}
        </>
      }
    >
      {sentence ? (
        <div className="rounded-3xl border-2 border-accent bg-surface px-5 py-5 text-center text-[1.3125rem] leading-relaxed">
          <Sentence text={sentence} term={item.term} mode="blank" />
        </div>
      ) : (
        <p className="py-4 text-center text-[1.625rem] leading-snug font-bold">
          <TermLabel item={item} />
        </p>
      )}
      <div className="flex flex-col gap-3">
        {choices.map((c) => {
          const state = stateFor(c.id, item.id, selected, !!shown)
          return (
            <ChoiceCard
              key={c.id}
              state={state}
              label={shown ? c.term : 'Nghe phương án'}
              onClick={() => {
                void speak(c.term, { accent })
                if (!shown) setSelected(c.id)
              }}
            >
              <Volume2 aria-hidden className={`h-7 w-7 ${state === 'selected' ? 'text-sun' : state === 'idle' || state === 'dim' ? 'text-muted' : ''}`} strokeWidth={2.4} />
              {shown && <span className="text-[1.0625rem] font-bold">{c.term}</span>}
            </ChoiceCard>
          )
        })}
      </div>
      <AnimatePresence>
        {shown && (
          <FeedbackSheet key="sheet" tone={shown.tone} item={item} title={shown.title} nextDue={shown.card?.due} actions={<SheetButton onClick={onContinue}>Tiếp tục</SheetButton>} />
        )}
      </AnimatePresence>
    </StepFrame>
  )
}

// ---- Chấm câu gõ tay (R6.7) -------------------------------------------------------------------

type TypedVerdict = 'correct' | 'near' | 'wrong'

function gradeTyped(item: VocabItem, candidates: string[]): TypedVerdict {
  const accepted = [item.term, ...item.acceptedAnswers]
  let best: TypedVerdict = 'wrong'
  for (const c of candidates) {
    const v = checkAnswer(c, accepted).verdict
    if (v === 'correct') return 'correct'
    if (v === 'near') best = 'near'
  }
  return best
}

/** Phần dùng chung của bài gõ: kiểm tra, gần đúng, sai, và bảng kết quả. */
function useTypedAnswer(item: VocabItem, exercise: ExerciseKind, onAnswer: AnswerFn, onContinue: () => void) {
  const { shown, submit } = useAnswer(onAnswer)
  const [near, setNear] = useState<string | null>(null)

  function check(candidates: string[], display: string, hintUsed: boolean) {
    if (shown || near) return
    const v = gradeTyped(item, candidates)
    if (v === 'correct') void submit({ kind: 'answer', exercise, correct: true, hintUsed }, 'correct', 'Chính xác!')
    else if (v === 'near') setNear(display)
    else
      void submit(
        { kind: 'answer', exercise, correct: false },
        'wrong',
        'Chưa đúng',
        display ? (
          <>
            Bạn gõ: <s>{display}</s>
          </>
        ) : undefined,
      )
  }

  const sheet = (
    <AnimatePresence>
      {near && !shown && (
        <FeedbackSheet
          key="near"
          tone="near"
          item={item}
          title="Gần đúng"
          note={
            <>
              Bạn gõ: <s>{near}</s>. Nếu chỉ là lỗi gõ, chọn “Tính là đúng” (được tính mức Khó).
            </>
          }
          actions={
            <>
              <SheetButton
                onClick={async () => {
                  await submit({ kind: 'answer', exercise, correct: true, nearMatchAccepted: true }, 'correct', 'Chính xác!')
                  onContinue()
                }}
              >
                Tính là đúng
              </SheetButton>
              <SheetButton
                subtle
                onClick={async () => {
                  await submit({ kind: 'answer', exercise, correct: false }, 'wrong', 'Chưa đúng')
                  onContinue()
                }}
              >
                Tính là sai
              </SheetButton>
            </>
          }
        />
      )}
      {shown && (
        <FeedbackSheet key="sheet" tone={shown.tone} item={item} title={shown.title} note={shown.note} nextDue={shown.card?.due} actions={<SheetButton onClick={onContinue}>Tiếp tục</SheetButton>} />
      )}
    </AnimatePresence>
  )
  const state: SlotsState = shown ? (shown.tone === 'correct' ? 'right' : 'wrong') : near ? 'near' : 'typing'
  return { check, sheet, state, shown, submit, done: !!shown || !!near }
}

// ---- Điền từ theo ô chữ (R6.2) và kiểm tra nhanh từ đã biết (R4.8) ----------------------------

export function SlotsStep({ item, knownCheck, onAnswer, onContinue }: { item: VocabItem; knownCheck: boolean; onAnswer: AnswerFn; onContinue: () => void }) {
  const [value, setValue] = useState('')
  const template = useMemo(() => slotTemplate(item.term), [item.term])
  const total = letterCount(template)
  // Vài chữ gợi ý mờ ở vị trí ngẫu nhiên, mỗi lần làm bài một kiểu (không tính là dùng gợi ý); vẫn phải gõ đủ.
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set(pickReveals(template, scaffoldCount(total))))
  const [hintUsed, setHintUsed] = useState(false)
  const { check, sheet, state, shown, submit, done } = useTypedAnswer(item, 'recall_typing', onAnswer, onContinue)
  const typedLetters = [...value].filter((c) => /[\p{L}\p{N}]/u.test(c)).length
  const nextHint = nextHintSlot(template, revealed, value)
  const sentence = contextSentence(item)

  function doCheck() {
    if (done) {
      if (shown) onContinue()
      return
    }
    if (typedLetters === 0) return
    const composed = composeAnswer(template, value)
    check([composed, value], composed, hintUsed)
  }
  useEnter(doCheck)

  /** Gợi ý: hiện mờ thêm một chữ từ ô đang gõ trở đi; dùng gợi ý thì được tính mức Khó (R6.9). */
  function hint() {
    const idx = nextHint
    if (idx < 0) return
    setRevealed((r) => new Set(r).add(idx))
    setHintUsed(true)
  }

  return (
    <StepFrame
      title={knownCheck ? 'Bạn đã biết từ này? Điền từ' : 'Điền từ'}
      footer={
        <>
          <PillButton disabled={typedLetters === 0 || done} onClick={doCheck}>
            Kiểm tra
          </PillButton>
          {!done && (
            <div className="flex flex-wrap justify-center gap-x-5">
              {nextHint >= 0 && total - typedLetters > 1 && (
                <TextLink onClick={hint}>
                  <span className="inline-flex items-center gap-1">
                    <Lightbulb aria-hidden className="h-4 w-4" /> Gợi ý
                  </span>
                </TextLink>
              )}
              <TextLink onClick={() => void submit(knownCheck ? { kind: 'answer', exercise: 'recall_typing', correct: false } : DONT_KNOW, 'wrong', 'Ghi nhớ lại nhé')}>
                {knownCheck ? 'Không nhớ ra' : 'Mình không thuộc từ này'}
              </TextLink>
            </div>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="text-[1.625rem] leading-snug font-bold">
          <TermLabel item={item} />
        </p>
        {sentence && (
          <p className="max-w-sm text-[1rem] leading-relaxed text-muted italic">
            <Sentence text={sentence} term={item.term} mode="blank" />
          </p>
        )}
      </div>
      <LetterSlots term={item.term} value={value} onChange={setValue} onEnter={doCheck} revealed={revealed} state={state} />
      {hintUsed && !done && <p className="-mt-2 text-center text-[0.8125rem] text-muted">Dùng gợi ý sẽ được tính mức “Khó”.</p>}
      {sheet}
    </StepFrame>
  )
}

// ---- Nghe và viết lại (R6.3) ------------------------------------------------------------------

export function DictationStep({ item, onAnswer, onContinue, onNoAudio }: { item: VocabItem; onAnswer: AnswerFn; onContinue: () => void; onNoAudio: () => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { check, sheet, state, shown, submit, done } = useTypedAnswer(item, 'dictation', onAnswer, onContinue)
  useAutoPlay(item.term)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  function doCheck(e?: FormEvent) {
    e?.preventDefault()
    if (done) {
      if (shown) onContinue()
      return
    }
    if (!value.trim()) return
    check([value], value.trim(), false)
  }
  useEnter(() => doCheck())

  const border = state === 'right' ? 'border-accent' : state === 'wrong' ? 'border-danger' : state === 'near' ? 'border-sun' : 'border-line focus-within:border-sun'
  return (
    <StepFrame
      title="Nghe và viết lại"
      footer={
        <>
          <PillButton disabled={!value.trim() || done} onClick={() => doCheck()}>
            Kiểm tra
          </PillButton>
          {!done && (
            <div className="flex flex-wrap justify-center gap-x-5">
              <TextLink onClick={() => void submit(DONT_KNOW, 'wrong', 'Ghi nhớ lại nhé')}>Mình không thuộc từ này</TextLink>
              <TextLink onClick={onNoAudio}>Tạm thời không nghe được</TextLink>
            </div>
          )}
        </>
      }
    >
      <div className="flex items-center justify-center gap-5 py-3">
        <RoundSpeak text={item.term} size="lg" />
        <RoundSpeak text={item.term} slow />
      </div>
      <form onSubmit={doCheck}>
        <motion.label
          animate={state === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : {}}
          transition={{ duration: 0.35 }}
          className={`flex h-16 items-center rounded-3xl border-2 bg-surface px-5 transition-colors ${border}`}
        >
          <input
            ref={inputRef}
            value={value}
            readOnly={done}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Gõ lại từ bạn nghe được"
            aria-label="Câu trả lời"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            className="h-full min-w-0 flex-1 bg-transparent text-[1.25rem] font-semibold outline-none placeholder:font-normal placeholder:text-subtle"
          />
        </motion.label>
        {!done && <KeyboardHint typed={value} term={item.term} />}
      </form>
      {sheet}
    </StepFrame>
  )
}

// ---- Thẻ tự đánh giá (R4.5) -------------------------------------------------------------------

const RATINGS: { grade: Grade; label: string; cls: string }[] = [
  { grade: Rating.Again, label: 'Quên', cls: 'bg-danger-soft text-danger shadow-[0_4px_0_0_var(--app-danger-shadow)]' },
  { grade: Rating.Hard, label: 'Khó', cls: 'bg-sun-soft text-[#9a5b06] shadow-[0_4px_0_0_var(--app-sun-shadow)]' },
  { grade: Rating.Good, label: 'Nhớ', cls: 'bg-accent-soft text-accent shadow-[0_4px_0_0_var(--app-accent-shadow)]' },
  { grade: Rating.Easy, label: 'Dễ', cls: 'bg-accent text-on-accent shadow-[0_4px_0_0_var(--app-accent-shadow)]' },
]
const RATING_KEY: Record<number, 'again' | 'hard' | 'good' | 'easy'> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }

export function FlashcardStep({
  item,
  preview,
  onAnswer,
  onContinue,
}: {
  item: VocabItem
  preview: Record<Grade, FsrsCard> | null
  onAnswer: AnswerFn
  onContinue: (dir: -1 | 1) => void
}) {
  const { flashcardFront } = useSettings()
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())
  useAutoPlay(item.term, flashcardFront === 'term')

  async function rate(grade: Grade) {
    if (busy) return
    setBusy(true)
    if (grade === Rating.Again) playWrong()
    else playCorrect()
    await onAnswer({ kind: 'self_rating', rating: RATING_KEY[grade] })
    onContinue(grade === Rating.Again ? -1 : 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || (e.key === 'Enter' && !flipped)) {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) void rate(Number(e.key) as Grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const front =
    flashcardFront === 'term' ? (
      <p className="text-[2.25rem] leading-tight font-extrabold break-words">{item.term}</p>
    ) : (
      <p className="text-[1.625rem] leading-snug font-bold">
        <TermLabel item={item} />
      </p>
    )

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <p className="pt-2 text-center text-[1.0625rem] font-semibold text-muted">Bạn có nhớ từ này?</p>
      <div className="relative mt-12 flex flex-1 flex-col">
        <div className="absolute -top-8 left-1/2 z-10 flex -translate-x-1/2 gap-4">
          <RoundSpeak text={item.term} />
          <RoundSpeak text={item.term} slow />
        </div>
        <FlipCard
          flipped={flipped}
          onFlip={() => setFlipped((f) => !f)}
          onSwipe={flipped ? (dir) => void rate(dir === 1 ? Rating.Good : Rating.Again) : undefined}
          showTapHint={!flipped}
          front={front}
          back={<TermBack item={item} />}
        />
      </div>
      <div className="sticky bottom-0 bg-bg pt-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <AnimatePresence mode="wait">
          {flipped ? (
            <motion.div key="rate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.grade}
                  type="button"
                  disabled={busy}
                  onClick={() => void rate(r.grade)}
                  className={`flex h-16 flex-col items-center justify-center rounded-2xl font-extrabold transition-transform duration-100 active:translate-y-[3px] ${r.cls}`}
                >
                  <span className="text-[1rem]">{r.label}</span>
                  {preview && <span className="text-[0.6875rem] font-semibold opacity-80">{formatDueIn(preview[r.grade].due.getTime(), now).replace(' nữa', '')}</span>}
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div key="flip" exit={{ opacity: 0 }} className="flex justify-center">
              <PillButton onClick={() => setFlipped(true)}>Lật thẻ</PillButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
