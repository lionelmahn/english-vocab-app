import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardCheck, Dumbbell, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { HelpButton } from '../components/Guide'
import { BackButton, Badge, Chip } from '../components/kit'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import { studyDay } from '../core/day'
import { TEST_EXERCISES } from '../core/exercises'
import { exerciseStats, MIN_EXERCISE_SAMPLES, progressDelta, troubleWords, weakExercises, weeklyAccuracy, type WeekAccuracy } from '../core/insights'
import { deviceTimeZone } from '../core/profile'
import { db } from '../db/db'
import { useLibrary, useNow } from '../lib/hooks'
import { EXERCISE_LABEL } from '../lib/labels'
import { useProfile } from '../services/profile'

const DAY = 86_400_000
type Range = 30 | 90 | 0
const RANGES: { value: Range; label: string }[] = [
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
  { value: 0, label: 'Toàn bộ' },
]

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Phân tích lỗi và điểm yếu (R10.3): từ hay sai, dạng bài còn yếu, mức tiến bộ theo tuần. */
export function InsightsPage() {
  const lib = useLibrary()
  const profile = useProfile()
  const now = useNow()
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [])
  const [range, setRange] = useState<Range>(30)
  const tz = profile?.timeZone ?? deviceTimeZone()
  const since = range ? now - range * DAY : 0

  const words = useMemo(() => (logs ? troubleWords(logs, since).filter((w) => lib?.itemById.has(w.itemId)) : []), [logs, since, lib])
  const stats = useMemo(() => (logs ? exerciseStats(logs, since) : []), [logs, since])
  const weak = new Set(weakExercises(stats).map((s) => s.exercise))
  const weeks = useMemo(() => (logs ? weeklyAccuracy(logs, studyDay(new Date(now), tz), tz, 8) : []), [logs, now, tz])
  if (!lib || !logs) return null

  return (
    <Page title="Điểm yếu và tiến bộ" subtitle="Từ hay sai, dạng bài còn yếu, tỷ lệ đúng theo tuần" back={<BackButton fallback="/stats" />} action={<HelpButton topic="stats" />}>
      {logs.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Chưa có dữ liệu" body="Học và ôn vài buổi, app sẽ cho biết từ nào hay sai và dạng bài nào cần luyện thêm." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Chip key={r.value} active={range === r.value} onClick={() => setRange(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>

          <Card>
            <SectionTitle className="mb-1">Từ hay sai ({words.length})</SectionTitle>
            <p className="mb-3 text-xs text-subtle">Sai từ 2 lần trở lên và chiếm ít nhất 1/4 số lần, hoặc sai ít nhất một nửa số lần. Chỉ tính lần trả lời đầu của mỗi từ trong mỗi buổi.</p>
            {words.length === 0 ? (
              <p className="text-sm text-muted">Không có từ nào hay sai trong khoảng này. Tốt lắm!</p>
            ) : (
              <>
                <ul className="flex flex-col">
                  {words.slice(0, 30).map((w) => {
                    const it = lib.itemById.get(w.itemId)!
                    return (
                      <li key={w.itemId}>
                        <Link to={`/words/${w.itemId}`} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{it.term}</span>
                            <span className="block truncate text-sm text-muted">{it.meaningVi}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-danger tabular-nums">
                            sai {w.wrong}/{w.total}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                {words.length > 30 && <p className="mt-1 text-xs text-subtle">Hiện 30 từ sai nhiều nhất.</p>}
                <Button icon={Dumbbell} className="mt-3 w-full" onClick={() => navigate('/practice', { state: { itemIds: words.slice(0, 30).map((w) => w.itemId) } })}>
                  Ôn chủ động các từ này
                </Button>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle className="mb-1">Theo dạng bài</SectionTitle>
            <p className="mb-3 text-xs text-subtle">
              Tỷ lệ đúng ở lần trả lời đầu. Dạng bài có từ {MIN_EXERCISE_SAMPLES} lượt trở lên mà đúng dưới 70%, hoặc thấp hơn tỷ lệ chung từ 10 điểm, được đánh dấu cần luyện.
            </p>
            {stats.length === 0 ? (
              <p className="text-sm text-muted">Chưa có lượt trả lời nào trong khoảng này.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {stats.map((s) => (
                  <li key={s.exercise}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{EXERCISE_LABEL[s.exercise]}</span>
                        {weak.has(s.exercise) && <Badge tone="warning">Cần luyện</Badge>}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <b>{pct(s.accuracy)}</b> <span className="text-muted">· {s.total} lượt</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${weak.has(s.exercise) ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${s.accuracy * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {[...weak].some((k) => TEST_EXERCISES.includes(k)) && (
              <Button icon={ClipboardCheck} className="mt-4 w-full" onClick={() => navigate('/test', { state: { kinds: [...weak].filter((k) => TEST_EXERCISES.includes(k)) } })}>
                Kiểm tra riêng dạng bài cần luyện
              </Button>
            )}
          </Card>

          <ProgressCard weeks={weeks} />
        </>
      )}
    </Page>
  )
}

const PLOT_H = 96

/** Mức tiến bộ: tỷ lệ đúng 8 tuần gần nhất, so 4 tuần gần đây với 4 tuần trước. */
function ProgressCard({ weeks }: { weeks: WeekAccuracy[] }) {
  const [selected, setSelected] = useState<number | null>(null)
  const p = progressDelta(weeks)
  const lastWithData = weeks.reduce((best, w, i) => (w.accuracy !== null ? i : best), weeks.length - 1)
  const cur = selected ?? lastWithData
  const sel = weeks[cur]
  const label = (w: WeekAccuracy) => {
    const [, m, d] = w.week.split('-')
    return `Tuần ${Number(d)}/${Number(m)}`
  }
  return (
    <Card>
      <SectionTitle className="mb-1">Mức tiến bộ</SectionTitle>
      {p.change !== null ? (
        <p className="flex items-start gap-2 text-sm leading-snug">
          {p.change >= 0 ? <TrendingUp aria-hidden className="mt-px h-4 w-4 shrink-0 text-accent" /> : <TrendingDown aria-hidden className="mt-px h-4 w-4 shrink-0 text-danger" />}
          <span>
            4 tuần gần đây bạn đúng <b>{pct(p.recent!)}</b>, 4 tuần trước <b>{pct(p.before!)}</b> ({p.change >= 0 ? 'tăng' : 'giảm'} {Math.abs(Math.round(p.change * 100))} điểm).
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">Cần có lượt trả lời ở cả 4 tuần gần đây và 4 tuần trước đó để so sánh.</p>
      )}
      <p className="mt-3 min-h-5 text-sm" aria-live="polite">
        <span className="text-muted">{label(sel)}: </span>
        {sel.accuracy === null ? <span className="text-muted">chưa học</span> : <b>{`${pct(sel.accuracy)} đúng · ${sel.total} lượt`}</b>}
      </p>
      <div className="mt-2 flex items-end gap-1.5" style={{ height: PLOT_H }}>
        {weeks.map((w, i) => (
          <button
            key={w.week}
            type="button"
            aria-label={`${label(w)}: ${w.accuracy === null ? 'chưa học' : `${pct(w.accuracy)} đúng`}`}
            aria-pressed={i === cur}
            onClick={() => setSelected(i)}
            onPointerEnter={() => setSelected(i)}
            className="flex h-full flex-1 items-end"
          >
            <span
              className={`w-full rounded-t-[4px] ${w.accuracy === null ? 'bg-line' : i === cur ? 'bg-accent' : 'bg-accent/45'}`}
              style={{ height: w.accuracy === null ? 2 : Math.max(4, w.accuracy * PLOT_H) }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6875rem] text-subtle">
        <span>{label(weeks[0])}</span>
        <span>Tuần này</span>
      </div>
    </Card>
  )
}
