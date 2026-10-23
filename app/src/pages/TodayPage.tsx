import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Layers, Plus, Sparkles, Target, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ProgressRing } from '../components/ProgressRing'
import { Button, Card, EmptyState, Page, PhaseBadge, SectionTitle } from '../components/ui'
import { db } from '../db/db'

function greeting(hour: number): string {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 14) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

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

const UPCOMING = ['Học từ mới bằng flashcard lật thẻ', 'Ôn theo lịch FSRS với 3 dạng bài', 'Nhập danh sách từ từ file Excel/CSV']

export function TodayPage() {
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const stats = useLiveQuery(
    async () => {
      const [words, due] = await Promise.all([db.vocabItems.count(), db.cardStates.where('due').belowOrEqual(Date.now()).count()])
      return { words, due }
    },
    [],
    { words: 0, due: 0 },
  )

  // Mục tiêu và chuỗi ngày sẽ lấy từ hồ sơ và lịch sử học ở giai đoạn 1–2.
  const dailyGoal = 10
  const learnedToday = 0
  const streak = 0
  const date = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  return (
    <Page title={greeting(now.getHours())} subtitle={date.charAt(0).toUpperCase() + date.slice(1)}>
      <Card>
        <div className="flex items-center gap-5">
          <ProgressRing value={learnedToday / dailyGoal}>
            <AnimatedNumber value={learnedToday} className="text-[28px] leading-none font-bold tabular-nums" />
            <span className="mt-1 text-xs text-muted">/ {dailyGoal} từ mới</span>
          </ProgressRing>
          <div className="flex flex-1 flex-col gap-3">
            <Stat icon={Layers} label="Đến hạn ôn" value={stats.due} />
            <Stat icon={Target} label="Trong sổ tay" value={stats.words} />
            <Stat icon={Flame} label="Chuỗi ngày" value={streak} tone="warning" />
          </div>
        </div>
      </Card>

      {stats.words === 0 && (
        <EmptyState
          icon={Sparkles}
          title="Bắt đầu với từ đầu tiên"
          body="Thêm từ vào sổ tay hoặc nhập danh sách bạn đang có. Lịch ôn sẽ tự sắp xếp thời điểm ôn cho từng từ."
        >
          <Button variant="primary" icon={Plus} onClick={() => navigate('/notebook')}>
            Mở sổ tay
          </Button>
        </EmptyState>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="">Sắp có</SectionTitle>
          <PhaseBadge phase={1} />
        </div>
        <ul className="flex flex-col gap-2.5">
          {UPCOMING.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-muted">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  )
}
