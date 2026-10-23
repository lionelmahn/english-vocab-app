import { useLiveQuery } from 'dexie-react-hooks'
import { FileUp, Flame, GraduationCap, Layers, Play, Plus, Repeat, Sparkles, Target, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { formatDueIn } from '../lib/format'
import { ProgressRing } from '../components/ProgressRing'
import { Button, Card, EmptyState, Page } from '../components/ui'
import { currentStreak, studyDay } from '../core/day'
import { progress } from '../core/session'
import { db } from '../db/db'
import { dueCount, learnCandidates, nextDueAt } from '../db/library'
import { useLibrary, useNow } from '../lib/hooks'
import { riseIn } from '../lib/motion'
import { useSettings } from '../lib/settings'

function greeting(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

function Stat({ icon: Icon, label, value, tone = 'accent' }: { icon: LucideIcon; label: string; value: number; tone?: 'accent' | 'warning' }) {
  const toneClass = tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent'
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <div className="flex flex-1 items-baseline justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <AnimatedNumber value={value} className="text-[17px] font-bold tabular-nums" />
      </div>
    </div>
  )
}

/** Kế hoạch hôm nay (R9.1): từ cần ôn, từ mới, tiến độ mục tiêu, chuỗi ngày. */
export function TodayPage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const now = useNow()
  const [mountedAt] = useState(() => new Date())
  const lib = useLibrary()
  const active = useLiveQuery(async () => (await db.studySessions.where('status').equals('active').toArray()).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null, [], null)
  const activity = useLiveQuery(
    async () => {
      const logs = await db.reviewLogs.toArray()
      const today = studyDay(new Date(), TZ)
      const days = new Set<string>()
      const learned = new Set<string>()
      const reviewed = new Set<string>()
      for (const l of logs) {
        const d = studyDay(new Date(l.reviewedAt), TZ)
        days.add(d)
        if (d !== today || !l.affectsSchedule) continue
        if (l.mode === 'learn') learned.add(l.itemId)
        else if (l.mode === 'review') reviewed.add(l.itemId)
      }
      return { learnedToday: learned.size, reviewedToday: reviewed.size, streak: currentStreak(days, today) }
    },
    [],
    { learnedToday: 0, reviewedToday: 0, streak: 0 },
  )

  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(mountedAt)
  const due = lib ? dueCount(lib, now) : 0
  const newAvailable = lib ? learnCandidates(lib).length : 0
  const nextDue = lib ? nextDueAt(lib, now) : null
  const goal = settings.dailyNewWords
  const activeProgress = active ? progress(active.plan) : null
  const empty = lib && lib.items.length === 0

  return (
    <Page title={greeting(mountedAt.getHours())} subtitle={date.charAt(0).toUpperCase() + date.slice(1)}>
      <Card>
        <div className="flex items-center gap-5">
          <ProgressRing value={activity.learnedToday / Math.max(1, goal)}>
            <AnimatedNumber value={activity.learnedToday} className="text-[28px] leading-none font-bold tabular-nums" />
            <span className="mt-1 text-xs text-muted">/ {goal} từ mới</span>
          </ProgressRing>
          <div className="flex flex-1 flex-col gap-3">
            <Stat icon={Layers} label="Đến hạn ôn" value={due} tone={due > 0 ? 'warning' : 'accent'} />
            <Stat icon={Target} label="Đã ôn hôm nay" value={activity.reviewedToday} />
            <Stat icon={Flame} label="Chuỗi ngày" value={activity.streak} tone="warning" />
          </div>
        </div>
      </Card>

      {active && activeProgress && (
        <Card className="border-accent">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">Buổi {active.mode === 'learn' ? 'học' : 'ôn'} đang dở</p>
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

      {empty ? (
        <EmptyState icon={Sparkles} title="Bắt đầu với từ đầu tiên" body="Thêm từ vào sổ tay hoặc nhập danh sách bạn đang có. Lịch ôn sẽ tự sắp xếp thời điểm ôn cho từng từ.">
          <Button variant="primary" icon={Plus} onClick={() => navigate('/words/new')}>
            Thêm từ
          </Button>
          <Button icon={FileUp} onClick={() => navigate('/import')}>
            Nhập từ file Excel/CSV
          </Button>
        </EmptyState>
      ) : (
        lib && (
          <motion.div variants={riseIn} className="flex flex-col gap-2.5">
            {due > 0 && (
              <Button variant="primary" icon={Repeat} className="h-14 w-full text-[16px]" onClick={() => navigate('/review')}>
                Ôn tập ngay · {due} từ
              </Button>
            )}
            {newAvailable > 0 && (
              <Button variant={due > 0 ? 'secondary' : 'primary'} icon={GraduationCap} className="h-14 w-full text-[16px]" onClick={() => navigate('/learn')}>
                Học từ mới · còn {newAvailable} từ
              </Button>
            )}
            {due === 0 && newAvailable === 0 && (
              <Card className="flex flex-col items-center py-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }} className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
                  <Sparkles aria-hidden className="h-7 w-7 text-accent" />
                </motion.div>
                <p className="font-semibold">Hôm nay xong rồi!</p>
                <p className="mt-1 text-sm text-muted">{nextDue ? `Lượt ôn tiếp theo: ${formatDueIn(nextDue, now)}.` : 'Thêm từ mới để tiếp tục học.'}</p>
                <Button className="mt-4" icon={Plus} onClick={() => navigate('/words/new')}>
                  Thêm từ
                </Button>
              </Card>
            )}
            {due === 0 && newAvailable > 0 && nextDue && <p className="text-center text-sm text-muted">Chưa có từ đến hạn. Lượt ôn tiếp theo: {formatDueIn(nextDue, now)}.</p>}
          </motion.div>
        )
      )}
    </Page>
  )
}
