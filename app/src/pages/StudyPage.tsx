import { GraduationCap, Pause, Repeat, Sparkles, Trophy, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Confetti } from '../components/Confetti'
import { BackButton, Badge, Chip, Sheet } from '../components/kit'
import { formatDueIn } from '../lib/format'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import { buildMeaningChoices, seededRandom, type ChoiceSource } from '../core/exercises'
import type { AttemptResult } from '../core/grading'
import { liveCard } from '../core/library'
import { newCard } from '../core/scheduler'
import { applyAction, currentStep, progress, summarize, type SessionAction, type SessionPlan, type Step } from '../core/session'
import { dueCount, learnCandidates, nextDueAt, type Library } from '../db/library'
import { rowToCard } from '../db/cards'
import { appScheduler, repo } from '../db/repo'
import type { StudySessionRow } from '../db/types'
import { useLibrary, useNow } from '../lib/hooks'
import { duration, ease, riseIn } from '../lib/motion'
import { useSettings } from '../lib/settings'
import { playComplete } from '../lib/sfx'
import { speechAvailable } from '../services/speech'
import { buildLearnPlan, buildRetryPlan, buildReviewPlan } from '../study/plans'
import { FlashcardStep, IntroStep, MultipleChoiceStep, TypingStep, type AnswerOutcome } from '../study/steps'

type Mode = 'learn' | 'review' | 'resume'
type Phase = { kind: 'setup' } | { kind: 'running'; session: StudySessionRow } | { kind: 'summary'; plan: SessionPlan; endedAt: number }

/** Học từ mới (R4), ôn tập theo lịch (R5.3) và tiếp tục buổi dở (R4.6). */
export function StudyPage({ mode }: { mode: Mode }) {
  const lib = useLibrary()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const [resumable, setResumable] = useState<StudySessionRow | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    void repo.activeSession().then((s) => {
      if (!alive) return
      setResumable(s ?? null)
      if (mode === 'resume') {
        if (s) setPhase({ kind: 'running', session: s })
        else navigate('/', { replace: true })
      }
    })
    return () => {
      alive = false
    }
  }, [mode, navigate])

  if (!lib || resumable === undefined) return null

  if (phase.kind === 'running') {
    return (
      <SessionRunner
        key={phase.session.id}
        lib={lib}
        session={phase.session}
        onEnd={(plan) => setPhase({ kind: 'summary', plan, endedAt: Date.now() })}
        onPause={() => navigate('/')}
      />
    )
  }
  if (phase.kind === 'summary') {
    return (
      <Summary
        lib={lib}
        plan={phase.plan}
        endedAt={phase.endedAt}
        onStart={async (plan) => setPhase({ kind: 'running', session: await repo.startSession(plan) })}
      />
    )
  }
  if (mode === 'resume') return null
  return (
    <Setup
      lib={lib}
      mode={mode}
      resumable={resumable}
      onResume={(s) => setPhase({ kind: 'running', session: s })}
      onStart={async (plan) => setPhase({ kind: 'running', session: await repo.startSession(plan) })}
    />
  )
}

// ---- Chọn nội dung (R4.1) -------------------------------------------------------------------

function Setup({
  lib,
  mode,
  resumable,
  onResume,
  onStart,
}: {
  lib: Library
  mode: 'learn' | 'review'
  resumable: StudySessionRow | null
  onResume: (s: StudySessionRow) => void
  onStart: (plan: SessionPlan) => void
}) {
  const settings = useSettings()
  const navigate = useNavigate()
  const now = useNow()
  const [params] = useSearchParams()
  const presetDeck = params.get('deck')
  const [deckId, setDeckId] = useState<string>(presetDeck && lib.deckById.has(presetDeck) ? presetDeck : '')
  const [count, setCount] = useState(settings.dailyNewWords)
  const [starting, setStarting] = useState(false)
  const scope = deckId ? [deckId] : undefined
  const decks = lib.decks.filter((d) => !d.archived && (d.active || d.id === deckId))

  const available = mode === 'learn' ? learnCandidates(lib, scope).length : buildReviewPlan(lib, appScheduler, { deckIds: scope, limit: Infinity, now, style: settings.reviewStyle, audioAvailable: true })?.steps.length ?? 0
  const sessionSize = mode === 'learn' ? Math.min(count, available) : Math.min(settings.reviewLimit, available)
  const nextDue = nextDueAt(lib, now)
  const resumeProgress = resumable ? progress(resumable.plan) : null
  const counts = [...new Set([5, 10, 15, 20, 30, settings.dailyNewWords])].sort((a, b) => a - b)

  async function start() {
    if (starting) return
    setStarting(true)
    const plan =
      mode === 'learn'
        ? buildLearnPlan(lib, { deckIds: scope, count, now: Date.now() })
        : buildReviewPlan(lib, appScheduler, { deckIds: scope, limit: settings.reviewLimit, now: Date.now(), style: settings.reviewStyle, audioAvailable: speechAvailable() })
    if (plan) onStart(plan)
    else setStarting(false)
  }

  return (
    <Page title={mode === 'learn' ? 'Học từ mới' : 'Ôn tập'} back={<BackButton fallback="/" />}>
      {resumable && resumeProgress && (
        <Card className="border-accent bg-accent-soft">
          <p className="text-[15px] font-semibold text-accent-strong">Bạn có một buổi {resumable.mode === 'learn' ? 'học' : 'ôn'} đang dở</p>
          <p className="mt-0.5 text-sm text-accent-strong/80">
            Đã làm {resumeProgress.done}/{resumeProgress.total} bước. Bắt đầu buổi mới sẽ bỏ buổi này.
          </p>
          <Button variant="primary" className="mt-3 w-full" onClick={() => onResume(resumable)}>
            Tiếp tục buổi dở
          </Button>
        </Card>
      )}

      {decks.length > 0 && (
        <Card>
          <SectionTitle>Phạm vi</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Chip active={deckId === ''} onClick={() => setDeckId('')}>
              Tất cả bộ đang học
            </Chip>
            {decks.map((d) => (
              <Chip key={d.id} active={deckId === d.id} onClick={() => setDeckId(d.id)}>
                {d.name}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {available === 0 ? (
        mode === 'learn' ? (
          <EmptyState
            icon={GraduationCap}
            title="Không còn từ mới để học"
            body={lib.items.length === 0 ? 'Sổ tay đang trống. Thêm vài từ hoặc nhập từ file để bắt đầu.' : 'Mọi từ trong phạm vi này đã được học. Thêm từ mới vào sổ tay nhé.'}
          >
            <Button variant="primary" onClick={() => navigate('/words/new')}>
              Thêm từ
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Chưa có từ đến hạn ôn"
            body={nextDue ? `Lượt ôn tiếp theo: ${formatDueIn(nextDue, now)}. Trong lúc chờ, bạn có thể học thêm từ mới.` : 'Hãy học vài từ mới, lịch ôn sẽ tự lên kế hoạch cho từng từ.'}
          >
            <Button variant="primary" onClick={() => navigate('/learn')}>
              Học từ mới
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          {mode === 'learn' ? (
            <Card>
              <SectionTitle>Số từ mới buổi này</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {counts.map((n) => (
                  <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                    {n} từ
                  </Chip>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">
                Còn {available} từ chưa học. Mỗi nhóm 5 từ: xem thẻ giới thiệu, rồi kiểm tra ngay.
              </p>
            </Card>
          ) : (
            <Card>
              <p className="text-[40px] leading-none font-bold text-warning">
                <AnimatedNumber value={available} />
              </p>
              <p className="mt-1 text-sm text-muted">
                từ đến hạn ôn{available > settings.reviewLimit && ` · buổi này ôn ${settings.reviewLimit} từ cần nhất trước`}
              </p>
              <p className="mt-3 text-sm text-muted">
                {settings.reviewStyle === 'flashcard' ? 'Kiểu ôn: thẻ tự đánh giá.' : 'Kiểu ôn: trắc nghiệm, gõ từ và nghe viết, tùy mức độ nhớ của từng từ.'}
              </p>
            </Card>
          )}
          <motion.div variants={riseIn}>
            <Button variant="primary" icon={mode === 'learn' ? GraduationCap : Repeat} className="w-full disabled:opacity-70" disabled={starting} onClick={() => void start()}>
              {mode === 'learn' ? `Bắt đầu học ${sessionSize} từ` : `Bắt đầu ôn ${sessionSize} từ`}
            </Button>
          </motion.div>
        </>
      )}
    </Page>
  )
}

// ---- Chạy buổi học (R4.2–R4.6, R5.3, R5.5, R5.10, R6.12) --------------------------------------

function SessionRunner({ lib, session, onEnd, onPause }: { lib: Library; session: StudySessionRow; onEnd: (plan: SessionPlan) => void; onPause: () => void }) {
  const [plan, setPlan] = useState(session.plan)
  const planRef = useRef(session.plan)
  const [view, setView] = useState<{ step: Step | undefined; key: number; cursor: number }>(() => ({ step: currentStep(session.plan), key: 0, cursor: session.plan.cursor }))
  const [exitDir, setExitDir] = useState(0)
  const [pauseOpen, setPauseOpen] = useState(false)
  const shownAt = useRef(Date.now())
  const busy = useRef(false)

  const commitPlan = (next: SessionPlan) => {
    planRef.current = next
    setPlan(next)
  }

  /** Áp dụng hành động, ghi lượt trả lời và lịch ôn, lưu tiến trình. */
  const act = useCallback(
    async (step: Step, action: SessionAction): Promise<AnswerOutcome> => {
      const { plan: next, effect } = applyAction(planRef.current, action)
      commitPlan(next)
      const at = Date.now()
      const { card } = await repo.recordStep(session, step, effect, next, { at, responseMs: at - shownAt.current })
      return { card }
    },
    [session],
  )

  const finish = useCallback(async () => {
    await repo.endSession(session.id, 'completed', planRef.current)
    onEnd(planRef.current)
  }, [session.id, onEnd])

  const advance = useCallback(
    (dir: number = 0) => {
      setExitDir(dir)
      const next = currentStep(planRef.current)
      if (!next) {
        void finish()
        return
      }
      shownAt.current = Date.now()
      setView((v) => ({ step: next, key: v.key + 1, cursor: planRef.current.cursor }))
    },
    [finish],
  )

  const step = view.step
  const item = step ? lib.itemById.get(step.itemId) : undefined

  // Từ đã bị xóa trong lúc học: bỏ qua bước này.
  useEffect(() => {
    if (step && !item) {
      void act(step, { type: 'intro_next' }).then(() => advance())
    } else if (!step) {
      void finish()
    }
  }, [step, item, act, advance, finish])

  const choices = useMemo<ChoiceSource[] | null>(() => {
    if (!item || step?.exercise !== 'mcq_meaning') return null
    return buildMeaningChoices(item, lib.items.filter((i) => !i.archived), seededRandom(view.key * 7919 + item.term.length))
  }, [item, step, lib.items, view.key])

  const preview = useMemo(() => {
    if (!item || step?.exercise !== 'flashcard' || step.kind === 'intro') return null
    const row = liveCard(lib.cards.get(item.id))
    const base = row ? rowToCard(row) : newCard(new Date())
    const r = appScheduler.repeat(base, new Date())
    return { 1: r[1].card, 2: r[2].card, 3: r[3].card, 4: r[4].card }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.key])

  const answer = useCallback(
    async (result: AttemptResult) => {
      if (!step || busy.current) return { card: null }
      busy.current = true
      try {
        return await act(step, { type: 'answer', result })
      } finally {
        busy.current = false
      }
    },
    [step, act],
  )

  const { done, total } = progress(plan)
  const pct = total ? done / total : 0

  let body = null
  if (step && item) {
    if (step.kind === 'intro') {
      body = (
        <IntroStep
          item={item}
          onNext={(dir) => void act(step, { type: 'intro_next' }).then(() => advance(dir))}
          onKnown={() => void act(step, { type: 'intro_known' }).then(() => advance(0))}
        />
      )
    } else if (step.exercise === 'flashcard') {
      body = <FlashcardStep item={item} preview={preview} onAnswer={answer} onContinue={(dir) => advance(dir)} />
    } else if (step.exercise === 'mcq_meaning' && choices) {
      body = <MultipleChoiceStep item={item} choices={choices} onAnswer={answer} onContinue={() => advance(0)} />
    } else {
      const typingMode = step.kind === 'known_check' ? 'known_check' : step.exercise === 'dictation' ? 'dictation' : 'recall'
      body = (
        <TypingStep
          item={item}
          mode={typingMode}
          onAnswer={answer}
          onContinue={() => advance(0)}
          onNoAudio={() => {
            const { plan: next } = applyAction(planRef.current, { type: 'no_audio' })
            commitPlan(next)
            void repo.recordStep(session, step, { log: false, grade: null, correct: null, schedule: false, requeued: false }, next, { at: Date.now(), responseMs: null })
            shownAt.current = Date.now()
            setView((v) => ({ step: currentStep(next), key: v.key + 1, cursor: next.cursor }))
          }}
        />
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-center gap-3">
        <motion.button type="button" whileTap={{ scale: 0.88 }} aria-label="Tạm dừng" onClick={() => setPauseOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <X aria-hidden className="h-5 w-5" />
        </motion.button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <span className="min-w-12 text-right text-sm font-semibold text-muted tabular-nums">
          {Math.min(view.cursor + 1, total)}/{total}
        </span>
      </div>
      <div className="mt-2 flex h-6 items-center justify-center">
        <AnimatePresence>
          {step?.kind === 'retry' && (
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Badge tone="warning">Luyện lại</Badge>
            </motion.span>
          )}
          {plan.mode === 'retry' && step?.kind !== 'retry' && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Badge>Luyện từ cần củng cố · không đổi lịch ôn</Badge>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mx-auto mt-2 w-full max-w-md flex-1">
        <AnimatePresence mode="popLayout" initial={false} custom={exitDir}>
          <motion.div
            key={view.key}
            custom={exitDir}
            variants={{
              enter: { opacity: 0, x: 40, scale: 0.98 },
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (dir: number) => (dir === 0 ? { opacity: 0, x: -40 } : { opacity: 0, x: dir * 420, rotate: dir * 14 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: duration.base, ease: ease.out }}
            className="w-full"
          >
            {body}
          </motion.div>
        </AnimatePresence>
      </div>

      <Sheet open={pauseOpen} onClose={() => setPauseOpen(false)} title="Tạm dừng buổi học?">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">Kết quả đã làm được lưu. Bạn có thể tiếp tục buổi này từ trang Hôm nay.</p>
          <Button variant="primary" onClick={() => setPauseOpen(false)}>
            Học tiếp
          </Button>
          <Button icon={Pause} onClick={onPause}>
            Tạm dừng, để sau
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setPauseOpen(false)
              void finish()
            }}
          >
            Kết thúc và xem kết quả
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

// ---- Tổng kết (R4.7, R5.12) -------------------------------------------------------------------

function Summary({ lib, plan, endedAt, onStart }: { lib: Library; plan: SessionPlan; endedAt: number; onStart: (plan: SessionPlan) => void }) {
  const navigate = useNavigate()
  const now = useNow()
  const s = useMemo(() => summarize(plan, endedAt), [plan, endedAt])
  const answered = s.correct + s.wrong
  const accuracy = answered ? s.correct / answered : 1
  const great = answered > 0 && accuracy >= 0.8
  const minutes = Math.max(1, Math.round(s.durationMs / 60_000))
  const moreNew = plan.mode === 'learn' ? learnCandidates(lib).length : 0
  const due = dueCount(lib, now)

  useEffect(() => {
    playComplete()
  }, [])

  const title = plan.mode === 'learn' ? 'Hoàn thành buổi học!' : plan.mode === 'retry' ? 'Đã luyện xong!' : 'Hoàn thành buổi ôn!'

  return (
    <>
      <Confetti fire={great} />
      <Page title={title} subtitle={`${minutes} phút`}>
        <Card className="flex flex-col items-center py-6 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-[26px] bg-warning-soft"
          >
            <Trophy aria-hidden className="h-10 w-10 text-warning" />
          </motion.div>
          <div className="grid w-full grid-cols-3">
            <SumStat label={plan.mode === 'learn' ? 'Từ đã học' : 'Số từ'} value={s.items} />
            <SumStat label="Nhớ" value={s.correct} tone="accent" />
            <SumStat label="Quên" value={s.wrong} tone={s.wrong ? 'danger' : undefined} />
          </div>
          {answered > 0 && (
            <p className="mt-4 text-sm text-muted">
              Tỷ lệ nhớ <b className="text-text">{Math.round(accuracy * 100)}%</b>
              {s.known > 0 && ` · ${s.known} từ bạn đã biết sẵn`}
            </p>
          )}
        </Card>

        {s.needWork.length > 0 && (
          <Card>
            <SectionTitle>Cần củng cố ({s.needWork.length})</SectionTitle>
            <ul className="flex flex-col">
              {s.needWork.map((id) => {
                const it = lib.itemById.get(id)
                if (!it) return null
                return (
                  <li key={id}>
                    <Link to={`/words/${id}`} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-semibold">{it.term}</span>
                      <span className="truncate text-sm text-muted">{it.meaningVi}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        <motion.div variants={riseIn} className="flex flex-col gap-2.5">
          {s.needWork.length > 0 && (
            <Button
              variant="primary"
              icon={Repeat}
              onClick={() => {
                const p = buildRetryPlan(lib, s.needWork, Date.now())
                if (p) onStart(p)
              }}
            >
              Luyện lại {s.needWork.length} từ cần củng cố
            </Button>
          )}
          {plan.mode !== 'learn' && due > 0 && (
            <Button variant={s.needWork.length ? 'secondary' : 'primary'} icon={Repeat} onClick={() => navigate('/review')}>
              Ôn tiếp ({due} từ đến hạn)
            </Button>
          )}
          {plan.mode === 'learn' && moreNew > 0 && (
            <Button variant={s.needWork.length ? 'secondary' : 'primary'} icon={GraduationCap} onClick={() => navigate('/learn')}>
              Học thêm từ mới
            </Button>
          )}
          <Button onClick={() => navigate('/')}>Về trang Hôm nay</Button>
        </motion.div>
      </Page>
    </>
  )
}

function SumStat({ label, value, tone }: { label: string; value: number; tone?: 'accent' | 'danger' }) {
  return (
    <div>
      <AnimatedNumber value={value} className={`text-[30px] font-bold tabular-nums ${tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : ''}`} />
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
