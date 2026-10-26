import { Dumbbell, MessagesSquare, Repeat, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton, Chip } from '../components/kit'
import { AiErrorText } from '../components/AiAssist'
import { Button, Card, EmptyState, Page, SectionTitle, Switch } from '../components/ui'
import { cefrOf } from '../core/ai'
import type { SessionPlan } from '../core/session'
import { dueCount, studiedItems } from '../db/library'
import { repo } from '../db/repo'
import { useLibrary, useNow } from '../lib/hooks'
import { useSettings } from '../lib/settings'
import { useAiOn } from '../lib/useAi'
import { AI_ERROR_TEXT, AiError } from '../services/ai'
import { freshSentences, wordRefOf } from '../services/aiTasks'
import { useProfile } from '../services/profile'
import { speechAvailable } from '../services/speech'
import { buildFreshPracticePlan, buildPracticePlan, pickPractice, practiceCandidates, type PracticeScope } from '../study/plans'

const COUNTS = [10, 20, 30]
/** Bài câu mới (R8.5): mỗi lần hỏi AI tối đa 10 từ. */
const FRESH_COUNTS = [5, 10]

/**
 * Ôn chủ động trước hạn (R5.7): luyện tự do các từ đã học theo phạm vi tự chọn. Khác ôn theo lịch: không làm đổi
 * lịch ôn, kết quả chỉ ghi vào lịch sử. Mở từ trang bộ từ (?deck=) hoặc với các từ đã chọn (state.itemIds).
 */
export function PracticePage() {
  const lib = useLibrary()
  const navigate = useNavigate()
  const settings = useSettings()
  const now = useNow()
  const [params] = useSearchParams()
  const pickedIds = (useLocation().state as { itemIds?: string[] } | null)?.itemIds
  const presetDeck = params.get('deck')
  const [scope, setScope] = useState<PracticeScope>(() =>
    pickedIds?.length ? { kind: 'picked', itemIds: pickedIds } : presetDeck ? { kind: 'deck', deckId: presetDeck } : { kind: 'soon' },
  )
  const [count, setCount] = useState(20)
  const [starting, setStarting] = useState(false)
  const aiOn = useAiOn()
  const profile = useProfile()
  const [freshOn, setFreshOn] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const fresh = aiOn && freshOn

  const decks = useMemo(() => (lib ? lib.decks.filter((d) => !d.archived && d.deletedAt === null) : []), [lib])
  if (!lib) return null
  const available = practiceCandidates(lib, scope, now).length
  const size = Math.min(fresh ? Math.min(count, 10) : count, available)
  const due = dueCount(lib, now)
  const scopeKey = scope.kind === 'deck' ? scope.deckId : scope.kind

  async function start() {
    if (!lib || starting) return
    setStarting(true)
    setAiError(null)
    let plan: SessionPlan | null = null
    if (fresh) {
      // Bài câu mới (R8.5): AI soạn một câu cho mỗi từ; app chỉ dùng câu có đúng chữ cần điền.
      const picked = pickPractice(lib, scope, Math.min(count, 10), Date.now())
      try {
        const { data } = await freshSentences(picked.map(wordRefOf), cefrOf(profile?.selfLevel))
        const contexts = Object.fromEntries(picked.flatMap((it, i) => (data[i] ? [[it.id, data[i]]] : [])))
        plan = buildFreshPracticePlan(lib, picked.map((i) => i.id), contexts, { now: Date.now(), style: settings.reviewStyle, audioAvailable: speechAvailable() })
      } catch (e) {
        setAiError(e instanceof AiError ? AI_ERROR_TEXT[e.code] : AI_ERROR_TEXT.unavailable)
        return setStarting(false)
      }
    } else {
      plan = buildPracticePlan(lib, { scope, count, now: Date.now(), style: settings.reviewStyle, audioAvailable: speechAvailable() })
    }
    if (!plan) return setStarting(false)
    await repo.startSession(plan)
    navigate('/study', { replace: true })
  }

  const scopeNote =
    available === 0
      ? scope.kind === 'soon'
        ? 'Không còn từ nào chưa đến hạn trong phạm vi này.'
        : scope.kind === 'hard'
          ? 'Chưa có từ nào bạn từng quên.'
          : 'Phạm vi này chưa có từ nào đã học.'
      : scope.kind === 'soon'
        ? `${available} từ chưa đến hạn; từ gần đến hạn nhất được ôn trước.`
        : scope.kind === 'hard'
          ? `${available} từ đã quên ít nhất một lần; từ quên nhiều được ôn trước.`
          : scope.kind === 'picked'
            ? `${available} từ đã học trong số ${scope.itemIds.length} từ đã chọn.`
            : `${available} từ đã học trong phạm vi này.`

  return (
    <Page title="Ôn chủ động" subtitle="Luyện thêm các từ đã học, ngoài lịch ôn" back={<BackButton fallback="/" />} action={<HelpButton topic="review" />}>
      {studiedItems(lib).length === 0 ? (
        <EmptyState icon={Dumbbell} title="Chưa có từ để ôn" body="Ôn chủ động dùng các từ bạn đã học. Học vài từ mới trước nhé.">
          <Button variant="primary" onClick={() => navigate('/learn')}>
            Học từ mới
          </Button>
        </EmptyState>
      ) : (
        <>
          {due > 0 && (
            <Card className="border-sun">
              <p className="text-sm leading-snug">
                Có <b>{due}</b> từ đã đến hạn. Ôn theo lịch để lịch ôn được cập nhật; ôn chủ động không đổi lịch.
              </p>
              <Button icon={Repeat} className="mt-3 w-full" onClick={() => navigate('/review')}>
                Ôn tập theo lịch
              </Button>
            </Card>
          )}

          <Card>
            <SectionTitle>Phạm vi</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {pickedIds?.length ? (
                <Chip active={scopeKey === 'picked'} onClick={() => setScope({ kind: 'picked', itemIds: pickedIds })}>
                  Từ đã chọn
                </Chip>
              ) : null}
              <Chip active={scopeKey === 'soon'} onClick={() => setScope({ kind: 'soon' })}>
                Sắp đến hạn
              </Chip>
              <Chip active={scopeKey === 'hard'} onClick={() => setScope({ kind: 'hard' })}>
                Từ hay quên
              </Chip>
              <Chip active={scopeKey === 'all'} onClick={() => setScope({ kind: 'all' })}>
                Mọi từ đã học
              </Chip>
              {decks.map((d) => (
                <Chip key={d.id} active={scopeKey === d.id} onClick={() => setScope({ kind: 'deck', deckId: d.id })}>
                  {d.name}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">{scopeNote}</p>
          </Card>

          <Card>
            <SectionTitle>Số từ</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {(fresh ? FRESH_COUNTS : COUNTS).map((n) => (
                <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                  {n} từ
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Ôn chủ động không làm đổi lịch ôn: kết quả chỉ ghi vào lịch sử bài làm. Trả lời sai thì từ quay lại để bạn luyện thêm.{' '}
              {fresh ? 'Dạng bài: điền từ vào chỗ trống trong câu mới.' : settings.reviewStyle === 'flashcard' ? 'Kiểu ôn: thẻ tự đánh giá.' : 'Dạng bài chọn theo mức độ nhớ của từng từ.'}
            </p>
          </Card>

          {aiOn && (
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-[0.9375rem] font-semibold">
                    <Sparkles aria-hidden className="h-4 w-4 text-accent" /> Câu mới do AI soạn
                  </p>
                  <p className="text-[0.8125rem] leading-snug text-muted">
                    Mỗi từ có một câu mới hợp trình độ của bạn để điền từ vào chỗ trống (chọn từ hoặc gõ từ). App kiểm câu có đúng chữ cần điền trước khi dùng. Tối đa 10 từ một lần.
                  </p>
                </div>
                <Switch
                  label="Câu mới do AI soạn"
                  checked={freshOn}
                  onChange={(v) => {
                    setFreshOn(v)
                    setAiError(null)
                    if (v && count > 10) setCount(10)
                  }}
                />
              </div>
              <AiErrorText message={aiError} />
            </Card>
          )}

          <Button variant="primary" icon={Dumbbell} className="w-full disabled:opacity-70" disabled={size === 0 || starting} onClick={() => void start()}>
            {starting && fresh ? 'AI đang soạn câu… (khoảng 20 giây)' : size > 0 ? `Bắt đầu ôn ${size} từ` : 'Chưa có từ để ôn'}
          </Button>

          {aiOn && (
            <Link to="/chat" className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3.5 active:bg-surface-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <MessagesSquare aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold">Hội thoại luyện từ</span>
                <span className="block text-[0.8125rem] leading-snug text-muted">Đóng vai một tình huống với AI và tập dùng các từ bạn chọn</span>
              </span>
            </Link>
          )}
        </>
      )}
    </Page>
  )
}
