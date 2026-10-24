import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpenCheck, FileUp, Flame, GraduationCap, NotebookPen, Play, Plus, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { Buddy } from '../components/Buddy'
import { Button, Card, EmptyState, Page } from '../components/ui'
import { currentStreak, studyDay } from '../core/day'
import { itemLevel } from '../core/library'
import type { MemoryLevel } from '../core/levels'
import { deviceTimeZone, isStudyDay } from '../core/profile'
import { progress } from '../core/session'
import { db } from '../db/db'
import { dueCount, learnCandidates, nextDueAt } from '../db/library'
import { formatDueIn } from '../lib/format'
import { useLibrary, useNow } from '../lib/hooks'
import { riseIn } from '../lib/motion'
import { useSettings } from '../lib/settings'
import { useProfile } from '../services/profile'
import { PillButton } from '../study/ui'

function greeting(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const LEVEL_COLORS: Record<Exclude<MemoryLevel, 0>, string> = {
  1: '#e0714a',
  2: '#ef9f27',
  3: '#a3c74f',
  4: '#2fa883',
  5: '#0f6e56',
}

/** Biểu đồ cột 5 cấp ghi nhớ (R10.7), cột mọc dần lên. */
function LevelBars({ counts }: { counts: Record<Exclude<MemoryLevel, 0>, number> }) {
  const levels = [1, 2, 3, 4, 5] as const
  const max = Math.max(1, ...levels.map((l) => counts[l]))
  return (
    <div className="px-2">
      <div className="flex h-52 items-end justify-between gap-3">
        {levels.map((l, i) => {
          const h = counts[l] === 0 ? 0 : Math.max(0.08, counts[l] / max)
          return (
            <div key={l} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[13px] font-bold whitespace-nowrap text-muted">{counts[l]} từ</span>
              <motion.div
                className="w-full max-w-14 rounded-t-2xl"
                style={{ backgroundColor: LEVEL_COLORS[l] }}
                initial={{ height: 0 }}
                animate={{ height: `${h * 85}%` }}
                transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.08 * i }}
              />
            </div>
          )
        })}
      </div>
      <div className="h-1.5 rounded-full bg-line" />
      <div className="mt-2 flex justify-between gap-3">
        {levels.map((l) => (
          <span key={l} className="flex-1 text-center text-[18px] font-extrabold">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Hôm nay (R9.1): bảng ôn tập — số từ theo cấp, từ đến giờ ôn, học từ mới, chuỗi ngày. */
export function TodayPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const now = useNow()
  const [mountedAt] = useState(() => new Date())
  const lib = useLibrary()
  const profile = useProfile()
  // Ngày học tính theo múi giờ trong hồ sơ (R9.2), để mọi thiết bị đếm chuỗi ngày giống nhau.
  const tz = profile?.timeZone ?? deviceTimeZone()
  const active = useLiveQuery(async () => (await db.studySessions.where('status').equals('active').toArray()).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null, [], null)
  const activity = useLiveQuery(
    async () => {
      const logs = await db.reviewLogs.toArray()
      const today = studyDay(new Date(), tz)
      const days = new Set<string>()
      const learned = new Set<string>()
      for (const l of logs) {
        const d = studyDay(new Date(l.reviewedAt), tz)
        days.add(d)
        if (d === today && l.affectsSchedule && l.mode === 'learn') learned.add(l.itemId)
      }
      return { learnedToday: learned.size, streak: currentStreak(days, today) }
    },
    [tz],
    { learnedToday: 0, streak: 0 },
  )

  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(mountedAt)
  const live = lib?.items.filter((i) => !i.archived) ?? []
  const counts: Record<Exclude<MemoryLevel, 0>, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let notLearned = 0
  for (const i of live) {
    const l = itemLevel(lib!.cards.get(i.id))
    if (l === 0) notLearned++
    else counts[l]++
  }
  const due = lib ? dueCount(lib, now) : 0
  const newAvailable = lib ? learnCandidates(lib).length : 0
  const nextDue = lib ? nextDueAt(lib, now) : null
  const goal = Math.max(1, settings.dailyNewWords)
  const activeProgress = active ? progress(active.plan) : null
  const restDay = !!profile && !isStudyDay(profile.studyWeekdays, new Date(now), tz)

  return (
    <Page
      title={greeting(mountedAt.getHours())}
      subtitle={date.charAt(0).toUpperCase() + date.slice(1) + (restDay ? ' · ngày nghỉ theo lịch học' : '')}
      action={
        <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 shadow-[0_3px_0_0_var(--app-line-shadow)]" aria-label={`Chuỗi ${activity.streak} ngày`}>
          <Flame aria-hidden className={`h-6 w-6 ${activity.streak > 0 ? 'text-[#e0714a]' : 'text-subtle'}`} fill={activity.streak > 0 ? '#f6c344' : 'none'} />
          <AnimatedNumber value={activity.streak} className="text-[20px] font-extrabold tabular-nums" />
        </span>
      }
    >
      {lib && lib.items.length === 0 ? (
        <EmptyState icon={Sparkles} title="Bắt đầu với từ đầu tiên" body="Thêm từ vào sổ tay hoặc nhập danh sách bạn đang có. Lịch ôn sẽ tự sắp xếp thời điểm ôn cho từng từ.">
          <Button variant="primary" icon={Plus} onClick={() => navigate('/words/new')}>
            Thêm từ
          </Button>
          <Button icon={BookOpenCheck} onClick={() => navigate('/decks/starter')}>
            Chọn bộ 1.000 từ thông dụng
          </Button>
          <Button icon={FileUp} onClick={() => navigate('/import')}>
            Nhập từ file Excel/CSV
          </Button>
        </EmptyState>
      ) : (
        lib && (
          <>
            {active && activeProgress && (
              <Card className="border-sun">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold">Buổi {active.mode === 'learn' ? 'học' : 'ôn'} đang dở</p>
                    <p className="text-sm text-muted">
                      Đã làm {activeProgress.done}/{activeProgress.total} bước
                    </p>
                  </div>
                  <Button variant="primary" icon={Play} onClick={() => navigate('/study')}>
                    Tiếp tục
                  </Button>
                </div>
              </Card>
            )}

            <motion.div variants={riseIn} className="flex justify-center">
              <Link to="/notebook" className="flex items-center gap-3 rounded-full bg-surface-2 py-1.5 pr-5 pl-1.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow-[0_3px_0_0_var(--app-line-shadow)]">
                  <NotebookPen aria-hidden className="h-5 w-5 text-[#e0714a]" />
                </span>
                <span className="text-[16px] text-muted">
                  Sổ tay đã có <b className="text-[18px] text-text">{live.length}</b> từ
                </span>
              </Link>
            </motion.div>

            <motion.div variants={riseIn} className="pt-2">
              <LevelBars counts={counts} />
              {notLearned > 0 && <p className="mt-2 text-center text-[13px] text-muted">{notLearned} từ chưa học</p>}
            </motion.div>

            <motion.div variants={riseIn} className="flex flex-col items-center gap-3 pt-2">
              {due > 0 ? (
                <p className="text-[18px] font-bold">
                  Đến giờ ôn tập: <AnimatedNumber value={due} className="text-[22px] font-extrabold text-sun" /> từ
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <Buddy mood="happy" size={44} />
                  <p className="text-[15px] font-semibold text-muted">{nextDue ? `Lượt ôn tiếp theo: ${formatDueIn(nextDue, now)}` : 'Học vài từ mới để bắt đầu ôn tập nhé'}</p>
                </div>
              )}
              <PillButton disabled={due === 0} onClick={() => navigate('/review')}>
                Ôn tập ngay
              </PillButton>
            </motion.div>

            <Card className="mt-2">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Học từ mới</p>
                  <p className="text-sm text-muted">
                    Hôm nay {activity.learnedToday}/{goal} từ · còn {newAvailable} từ chưa học
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#f6c344] to-[var(--app-sun)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(1, activity.learnedToday / goal) * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
                <Button variant={due > 0 ? 'secondary' : 'primary'} icon={GraduationCap} disabled={newAvailable === 0} className="shrink-0 px-4" onClick={() => navigate('/learn')}>
                  Học
                </Button>
              </div>
            </Card>
          </>
        )
      )}
    </Page>
  )
}
