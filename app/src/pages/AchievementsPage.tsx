import { useLiveQuery } from 'dexie-react-hooks'
import { Zap } from 'lucide-react'
import { useMemo } from 'react'
import { HelpButton } from '../components/Guide'
import { BackButton } from '../components/kit'
import { Card, Page, SectionTitle } from '../components/ui'
import { badgeStates, describeTier, milestones, XP_RULES, xpTotals, type BadgeState } from '../core/achievements'
import { deviceTimeZone } from '../core/profile'
import { db } from '../db/db'
import { BADGE_ICON } from '../lib/badgeIcons'
import { formatDate } from '../lib/format'
import { useNow } from '../lib/hooks'
import { useProfile } from '../services/profile'

const num = new Intl.NumberFormat('vi-VN')

/** Điểm kinh nghiệm, huy hiệu và các mốc học (R10.6). */
export function AchievementsPage() {
  const profile = useProfile()
  const now = useNow()
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [])
  const tz = profile?.timeZone ?? deviceTimeZone()
  const states = useMemo(() => (logs ? badgeStates(logs, tz) : null), [logs, tz])
  if (!logs || !states) return null
  const xp = xpTotals(logs, now, tz)
  const done = milestones(states)
  const earned = states.reduce((n, s) => n + s.tiers.filter((t) => t.earnedAt !== null).length, 0)
  const all = states.reduce((n, s) => n + s.tiers.length, 0)

  return (
    <Page title="Thành tích" subtitle={`${earned}/${all} huy hiệu`} back={<BackButton fallback="/stats" />} action={<HelpButton topic="stats" />}>
      <Card className="text-center">
        <p className="flex items-center justify-center gap-2 text-[2.5rem] leading-none font-extrabold text-warning">
          <Zap aria-hidden className="h-9 w-9" fill="currentColor" />
          {num.format(xp.total)}
        </p>
        <p className="mt-1 text-sm text-muted">điểm kinh nghiệm (XP)</p>
        <div className="mt-4 grid grid-cols-2 border-t border-line pt-3">
          <div>
            <p className="text-[1.375rem] font-bold tabular-nums">{num.format(xp.today)}</p>
            <p className="text-xs text-muted">hôm nay</p>
          </div>
          <div>
            <p className="text-[1.375rem] font-bold tabular-nums">{num.format(xp.week)}</p>
            <p className="text-xs text-muted">tuần này</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-subtle">
          Mỗi câu đúng +{XP_RULES.correct} XP, đúng nhờ gợi ý +{XP_RULES.hinted}, sai vẫn +{XP_RULES.wrong} vì đã cố gắng; mỗi từ mới học xong thêm +{XP_RULES.newWord}.
        </p>
      </Card>

      <div className="flex flex-col gap-3">
        {states.map((s) => (
          <BadgeCard key={s.def.group} state={s} />
        ))}
      </div>

      <Card>
        <SectionTitle>Mốc học</SectionTitle>
        {done.length === 0 ? (
          <p className="text-sm text-muted">Chưa đạt mốc nào. Học buổi đầu tiên để bắt đầu nhé.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {done.map((m) => {
              const Icon = BADGE_ICON[m.group]
              return (
                <li key={`${m.group}-${m.text}`} className="flex items-center gap-3 text-sm">
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1">{m.text}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{formatDate(m.earnedAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </Page>
  )
}

function BadgeCard({ state }: { state: BadgeState }) {
  const { def, value, tiers } = state
  const Icon = BADGE_ICON[def.group]
  const next = tiers.find((t) => t.earnedAt === null)
  const prev = [...tiers].reverse().find((t) => t.earnedAt !== null)
  const progress = next ? Math.min(1, value / next.target) : 1
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${prev ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-subtle'}`}>
          <Icon aria-hidden className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{def.title}</p>
          <p className="text-[0.8125rem] leading-snug text-muted">{prev ? `Đã đạt: ${describeTier(def, prev.target).toLowerCase()}` : 'Chưa đạt mốc nào'}</p>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Các mốc">
        {tiers.map((t) => (
          <li
            key={t.target}
            title={t.earnedAt ? `Đạt ngày ${formatDate(t.earnedAt)}` : undefined}
            className={`rounded-full px-2.5 py-1 text-[0.75rem] font-semibold tabular-nums ${t.earnedAt ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-subtle'}`}
          >
            {num.format(t.target)}
          </li>
        ))}
      </ul>
      {next && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{describeTier(def, next.target)}</span>
            <span className="tabular-nums">
              {num.format(Math.min(value, next.target))}/{num.format(next.target)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-sun" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
    </Card>
  )
}
