import { ClipboardCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton, Chip } from '../components/kit'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import { TEST_EXERCISES } from '../core/exercises'
import type { ExerciseKind } from '../core/grading'
import { repo } from '../db/repo'
import { useLibrary } from '../lib/hooks'
import { EXERCISE_LABEL } from '../lib/labels'
import { speechAvailable } from '../services/speech'
import { buildTestPlan, testCandidates, type TestScope } from '../study/plans'

const COUNTS = [10, 20, 30, 50]
const MINUTES = [0, 5, 10, 15]
const DEFAULT_KINDS: ExerciseKind[] = ['mcq_meaning', 'cloze_choice', 'recall_typing']

/** Tạo bài kiểm tra tùy chọn (R6.6): phạm vi, dạng bài, số câu, thời gian. Không làm đổi lịch ôn. */
export function TestPage() {
  const lib = useLibrary()
  const navigate = useNavigate()
  const [scope, setScope] = useState<TestScope>({ kind: 'all' })
  const [kinds, setKinds] = useState<ExerciseKind[]>(DEFAULT_KINDS)
  const [count, setCount] = useState(20)
  const [minutes, setMinutes] = useState(0)
  const [starting, setStarting] = useState(false)

  const decks = useMemo(() => (lib ? lib.decks.filter((d) => !d.archived && d.deletedAt === null) : []), [lib])
  if (!lib) return null
  const available = testCandidates(lib, scope).length
  const size = Math.min(count, available)
  const scopeKey = scope.kind === 'deck' ? scope.deckId : scope.kind

  async function start() {
    if (!lib || starting) return
    setStarting(true)
    const plan = buildTestPlan(lib, { scope, kinds, count, timeLimitMs: minutes ? minutes * 60_000 : undefined, audioAvailable: speechAvailable(), now: Date.now() })
    if (!plan) return setStarting(false)
    await repo.startSession(plan)
    navigate('/study', { replace: true })
  }

  return (
    <Page title="Bài kiểm tra" subtitle="Tự chọn phạm vi, dạng bài, số câu và thời gian" back={<BackButton fallback="/stats" />} action={<HelpButton topic="review" />}>
      {studiedCount(lib) === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Chưa có từ để kiểm tra" body="Bài kiểm tra dùng các từ bạn đã học. Học vài từ mới trước nhé.">
          <Button variant="primary" onClick={() => navigate('/learn')}>
            Học từ mới
          </Button>
        </EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle>Phạm vi</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <Chip active={scopeKey === 'all'} onClick={() => setScope({ kind: 'all' })}>
                Mọi từ đã học
              </Chip>
              <Chip active={scopeKey === 'hard'} onClick={() => setScope({ kind: 'hard' })}>
                Từ hay quên
              </Chip>
              {decks.map((d) => (
                <Chip key={d.id} active={scopeKey === d.id} onClick={() => setScope({ kind: 'deck', deckId: d.id })}>
                  {d.name}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">{available > 0 ? `${available} từ đã học trong phạm vi này.` : 'Phạm vi này chưa có từ nào đã học.'}</p>
          </Card>

          <Card>
            <SectionTitle className="mb-1">Dạng bài</SectionTitle>
            <p className="mb-3 text-xs text-subtle">Chọn một hoặc nhiều; mỗi câu lấy ngẫu nhiên một dạng mà từ đó làm được.</p>
            <div className="flex flex-wrap gap-2">
              {TEST_EXERCISES.map((k) => (
                <Chip key={k} active={kinds.includes(k)} onClick={() => setKinds((ks) => (ks.includes(k) ? (ks.length > 1 ? ks.filter((x) => x !== k) : ks) : [...ks, k]))}>
                  {EXERCISE_LABEL[k]}
                </Chip>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Số câu</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((n) => (
                <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                  {n} câu
                </Chip>
              ))}
            </div>
            <SectionTitle className="mt-4 mb-3">Thời gian</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                  {m ? `${m} phút` : 'Không giới hạn'}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">Bài kiểm tra không làm đổi lịch ôn và không có lượt luyện lại. Hết giờ thì các câu chưa làm không tính.</p>
          </Card>

          <Button variant="primary" icon={ClipboardCheck} className="w-full disabled:opacity-70" disabled={size === 0 || starting} onClick={() => void start()}>
            {size > 0 ? `Bắt đầu kiểm tra ${size} câu` : 'Chưa có từ để kiểm tra'}
          </Button>
        </>
      )}
    </Page>
  )
}

function studiedCount(lib: Parameters<typeof testCandidates>[0]): number {
  return testCandidates(lib, { kind: 'all' }).length
}
