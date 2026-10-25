import { Dumbbell, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton, Chip } from '../components/kit'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import { dueCount, studiedItems } from '../db/library'
import { repo } from '../db/repo'
import { useLibrary, useNow } from '../lib/hooks'
import { useSettings } from '../lib/settings'
import { speechAvailable } from '../services/speech'
import { buildPracticePlan, practiceCandidates, type PracticeScope } from '../study/plans'

const COUNTS = [10, 20, 30]

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

  const decks = useMemo(() => (lib ? lib.decks.filter((d) => !d.archived && d.deletedAt === null) : []), [lib])
  if (!lib) return null
  const available = practiceCandidates(lib, scope, now).length
  const size = Math.min(count, available)
  const due = dueCount(lib, now)
  const scopeKey = scope.kind === 'deck' ? scope.deckId : scope.kind

  async function start() {
    if (!lib || starting) return
    setStarting(true)
    const plan = buildPracticePlan(lib, { scope, count, now: Date.now(), style: settings.reviewStyle, audioAvailable: speechAvailable() })
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
              {COUNTS.map((n) => (
                <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                  {n} từ
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Ôn chủ động không làm đổi lịch ôn: kết quả chỉ ghi vào lịch sử bài làm. Trả lời sai thì từ quay lại để bạn luyện thêm.{' '}
              {settings.reviewStyle === 'flashcard' ? 'Kiểu ôn: thẻ tự đánh giá.' : 'Dạng bài chọn theo mức độ nhớ của từng từ.'}
            </p>
          </Card>

          <Button variant="primary" icon={Dumbbell} className="w-full disabled:opacity-70" disabled={size === 0 || starting} onClick={() => void start()}>
            {size > 0 ? `Bắt đầu ôn ${size} từ` : 'Chưa có từ để ôn'}
          </Button>
        </>
      )}
    </Page>
  )
}
