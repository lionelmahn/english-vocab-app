import { Check, GraduationCap, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BackButton, SpeakButtons } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { buildPlacement, knownBands, PER_BAND, PLACEMENT_BANDS, scorePlacement, stopAfter, suggestDailyNew, type PlacementQuestion, type PlacementResult } from '../core/placement'
import { POS_LABEL } from '../core/pos'
import { SELF_LEVELS } from '../core/profile'
import { termKey } from '../core/vocab'
import { PROBE_B1, PROBE_B2, PROBE_C1 } from '../data/placement'
import { STARTER_DECKS } from '../data/starter'
import { liveCard } from '../core/library'
import { db } from '../db/db'
import { repo } from '../db/repo'
import { savePlacementLast } from '../lib/placementLast'
import { useLibrary } from '../lib/hooks'
import { showToast } from '../lib/toast'
import { updateProfile, useProfile } from '../services/profile'

const num = new Intl.NumberFormat('vi-VN')
const deck = STARTER_DECKS[0]

type Phase = { kind: 'intro' } | { kind: 'loading' } | { kind: 'quiz'; questions: PlacementQuestion[][]; band: number; index: number; answers: { band: number; correct: boolean }[] } | { kind: 'done'; result: PlacementResult; starter: string[] }

/**
 * Kiểm tra trình độ đầu vào (R1.8): khoảng 5 phút trắc nghiệm nghĩa theo dải tần suất, rồi gợi ý trình độ, số từ mới
 * mỗi ngày và đánh dấu sẵn các từ đã biết trong bộ 1.000 từ. Mở từ bước Trình độ khi thiết lập lần đầu hoặc từ Cá nhân.
 */
export function PlacementPage() {
  const fromWelcome = (useLocation().state as { from?: string } | null)?.from === 'welcome'
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [starterTerms, setStarterTerms] = useState<string[]>([])

  async function start() {
    setPhase({ kind: 'loading' })
    const starter = await deck.load()
    setStarterTerms(starter.map((s) => s.term))
    setPhase({ kind: 'quiz', questions: buildPlacement(starter, [PROBE_B1, PROBE_B2, PROBE_C1]), band: 0, index: 0, answers: [] })
  }

  function answer(correct: boolean) {
    if (phase.kind !== 'quiz') return
    const answers = [...phase.answers, { band: phase.band, correct }]
    const bandQs = phase.questions[phase.band]
    if (phase.index + 1 < bandQs.length) return setPhase({ ...phase, index: phase.index + 1, answers })
    // Hết một dải: dừng nếu đúng quá ít, hoặc sang dải sau (bỏ qua dải không có câu hỏi).
    const right = answers.filter((a) => a.band === phase.band && a.correct).length
    const next = phase.questions.findIndex((qs, i) => i > phase.band && qs.length > 0)
    if (stopAfter(right) || next < 0) {
      const result = scorePlacement(answers)
      savePlacementLast({ estimate: result.estimate, level: result.level, at: Date.now() })
      return setPhase({ kind: 'done', result, starter: starterTerms })
    }
    setPhase({ ...phase, band: next, index: 0, answers })
  }

  return (
    <Page title="Kiểm tra trình độ" subtitle="Khoảng 5 phút: chọn nghĩa đúng của từ" back={<BackButton fallback={fromWelcome ? '/welcome' : '/me'} />}>
      {phase.kind === 'intro' && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <GraduationCap aria-hidden className="h-7 w-7" />
            </span>
            <p className="text-sm leading-relaxed text-muted">
              Bài gồm tối đa {PLACEMENT_BANDS.length * PER_BAND} câu, từ dễ đến khó: năm dải đầu là bộ 1.000 từ thông dụng, ba dải sau là từ khó hơn. Dải nào trả lời sai nhiều thì bài dừng sớm. Không biết thì chọn “Không biết”, đừng đoán, để kết quả sát hơn.
            </p>
            <p className="text-sm leading-relaxed text-muted">Xong bài, app gợi ý trình độ, số từ mới mỗi ngày và có thể đánh dấu sẵn các từ bạn đã biết để khỏi học lại.</p>
            <Button variant="primary" icon={GraduationCap} className="mt-1 w-full" onClick={() => void start()}>
              Bắt đầu kiểm tra
            </Button>
          </div>
        </Card>
      )}
      {phase.kind === 'loading' && <p className="py-8 text-center text-sm text-muted">Đang chuẩn bị câu hỏi…</p>}
      {phase.kind === 'quiz' && <QuestionView key={`${phase.band}-${phase.index}`} phase={phase} onAnswer={answer} />}
      {phase.kind === 'done' && <ResultView result={phase.result} starter={phase.starter} fromWelcome={fromWelcome} onRetry={() => setPhase({ kind: 'intro' })} />}
    </Page>
  )
}

function QuestionView({ phase, onAnswer }: { phase: Extract<Phase, { kind: 'quiz' }>; onAnswer: (correct: boolean) => void }) {
  const q = phase.questions[phase.band][phase.index]
  const [picked, setPicked] = useState<string | null>(null)
  const done = phase.answers.length
  const choose = (option: string | null) => {
    if (picked !== null) return
    setPicked(option ?? '')
    // Hiện đúng sai một chút rồi sang câu sau.
    setTimeout(() => onAnswer(option === q.answer), option === null ? 150 : 650)
  }
  return (
    <>
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-muted">
          <span>Dải từ {PLACEMENT_BANDS[phase.band].label}</span>
          <span>
            Câu {phase.index + 1}/{phase.questions[phase.band].length} · đã làm {done}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((phase.band * PER_BAND + phase.index) / (PLACEMENT_BANDS.length * PER_BAND)) * 100}%` }} />
        </div>
      </div>
      <Card>
        <div className="flex flex-col items-center gap-1 py-3 text-center">
          <p className="text-[2rem] leading-tight font-extrabold break-words">{q.term}</p>
          <p className="text-sm text-muted">{POS_LABEL[q.partOfSpeech]}</p>
          <div className="mt-2">
            <SpeakButtons text={q.term} size="sm" />
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-2">
        {q.options.map((o) => {
          const right = picked !== null && o === q.answer
          const wrong = picked === o && o !== q.answer
          return (
            <button
              key={o}
              type="button"
              disabled={picked !== null}
              onClick={() => choose(o)}
              className={`min-h-12 rounded-2xl border-2 px-4 py-2.5 text-left text-[0.9375rem] font-semibold transition-colors ${
                right ? 'border-accent bg-accent-soft text-accent' : wrong ? 'border-danger bg-danger-soft text-danger' : 'border-line bg-surface'
              }`}
            >
              {o}
            </button>
          )
        })}
        <button type="button" disabled={picked !== null} onClick={() => choose(null)} className="h-11 text-sm font-semibold text-muted">
          Không biết
        </button>
      </div>
    </>
  )
}

function ResultView({ result, starter, fromWelcome, onRetry }: { result: PlacementResult; starter: string[]; fromWelcome: boolean; onRetry: () => void }) {
  const navigate = useNavigate()
  const profile = useProfile()
  const lib = useLibrary()
  const level = SELF_LEVELS.find((l) => l.value === result.level)!
  const daily = suggestDailyNew(result.level, profile?.dailyMinutes ?? 15)
  const known = knownBands(result)
  const [chosen, setChosen] = useState<number[]>(known)
  const [marked, setMarked] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  // Từ của bộ 1.000 từ (đã có trong sổ tay, chưa học) thuộc các dải đã chọn.
  const keys = new Set(chosen.flatMap((b) => starter.slice(PLACEMENT_BANDS[b].ranks![0] - 1, PLACEMENT_BANDS[b].ranks![1]).map(termKey)))
  const candidates = lib ? lib.items.filter((i) => i.source === deck.source && !i.archived && keys.has(termKey(i.term)) && !liveCard(lib.cards.get(i.id))) : []
  const hasDeck = !!lib?.items.some((i) => i.source === deck.source)

  async function mark() {
    setBusy(true)
    try {
      if (!hasDeck) await repo.addStarterDeck(deck.name, await deck.load())
      // Đọc lại sổ tay sau khi thêm bộ: từ mới thêm chưa có trong `candidates`.
      const items = hasDeck ? candidates : (await db.vocabItems.toArray()).filter((i) => i.deletedAt === null && i.source === deck.source && keys.has(termKey(i.term)))
      const ids = await repo.markKnown(items.map((i) => i.id))
      setMarked(ids)
      showToast(`Đã đánh dấu ${num.format(ids.length)} từ là đã biết`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <p className="text-sm text-muted">Vốn từ ước lượng</p>
        <p className="text-[1.75rem] leading-tight font-extrabold">khoảng {num.format(result.estimate)} từ</p>
        <p className="mt-1 text-[0.9375rem]">
          Trình độ gợi ý: <b>{level.label}</b> <span className="text-muted">({level.hint})</span>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {result.bands.map((b) => (
            <li key={b.label} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0 text-muted">{b.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${b.asked ? (b.correct / b.asked) * 100 : 0}%` }} />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums">{b.asked ? `${b.correct}/${b.asked}` : '—'}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-subtle">Ước lượng từ vài câu mỗi dải nên chỉ để tham khảo. Dải có dấu — là dải chưa làm vì bài đã dừng sớm.</p>
        <div className="mt-3 flex flex-col gap-2">
          {profile?.selfLevel === result.level ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Check aria-hidden className="h-4 w-4" /> Trình độ trong hồ sơ đã là {level.label}
            </p>
          ) : (
            <Button variant="primary" onClick={() => void updateProfile({ selfLevel: result.level }).then(() => showToast('Đã đổi trình độ trong hồ sơ'))}>
              Dùng trình độ này
            </Button>
          )}
          {profile?.dailyNewWords === daily ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Check aria-hidden className="h-4 w-4" /> Đang học {daily} từ mới mỗi ngày, vừa với trình độ và thời gian học
            </p>
          ) : (
            <Button onClick={() => void updateProfile({ dailyNewWords: daily }).then(() => showToast(`Mỗi ngày ${daily} từ mới`))}>
              Đặt {daily} từ mới mỗi ngày
            </Button>
          )}
          <p className="text-xs leading-relaxed text-subtle">Gợi ý {daily} từ mới mỗi ngày theo trình độ và {profile?.dailyMinutes ?? 15} phút học mỗi ngày bạn đặt.</p>
        </div>
      </Card>

      {known.length > 0 && (
        <Card>
          <SectionTitle>Bỏ qua từ đã biết</SectionTitle>
          {marked ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed">
                Đã đánh dấu {num.format(marked.length)} từ trong bộ “{deck.name}” là đã biết: chúng không vào buổi học từ mới, vài ngày sau mới ôn lại để chắc.
              </p>
              {marked.length > 0 && (
                <Button
                  icon={RotateCcw}
                  onClick={async () => {
                    await repo.resetProgress(marked)
                    setMarked(null)
                    showToast('Đã hoàn tác')
                  }}
                >
                  Hoàn tác
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed text-muted">Bạn trả lời đúng gần hết các dải dưới đây trong bộ “{deck.name}”. Đánh dấu cả dải là đã biết để khỏi học lại từ đầu:</p>
              {known.map((b) => {
                const on = chosen.includes(b)
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChosen((c) => (on ? c.filter((x) => x !== b) : [...c, b]))}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left text-sm transition-colors ${on ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
                      {on && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 font-semibold">Từ hạng {PLACEMENT_BANDS[b].label}</span>
                    <span className="text-muted">
                      {result.bands[b].correct}/{result.bands[b].asked} đúng
                    </span>
                  </button>
                )
              })}
              <Button variant="primary" disabled={chosen.length === 0 || busy || (hasDeck && candidates.length === 0)} onClick={() => void mark()}>
                {busy
                  ? 'Đang đánh dấu…'
                  : hasDeck
                    ? candidates.length > 0
                      ? `Đánh dấu ${num.format(candidates.length)} từ là đã biết`
                      : 'Các từ này đã được học'
                    : `Thêm bộ “${deck.name}” và đánh dấu đã biết`}
              </Button>
              <p className="text-xs leading-relaxed text-subtle">Chỉ đánh dấu từ chưa học. Muốn học lại một từ thì mở từ đó, bấm “Học lại từ đầu”.</p>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {fromWelcome ? (
          <Button variant="primary" onClick={() => navigate('/welcome', { replace: true, state: { step: 2 } })}>
            Tiếp tục thiết lập
          </Button>
        ) : (
          <Button onClick={() => navigate('/me')}>Xong</Button>
        )}
        <Button variant="ghost" icon={RotateCcw} onClick={onRetry}>
          Làm lại bài kiểm tra
        </Button>
      </div>
    </>
  )
}
