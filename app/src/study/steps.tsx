import { Check, EarOff, Lightbulb, RotateCcw, Volume2, X } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { SpeakButtons } from '../components/kit'
import { formatDueIn } from '../lib/format'
import { Button } from '../components/ui'
import { checkAnswer } from '../core/answers'
import { blankTerm } from '../core/vocab'
import type { ChoiceSource } from '../core/exercises'
import type { AttemptResult } from '../core/grading'
import { POS_LABEL } from '../core/pos'
import type { CardStateRow, VocabItem } from '../db/types'
import { duration, ease, spring } from '../lib/motion'
import { useSettings } from '../lib/settings'
import { playCorrect, playWrong } from '../lib/sfx'
import { speak } from '../services/speech'

/** Kết quả trả về sau khi ghi một lượt: lịch ôn mới (nếu có) để hiện "ôn lại sau…" (R5.11). */
export interface AnswerOutcome {
  card: CardStateRow | null
}
export type AnswerFn = (result: AttemptResult) => Promise<AnswerOutcome>

function useAutoPlay(text: string, enabled = true) {
  const { autoPlay, accent } = useSettings()
  useEffect(() => {
    if (!enabled || !autoPlay) return
    const t = setTimeout(() => void speak(text, { accent }), 250)
    return () => clearTimeout(t)
  }, [text, enabled, autoPlay, accent])
}

function Ipa({ item }: { item: VocabItem }) {
  const { accent } = useSettings()
  const ipa = accent === 'uk' ? (item.ipaUk ?? item.ipaUs) : (item.ipaUs ?? item.ipaUk)
  return ipa ? <p className="text-[15px] text-muted">{ipa}</p> : null
}

// ---- Thẻ lật -------------------------------------------------------------------------------

function FlipCard({
  flipped,
  front,
  back,
  onFlip,
  onSwipe,
  hints,
}: {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  onFlip: () => void
  onSwipe?: (dir: -1 | 1) => void
  /** Nhãn hiện khi kéo sang trái/phải (chỉ dùng khi vuốt có nghĩa chấm điểm). */
  hints?: { left: string; right: string }
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-10, 10])
  const hintRight = useTransform(x, [20, 110], [0, 1])
  const hintLeft = useTransform(x, [-110, -20], [1, 0])

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!onSwipe) return
    if (info.offset.x > 110 || info.velocity.x > 600) onSwipe(1)
    else if (info.offset.x < -110 || info.velocity.x < -600) onSwipe(-1)
  }

  return (
    <motion.div
      style={{ x, rotate, perspective: 1200 }}
      drag={onSwipe ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      className="relative h-[340px] w-full cursor-pointer touch-pan-y select-none"
      onClick={onFlip}
    >
      {onSwipe && hints && (
        <>
          <motion.span style={{ opacity: hintRight }} className="absolute top-4 right-4 z-10 rounded-full bg-accent-soft px-3 py-1 text-sm font-bold text-accent">
            {hints.right}
          </motion.span>
          <motion.span style={{ opacity: hintLeft }} className="absolute top-4 left-4 z-10 rounded-full bg-danger-soft px-3 py-1 text-sm font-bold text-danger">
            {hints.left}
          </motion.span>
        </>
      )}
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[28px] border border-line bg-surface p-6 text-center shadow-sm [backface-visibility:hidden]">
          {front}
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto rounded-[28px] border border-line bg-surface p-6 text-center shadow-sm [backface-visibility:hidden]"
          style={{ transform: 'rotateY(180deg)' }}
        >
          {back}
        </div>
      </motion.div>
    </motion.div>
  )
}

function TermFace({ item }: { item: VocabItem }) {
  return (
    <>
      <p className="text-[34px] leading-tight font-bold break-words">{item.term}</p>
      <p className="text-sm text-subtle">{POS_LABEL[item.partOfSpeech]}</p>
      <Ipa item={item} />
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <SpeakButtons text={item.term} />
      </div>
    </>
  )
}

function MeaningFace({ item, showTerm }: { item: VocabItem; showTerm: boolean }) {
  const { showTranslations } = useSettings()
  const ex = item.examples[0]
  return (
    <>
      {showTerm && <p className="text-[22px] font-bold">{item.term}</p>}
      <p className="text-[24px] leading-snug font-semibold text-accent">{item.meaningVi}</p>
      {item.meaningEn && <p className="text-sm text-muted italic">{item.meaningEn}</p>}
      {ex && (
        <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-left" onClick={(e) => e.stopPropagation()}>
          <p className="flex items-start gap-2 text-[15px] leading-relaxed">
            <span className="flex-1">{ex.en}</span>
            <SpeakButtons text={ex.en} size="sm" slow={false} />
          </p>
          {ex.vi && showTranslations && <p className="mt-1 text-sm text-muted">{ex.vi}</p>}
        </div>
      )}
      {item.mnemonic && (
        <p className="mt-2 flex items-start gap-2 text-left text-sm text-muted">
          <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          {item.mnemonic}
        </p>
      )}
    </>
  )
}

// ---- Giới thiệu từ mới (R4.2, R4.3, R4.8) ----------------------------------------------------

export function IntroStep({ item, onNext, onKnown }: { item: VocabItem; onNext: (dir: -1 | 1) => void; onKnown: () => void }) {
  const { flashcardFront } = useSettings()
  const [flipped, setFlipped] = useState(false)
  useAutoPlay(item.term)
  const termFirst = flashcardFront === 'term'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === 'Enter') onNext(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNext])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm font-semibold text-accent">Từ mới</p>
      <FlipCard
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onSwipe={(dir) => onNext(dir)}
        front={termFirst ? <TermFace item={item} /> : <MeaningFace item={item} showTerm={false} />}
        back={termFirst ? <MeaningFace item={item} showTerm={false} /> : <TermFace item={item} />}
      />
      <p className="text-center text-xs text-subtle">Chạm để lật thẻ · vuốt để tiếp tục</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onKnown}>Đã biết từ này</Button>
        <Button variant="primary" onClick={() => (flipped ? onNext(1) : setFlipped(true))}>
          {flipped ? 'Tiếp tục' : 'Lật thẻ'}
        </Button>
      </div>
    </div>
  )
}

// ---- Phản hồi sau khi trả lời (R6.7) ------------------------------------------------------------

export function Feedback({
  tone,
  title,
  children,
  nextDue,
  actions,
}: {
  tone: 'correct' | 'wrong' | 'near'
  title: string
  children?: ReactNode
  nextDue?: number | null
  actions: ReactNode
}) {
  const [shownAt] = useState(() => Date.now())
  const cls = tone === 'correct' ? 'bg-accent-soft text-accent-strong' : tone === 'near' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger'
  const Icon = tone === 'correct' ? Check : tone === 'near' ? RotateCcw : X
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={`rounded-3xl p-4 ${cls}`}
      role="status"
    >
      <p className="flex items-center gap-2 text-[17px] font-bold">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.snappy, delay: 0.05 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60">
          <Icon aria-hidden className="h-4 w-4" strokeWidth={3} />
        </motion.span>
        {title}
      </p>
      {children && <div className="mt-2 text-[15px] leading-relaxed">{children}</div>}
      {nextDue != null && <p className="mt-2 text-sm opacity-80">Ôn lại sau: {formatDueIn(nextDue, shownAt).replace(' nữa', '')}</p>}
      <div className="mt-3 flex gap-2">{actions}</div>
    </motion.div>
  )
}

// ---- Trắc nghiệm nghĩa (R6.1) -------------------------------------------------------------------

export function MultipleChoiceStep({ item, choices, onAnswer, onContinue }: { item: VocabItem; choices: ChoiceSource[]; onAnswer: AnswerFn; onContinue: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [gaveUp, setGaveUp] = useState(false)
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null)
  useAutoPlay(item.term)
  const answered = picked !== null || gaveUp
  const correct = picked === item.id

  async function choose(id: string) {
    if (answered) return
    setPicked(id)
    const ok = id === item.id
    if (ok) playCorrect()
    else playWrong()
    setOutcome(await onAnswer({ kind: 'answer', exercise: 'mcq_meaning', correct: ok }))
  }

  async function dontKnow() {
    if (answered) return
    setGaveUp(true)
    playWrong()
    setOutcome(await onAnswer({ kind: 'dont_know' }))
  }

  useEffect(() => {
    if (!answered) return
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && onContinue()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, onContinue])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-sm font-semibold text-muted">Chọn nghĩa đúng</p>
        <p className="text-[32px] leading-tight font-bold break-words">{item.term}</p>
        <Ipa item={item} />
        <SpeakButtons text={item.term} size="sm" />
      </div>
      <div className="flex flex-col gap-2.5">
        {choices.map((c, i) => {
          const isAnswer = c.id === item.id
          const isPicked = c.id === picked
          const state = !answered ? 'idle' : isAnswer ? 'right' : isPicked ? 'wrong' : 'dim'
          return (
            <motion.button
              key={c.id}
              type="button"
              disabled={answered}
              onClick={() => void choose(c.id)}
              whileTap={!answered ? { scale: 0.97 } : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={state === 'wrong' ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: state === 'dim' ? 0.45 : 1, y: 0, scale: state === 'right' ? [1, 1.03, 1] : 1 }}
              transition={{ duration: duration.base * 1.4, ease: ease.out, delay: answered ? 0 : i * 0.04 }}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[16px] font-medium transition-colors ${
                state === 'right' ? 'border-accent bg-accent-soft' : state === 'wrong' ? 'border-danger bg-danger-soft' : 'border-line bg-surface'
              }`}
            >
              <span className="flex-1">{c.meaningVi}</span>
              {state === 'right' && <Check aria-label="Đáp án đúng" className="h-5 w-5 shrink-0 text-accent" strokeWidth={3} />}
              {state === 'wrong' && <X aria-label="Bạn chọn" className="h-5 w-5 shrink-0 text-danger" strokeWidth={3} />}
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        {answered ? (
          <Feedback
            key="fb"
            tone={correct ? 'correct' : 'wrong'}
            title={correct ? 'Chính xác!' : gaveUp ? 'Không sao, ghi nhớ lại nhé' : 'Chưa đúng'}
            nextDue={outcome?.card?.due}
            actions={
              <Button variant="primary" className="w-full" onClick={onContinue}>
                Tiếp tục
              </Button>
            }
          >
            {!correct && (
              <>
                <b>{item.term}</b>: {item.meaningVi}
              </>
            )}
          </Feedback>
        ) : (
          <motion.button key="dk" type="button" exit={{ opacity: 0 }} onClick={() => void dontKnow()} className="self-center py-2 text-sm font-semibold text-muted">
            Mình không thuộc từ này
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Gõ từ theo nghĩa (R6.2), nghe và viết (R6.3), kiểm tra nhanh (R4.8) -----------------------

type TypingVerdict = { kind: 'correct' } | { kind: 'near'; given: string } | { kind: 'wrong'; given: string } | { kind: 'gave_up' }

export function TypingStep({
  item,
  mode,
  onAnswer,
  onContinue,
  onNoAudio,
}: {
  item: VocabItem
  mode: 'recall' | 'dictation' | 'known_check'
  onAnswer: AnswerFn
  onContinue: () => void
  onNoAudio?: () => void
}) {
  const { accent } = useSettings()
  const [value, setValue] = useState('')
  const [verdict, setVerdict] = useState<TypingVerdict | null>(null)
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null)
  const [settled, setSettled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const exercise = mode === 'dictation' ? 'dictation' : 'recall_typing'
  useAutoPlay(item.term, mode === 'dictation')

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [])

  async function settle(result: AttemptResult) {
    setSettled(true)
    setOutcome(await onAnswer(result))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (verdict) {
      // Enter khi đã đúng: tính "Nhớ" rồi đi tiếp.
      if (verdict.kind === 'correct' && !settled) {
        await settle({ kind: 'answer', exercise, correct: true })
        onContinue()
      } else if (settled) onContinue()
      return
    }
    if (!value.trim()) {
      setError('Gõ câu trả lời trước nhé.')
      return
    }
    const v = checkAnswer(value, [item.term, ...item.acceptedAnswers])
    if (v.verdict === 'correct') {
      playCorrect()
      setVerdict({ kind: 'correct' })
      // Kiểm tra nhanh: ghi ngay. Bài thường: chờ người học chọn "Tiếp tục" hay "Dễ quá".
      if (mode === 'known_check') await settle({ kind: 'answer', exercise, correct: true })
    } else if (v.verdict === 'near') {
      setVerdict({ kind: 'near', given: value.trim() })
    } else {
      playWrong()
      setVerdict({ kind: 'wrong', given: value.trim() })
      await settle({ kind: 'answer', exercise, correct: false })
    }
  }

  async function giveUp() {
    playWrong()
    setVerdict({ kind: 'gave_up' })
    await settle(mode === 'known_check' ? { kind: 'answer', exercise, correct: false } : { kind: 'dont_know' })
  }

  const example = item.examples[0]
  const prompt =
    mode === 'dictation' ? (
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm font-semibold text-muted">Nghe và viết lại từ</p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => void speak(item.term, { accent })}
          aria-label="Nghe lại"
          className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg"
        >
          <Volume2 aria-hidden className="h-10 w-10" />
        </motion.button>
        <button type="button" onClick={() => void speak(item.term, { accent, slow: true })} className="text-sm font-semibold text-accent">
          Nghe chậm
        </button>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm font-semibold text-muted">{mode === 'known_check' ? 'Kiểm tra nhanh: gõ từ tiếng Anh' : 'Gõ từ tiếng Anh có nghĩa'}</p>
        <p className="text-[26px] leading-snug font-bold text-accent">{item.meaningVi}</p>
        <p className="text-sm text-subtle">{POS_LABEL[item.partOfSpeech]}</p>
        {example && <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-muted italic">“{blankTerm(example.en, item.term)}”</p>}
      </div>
    )

  const shown = verdict !== null
  const ok = verdict?.kind === 'correct'
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {prompt}
      <motion.div
        animate={verdict?.kind === 'wrong' ? { x: [0, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.35 }}
        className={`flex h-14 items-center rounded-2xl border-2 bg-surface px-4 transition-colors ${
          ok ? 'border-accent' : verdict?.kind === 'wrong' || verdict?.kind === 'gave_up' ? 'border-danger' : verdict?.kind === 'near' ? 'border-warning' : 'border-line focus-within:border-accent'
        }`}
      >
        <input
          ref={inputRef}
          value={value}
          readOnly={shown}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          aria-label="Câu trả lời"
          placeholder="Gõ từ tiếng Anh"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={shown ? 'next' : 'done'}
          className="h-full min-w-0 flex-1 bg-transparent text-[20px] font-semibold outline-none placeholder:font-normal placeholder:text-subtle"
        />
      </motion.div>
      {error && <p className="-mt-2 text-[13px] text-danger">{error}</p>}

      <AnimatePresence mode="wait">
        {!shown && (
          <motion.div key="ask" exit={{ opacity: 0 }} className="flex flex-col gap-2">
            <Button type="submit" variant="primary" className="w-full">
              Kiểm tra
            </Button>
            <div className="flex justify-center gap-4">
              <button type="button" onClick={() => void giveUp()} className="py-2 text-sm font-semibold text-muted">
                {mode === 'known_check' ? 'Không nhớ ra' : 'Mình không thuộc từ này'}
              </button>
              {mode === 'dictation' && onNoAudio && (
                <button type="button" onClick={onNoAudio} className="flex items-center gap-1.5 py-2 text-sm font-semibold text-muted">
                  <EarOff aria-hidden className="h-4 w-4" /> Không tiện nghe
                </button>
              )}
            </div>
          </motion.div>
        )}
        {verdict?.kind === 'correct' && (
          <Feedback
            key="ok"
            tone="correct"
            title="Chính xác!"
            nextDue={outcome?.card?.due}
            actions={
              mode === 'known_check' ? (
                <Button type="button" variant="primary" className="w-full" onClick={onContinue}>
                  Tiếp tục
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    className="flex-1 bg-white/60"
                    disabled={settled}
                    onClick={async () => {
                      await settle({ kind: 'answer', exercise, correct: true, upgradeToEasy: true })
                      onContinue()
                    }}
                  >
                    Dễ quá
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-[2]"
                    disabled={settled}
                    onClick={async () => {
                      await settle({ kind: 'answer', exercise, correct: true })
                      onContinue()
                    }}
                  >
                    Tiếp tục
                  </Button>
                </>
              )
            }
          >
            {mode === 'known_check' ? 'Bạn đã biết từ này, nó sẽ được ôn lại sau một thời gian dài.' : `${item.term} — ${item.meaningVi}`}
          </Feedback>
        )}
        {verdict?.kind === 'near' && (
          <Feedback
            key="near"
            tone="near"
            title="Gần đúng"
            actions={
              <>
                <Button
                  type="button"
                  className="flex-1 bg-white/60"
                  disabled={settled}
                  onClick={async () => {
                    playWrong()
                    await settle({ kind: 'answer', exercise, correct: false })
                    onContinue()
                  }}
                >
                  Tính là sai
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1"
                  disabled={settled}
                  onClick={async () => {
                    playCorrect()
                    await settle({ kind: 'answer', exercise, correct: true, nearMatchAccepted: true })
                    onContinue()
                  }}
                >
                  Tính là đúng
                </Button>
              </>
            }
          >
            Đáp án: <b>{item.term}</b>. Bạn gõ: <span className="line-through">{verdict.given}</span>. Nếu chỉ là lỗi gõ, chọn “Tính là đúng” (được tính mức Khó).
          </Feedback>
        )}
        {(verdict?.kind === 'wrong' || verdict?.kind === 'gave_up') && (
          <Feedback
            key="bad"
            tone="wrong"
            title={verdict.kind === 'gave_up' ? 'Ghi nhớ lại nhé' : 'Chưa đúng'}
            nextDue={outcome?.card?.due}
            actions={
              <Button type="submit" variant="primary" className="w-full" disabled={!settled}>
                Tiếp tục
              </Button>
            }
          >
            <span className="flex items-center justify-between gap-3">
              <span>
                Đáp án: <b>{item.term}</b> — {item.meaningVi}
              </span>
              <SpeakButtons text={item.term} size="sm" slow={false} />
            </span>
          </Feedback>
        )}
      </AnimatePresence>
    </form>
  )
}

// ---- Thẻ tự đánh giá (R4.5) ---------------------------------------------------------------------

const RATINGS: { grade: Grade; label: string; cls: string }[] = [
  { grade: Rating.Again, label: 'Quên', cls: 'bg-danger-soft text-danger' },
  { grade: Rating.Hard, label: 'Khó', cls: 'bg-warning-soft text-warning' },
  { grade: Rating.Good, label: 'Nhớ', cls: 'bg-accent-soft text-accent' },
  { grade: Rating.Easy, label: 'Dễ', cls: 'bg-accent text-on-accent' },
]
const RATING_KEY: Record<number, 'again' | 'hard' | 'good' | 'easy'> = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }

export function FlashcardStep({
  item,
  preview,
  onAnswer,
  onContinue,
}: {
  item: VocabItem
  /** Thời điểm đến hạn nếu chọn từng mức (để hiện trên nút). */
  preview: Record<Grade, FsrsCard> | null
  onAnswer: AnswerFn
  onContinue: (dir: -1 | 1) => void
}) {
  const { flashcardFront } = useSettings()
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  useAutoPlay(item.term, flashcardFront === 'term')
  const termFirst = flashcardFront === 'term'
  const [now] = useState(() => Date.now())

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
      if (e.key === ' ') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) void rate(Number(e.key) as Grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm font-semibold text-muted">Bạn có nhớ từ này?</p>
      <FlipCard
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onSwipe={flipped ? (dir) => void rate(dir === 1 ? Rating.Good : Rating.Again) : undefined}
        hints={{ left: 'Quên', right: 'Nhớ' }}
        front={termFirst ? <TermFace item={item} /> : <MeaningFace item={item} showTerm={false} />}
        back={termFirst ? <MeaningFace item={item} showTerm={false} /> : <TermFace item={item} />}
      />
      <AnimatePresence mode="wait">
        {flipped ? (
          <motion.div key="rate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <motion.button
                key={r.grade}
                type="button"
                whileTap={{ scale: 0.93 }}
                disabled={busy}
                onClick={() => void rate(r.grade)}
                className={`flex h-16 flex-col items-center justify-center rounded-2xl font-bold ${r.cls}`}
              >
                <span className="text-[15px]">{r.label}</span>
                {preview && <span className="text-[11px] font-medium opacity-80">{formatDueIn(preview[r.grade].due.getTime(), now).replace(' nữa', '')}</span>}
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="flip" exit={{ opacity: 0 }}>
            <Button variant="primary" className="w-full" onClick={() => setFlipped(true)}>
              Lật thẻ
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
