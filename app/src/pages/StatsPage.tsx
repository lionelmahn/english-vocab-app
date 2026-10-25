import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ClipboardCheck, Dumbbell, History, Table2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Segmented } from '../components/kit'
import { HelpButton, HelpTitle } from '../components/Guide'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { studyDay } from '../core/day'
import { itemLevel, itemStatus } from '../core/library'
import { LEVEL_LABELS, type MemoryLevel } from '../core/levels'
import { deviceTimeZone, WEEKDAY_SHORT } from '../core/profile'
import { accuracy, buckets, dailyActivity, lastDays, totals, weekdayOf, weekGoal, type Bucket, type DayActivity, type DayGoalState } from '../core/stats'
import { db } from '../db/db'
import { useLibrary, useNow } from '../lib/hooks'
import { duration, ease } from '../lib/motion'
import { useProfile } from '../services/profile'

const LEVELS: MemoryLevel[] = [0, 1, 2, 3, 4, 5]
const num = new Intl.NumberFormat('vi-VN')

type Range = '7d' | '30d' | '12w'
const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: '12w', label: '12 tuần' },
]

/** "12 phút", "1 giờ 5 phút". */
function formatMinutes(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m} phút`
  return `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}`
}

/** "22/10" */
function shortDate(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(d)}/${Number(m)}`
}

/** Thống kê (R10.1 tổng quan, R10.2 hoạt động, R10.4 mục tiêu, R10.7 cấp ghi nhớ), tính từ lịch sử trả lời. */
export function StatsPage() {
  const lib = useLibrary()
  const profile = useProfile()
  const now = useNow()
  const navigate = useNavigate()
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [])
  const [range, setRange] = useState<Range>('7d')
  const tz = profile?.timeZone ?? deviceTimeZone()
  const activity = useMemo(() => (logs ? dailyActivity(logs, tz) : null), [logs, tz])
  const today = studyDay(new Date(now), tz)

  const live = lib?.items.filter((i) => !i.archived) ?? []
  const dist: Record<MemoryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let notStarted = 0
  let due = 0
  for (const item of live) {
    const card = lib!.cards.get(item.id)
    dist[itemLevel(card)]++
    const status = itemStatus(item, card, now)
    if (status === 'new') notStarted++
    if (status === 'due') due++
  }
  const total = live.length

  return (
    <Page title="Thống kê" subtitle={`${num.format(total)} từ trong sổ tay`} action={<HelpButton topic="stats" label="Giải thích các con số thống kê" />}>
      {/* R10.1 — tổng quan */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Trong sổ tay" value={total} />
        <StatTile label="Chưa học" value={notStarted} />
        <StatTile label="Đang học" value={total - notStarted} hint="đã có lịch ôn" />
        <StatTile label="Đến hạn ôn" value={due} hint="ngay bây giờ" />
      </div>

      {/* R10.4 — mục tiêu */}
      {activity && profile && <GoalsCard activity={activity} today={today} goals={profile} />}

      {/* R10.2 — hoạt động theo kỳ */}
      <Segmented value={range} onChange={setRange} layoutId="stats-range" options={RANGES} />
      {/* key: đổi khoảng thời gian thì bỏ cột đang chọn của khoảng cũ. */}
      {activity && <ActivityCard key={range} activity={activity} today={today} range={range} />}

      {/* R10.7 — cấp ghi nhớ */}
      <Card>
        <HelpTitle topic="levels">Cấp ghi nhớ</HelpTitle>
        <ul className="flex flex-col gap-3">
          {LEVELS.map((level, i) => {
            const pct = total ? dist[level] / total : 0
            return (
              <li key={level}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span>
                    {level > 0 && <span className="mr-1.5 font-semibold text-accent">{level}</span>}
                    <span className={level === 0 ? 'text-muted' : ''}>{LEVEL_LABELS[level]}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{dist[level]}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <motion.div
                    className={`h-full rounded-full ${level === 0 ? 'bg-subtle' : 'bg-accent'}`}
                    style={{ opacity: level === 0 ? 0.5 : 0.35 + level * 0.13 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: duration.slow * 1.5, ease: ease.out, delay: 0.05 * i }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-subtle">Cấp được tính từ độ bền trí nhớ của thuật toán ôn tập, không phải khoảng ôn cố định.</p>
      </Card>

      {/* R5.7, R6.6, R6.8 — ôn chủ động, kiểm tra và lịch sử bài làm */}
      <Card>
        <SectionTitle className="mb-1">Luyện thêm và lịch sử</SectionTitle>
        <p className="mb-3 text-xs text-subtle">Ôn chủ động hoặc tự kiểm tra các từ đã học (không đổi lịch ôn), và xem lại kết quả từng buổi.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button icon={Dumbbell} className="col-span-2 h-11 text-sm" onClick={() => navigate('/practice')}>
            Ôn chủ động
          </Button>
          <Button icon={ClipboardCheck} className="h-11 text-sm" onClick={() => navigate('/test')}>
            Bài kiểm tra
          </Button>
          <Button icon={History} className="h-11 text-sm" onClick={() => navigate('/history')}>
            Lịch sử bài làm
          </Button>
        </div>
      </Card>
    </Page>
  )
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-[0.8125rem] text-muted">{label}</p>
      <p className="mt-0.5 text-[1.625rem] leading-tight font-bold">{typeof value === 'number' ? num.format(value) : value}</p>
      {hint && <p className="text-xs text-subtle">{hint}</p>}
    </Card>
  )
}

// ---- Mục tiêu hôm nay và tuần này (R10.4) ------------------------------------------------------

function Meter({ label, value, goal, unit }: { label: string; value: number; goal: number; unit: string }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : value > 0 ? 1 : 0
  const done = goal > 0 ? value >= goal : value > 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span>
          <span className="font-bold">{num.format(value)}</span>
          <span className="text-muted">
            {' '}
            / {num.format(goal)} {unit}
          </span>
          {done && <Check aria-label="Đạt mục tiêu" className="ml-1 inline h-4 w-4 align-[-3px] text-accent" strokeWidth={3} />}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-accent-soft">
        <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: duration.slow, ease: ease.out }} />
      </div>
    </div>
  )
}

const DAY_STATE: Record<DayGoalState, { label: string; cls: string }> = {
  met: { label: 'Đạt mục tiêu', cls: 'border-accent bg-accent text-on-accent' },
  partial: { label: 'Có học, chưa đủ thời gian', cls: 'border-accent bg-accent-soft text-accent' },
  missed: { label: 'Ngày học nhưng chưa học', cls: 'border-line bg-surface text-subtle' },
  pending: { label: 'Hôm nay, chưa học', cls: 'border-accent border-dashed bg-surface text-accent' },
  rest: { label: 'Ngày nghỉ', cls: 'border-transparent bg-surface-2 text-subtle' },
  future: { label: 'Chưa tới', cls: 'border-transparent bg-surface-2 text-subtle' },
}

function GoalsCard({ activity, today, goals }: { activity: Map<string, DayActivity>; today: string; goals: { dailyNewWords: number; dailyMinutes: number; studyWeekdays: number[] } }) {
  const day = activity.get(today)
  const week = weekGoal(activity, today, goals)
  // Làm tròn xuống: chỉ hiện dấu tích khi học đủ phút thật, khớp với ô hôm nay trong "Tuần này".
  const minutes = Math.floor((day?.timeMs ?? 0) / 60_000)
  return (
    <Card>
      <HelpTitle topic="goals">Mục tiêu hôm nay</HelpTitle>
      <div className="flex flex-col gap-3">
        <Meter label="Từ mới" value={day?.newWords ?? 0} goal={goals.dailyNewWords} unit="từ" />
        <Meter label="Thời gian học" value={minutes} goal={goals.dailyMinutes} unit="phút" />
      </div>
      <div className="mt-5 mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold">Tuần này</p>
        <p className="text-sm text-muted">
          Đạt mục tiêu <b className="text-text">{week.met}</b> ngày · lịch học {week.scheduled} ngày
        </p>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {week.days.map((d) => {
          const s = DAY_STATE[d.state]
          return (
            <li
              key={d.day}
              title={`${WEEKDAY_SHORT[d.weekday]} ${shortDate(d.day)}: ${s.label}`}
              aria-label={`${WEEKDAY_SHORT[d.weekday]} ${shortDate(d.day)}: ${s.label}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 text-[0.8125rem] font-bold ${s.cls}`}
            >
              {d.state === 'met' ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : WEEKDAY_SHORT[d.weekday]}
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        Một ngày đạt mục tiêu khi học đủ {goals.dailyMinutes} phút (gồm cả ôn tập). Thời gian được ước tính từ các lượt trả lời trong buổi học.
      </p>
    </Card>
  )
}

// ---- Hoạt động theo kỳ (R10.2) ---------------------------------------------------------------

const PLOT_H = 132

/** Đỉnh trục tung = 2 × một bước tròn, để cả mốc giữa và mốc đỉnh là số nguyên tròn (0 / 12 / 24, 0 / 25 / 50…). */
function niceMax(max: number): number {
  const half = Math.max(max / 2, 1)
  const pow = 10 ** Math.floor(Math.log10(half))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const step = m * pow
    if (step >= half && Number.isInteger(step)) return step * 2
  }
  return Math.ceil(half) * 2
}

function bucketLabel(b: Bucket, week: boolean): string {
  return week ? `Tuần ${shortDate(b.start)}` : `${WEEKDAY_SHORT[weekdayOf(b.start)]} ${shortDate(b.start)}`
}

function ActivityCard({ activity, today, range }: { activity: Map<string, DayActivity>; today: string; range: Range }) {
  const week = range === '12w'
  const days = lastDays(today, range === '7d' ? 7 : range === '30d' ? 30 : 7 * 12)
  const list = buckets(activity, days, week)
  const prevList = buckets(activity, lastDays(lastDays(days[0], 2)[0], days.length), week)
  const t = totals(list)
  const prev = totals(prevList)
  const answers = t.learnAnswers + t.reviewAnswers
  const acc = accuracy(t.graded, t.correct)
  const [selected, setSelected] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const current = selected !== null && selected < list.length ? selected : list.length - 1
  const sel = list[current]
  const max = niceMax(Math.max(...list.map((b) => b.learnAnswers + b.reviewAnswers), 0))
  const peak = list.reduce((best, b, i) => (b.learnAnswers + b.reviewAnswers > list[best].learnAnswers + list[best].reviewAnswers ? i : best), 0)
  const delta = prev.learnAnswers + prev.reviewAnswers > 0 ? Math.round(((answers - (prev.learnAnswers + prev.reviewAnswers)) / (prev.learnAnswers + prev.reviewAnswers)) * 100) : null
  const labelEvery = list.length <= 7 ? 1 : list.length <= 12 ? 3 : 5

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Lượt trả lời" value={answers} hint={delta === null ? 'kỳ trước chưa có' : `${delta >= 0 ? '+' : ''}${delta}% so với kỳ trước`} />
        <StatTile label="Từ mới đã học" value={t.newWords} />
        <StatTile label="Tỷ lệ đúng" value={acc === null ? '—' : `${Math.round(acc * 100)}%`} hint={t.graded ? `${num.format(t.correct)}/${num.format(t.graded)} câu có chấm` : undefined} />
        <StatTile label="Thời gian học" value={formatMinutes(t.timeMs)} />
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <SectionTitle className="">Lượt trả lời {week ? 'theo tuần' : 'theo ngày'}</SectionTitle>
          <button type="button" onClick={() => setTable((v) => !v)} aria-pressed={table} className="flex items-center gap-1 text-sm font-semibold text-accent">
            <Table2 aria-hidden className="h-4 w-4" /> {table ? 'Biểu đồ' : 'Bảng'}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-chart-review" /> Ôn tập
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-chart-learn" /> Học từ mới
          </span>
        </div>

        {table ? (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-subtle">
                <th className="py-1 font-medium">{week ? 'Tuần' : 'Ngày'}</th>
                <th className="py-1 text-right font-medium">Ôn tập</th>
                <th className="py-1 text-right font-medium">Học mới</th>
                <th className="py-1 text-right font-medium">Đúng</th>
                <th className="py-1 text-right font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...list].reverse().map((b) => {
                const a = accuracy(b.graded, b.correct)
                return (
                  <tr key={b.start} className="border-t border-line">
                    <td className="py-1.5">{bucketLabel(b, week)}</td>
                    <td className="py-1.5 text-right">{b.reviewAnswers}</td>
                    <td className="py-1.5 text-right">{b.learnAnswers}</td>
                    <td className="py-1.5 text-right">{a === null ? '—' : `${Math.round(a * 100)}%`}</td>
                    <td className="py-1.5 text-right">{Math.round(b.timeMs / 60_000)}′</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <>
            {/* Ô đọc số của cột đang chọn (chạm hoặc rê chuột vào cột). */}
            <p className="mt-3 min-h-5 text-sm" aria-live="polite">
              <span className="text-muted">{bucketLabel(sel, week)}: </span>
              <b>{num.format(sel.reviewAnswers)}</b> <span className="text-muted">ôn tập ·</span> <b>{num.format(sel.learnAnswers)}</b> <span className="text-muted">học mới ·</span>{' '}
              <b>{formatMinutes(sel.timeMs)}</b>
            </p>
            <div className="relative mt-2" style={{ height: PLOT_H + 22 }}>
              {/* Lưới ngang mảnh: 0, giữa, đỉnh. */}
              {[0, 0.5, 1].map((f) => (
                <div key={f} className="absolute right-0 left-7 border-t border-line" style={{ top: PLOT_H - f * PLOT_H }}>
                  <span className="absolute -top-2 -left-7 w-6 text-right text-[0.6875rem] leading-none text-subtle tabular-nums">{num.format(Math.round(max * f))}</span>
                </div>
              ))}
              <div className="absolute right-0 bottom-[22px] left-7 flex items-end" style={{ height: PLOT_H }}>
                {list.map((b, i) => {
                  const total = b.learnAnswers + b.reviewAnswers
                  const reviewH = (b.reviewAnswers / max) * PLOT_H
                  const learnH = (b.learnAnswers / max) * PLOT_H
                  const active = i === current
                  return (
                    <button
                      key={b.start}
                      type="button"
                      aria-label={`${bucketLabel(b, week)}: ${b.reviewAnswers} lượt ôn tập, ${b.learnAnswers} lượt học mới, ${formatMinutes(b.timeMs)}`}
                      onPointerEnter={() => setSelected(i)}
                      onFocus={() => setSelected(i)}
                      onClick={() => setSelected(i)}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                    >
                      {/* Số trên đỉnh: chỉ ở cột cao nhất và cột đang chọn. */}
                      {total > 0 && (i === peak || active) && (
                        <span className="mb-0.5 text-[0.6875rem] leading-none font-semibold text-muted tabular-nums">{num.format(total)}</span>
                      )}
                      <span
                        className={`flex w-[min(24px,calc(100%-2px))] flex-col gap-[2px] transition-opacity ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}
                      >
                        {/* Đầu cột bo 4px, chân cột vuông; khe 2px màu nền giữa hai đoạn. */}
                        {b.learnAnswers > 0 && <span className="block rounded-t-[4px] bg-chart-learn" style={{ height: Math.max(2, learnH - 1) }} />}
                        {b.reviewAnswers > 0 && <span className={`block bg-chart-review ${b.learnAnswers > 0 ? '' : 'rounded-t-[4px]'}`} style={{ height: Math.max(2, reviewH - 1) }} />}
                      </span>
                      {active && <span aria-hidden className="absolute -bottom-[3px] h-[3px] w-3 rounded-full bg-text" />}
                    </button>
                  )
                })}
              </div>
              <div className="absolute right-0 bottom-0 left-7 flex">
                {list.map((b, i) => (
                  <span key={b.start} className="flex-1 text-center text-[0.625rem] leading-none text-subtle">
                    {(list.length - 1 - i) % labelEvery === 0 ? (week ? shortDate(b.start) : list.length <= 7 ? WEEKDAY_SHORT[weekdayOf(b.start)] : shortDate(b.start)) : ''}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
