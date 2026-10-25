import { BarChart3, Bell, BookOpenCheck, CalendarClock, ChevronRight, CloudCog, Gauge, House, Layers, Plus, Rocket, Search, Target, Volume2, WifiOff, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { GuideBody } from '../components/Guide'
import { BackButton } from '../components/kit'
import { Card, Page } from '../components/ui'
import { GUIDE, GUIDE_GROUPS, searchGuide, type GuideTopicId } from '../data/guide'
import { riseIn } from '../lib/motion'

const ICONS: Record<GuideTopicId, LucideIcon> = {
  start: Rocket,
  'add-words': Plus,
  learn: BookOpenCheck,
  review: Layers,
  schedule: CalendarClock,
  levels: Gauge,
  today: House,
  goals: Target,
  stats: BarChart3,
  reminders: Bell,
  audio: Volume2,
  sync: CloudCog,
  offline: WifiOff,
}

function TopicRow({ id, title, summary, onOpen }: { id: GuideTopicId; title: string; summary: string; onOpen: () => void }) {
  const Icon = ICONS[id]
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-2.5 text-left">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold">{title}</span>
        <span className="block text-[0.8125rem] leading-snug text-muted">{summary}</span>
      </span>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
    </button>
  )
}

/** Trang Hướng dẫn (R14.3): danh sách mục theo nhóm, tìm nhanh không cần gõ dấu. */
export function HelpPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const found = q.trim() ? searchGuide(q) : null

  return (
    <Page title="Hướng dẫn" subtitle="Cách thêm từ, học, ôn và ý nghĩa các con số" back={<BackButton fallback="/me" />}>
      <motion.div variants={riseIn}>
        <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm, ví dụ: cấp ghi nhớ, đồng bộ"
            aria-label="Tìm trong hướng dẫn"
            autoCapitalize="none"
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
        </label>
      </motion.div>

      {found ? (
        <Card>
          {found.length === 0 ? (
            <p className="py-2 text-sm text-muted">Không có mục nào khớp. Thử từ khác, ví dụ “ôn”, “cấp”, “mục tiêu”.</p>
          ) : (
            <div className="divide-y divide-line">
              {found.map((t) => (
                <TopicRow key={t.id} id={t.id} title={t.title} summary={t.summary} onOpen={() => navigate(`/help/${t.id}`)} />
              ))}
            </div>
          )}
        </Card>
      ) : (
        GUIDE_GROUPS.map((g) => (
          <Card key={g.title}>
            <h2 className="mb-1 text-[0.8125rem] font-bold tracking-wide text-subtle uppercase">{g.title}</h2>
            <div className="divide-y divide-line">
              {g.topics.map((id) => {
                const t = GUIDE.find((x) => x.id === id)!
                return <TopicRow key={id} id={id} title={t.title} summary={t.summary} onOpen={() => navigate(`/help/${id}`)} />
              })}
            </div>
          </Card>
        ))
      )}
    </Page>
  )
}

/** Một mục hướng dẫn, kèm nút sang mục kế tiếp. */
export function HelpTopicPage() {
  const { topic = '' } = useParams()
  const navigate = useNavigate()
  const index = GUIDE.findIndex((t) => t.id === topic)
  if (index === -1) {
    return (
      <Page title="Không tìm thấy mục này" back={<BackButton fallback="/help" />}>
        <p className="text-sm text-muted">Mục hướng dẫn này không còn. Quay lại danh sách để chọn mục khác.</p>
      </Page>
    )
  }
  const t = GUIDE[index]
  const next = GUIDE[index + 1]
  return (
    <Page title={t.title} subtitle={t.summary} back={<BackButton fallback="/help" label="Hướng dẫn" />}>
      <Card>
        <GuideBody blocks={t.blocks} />
      </Card>
      {next && (
        <Card>
          <p className="text-[0.75rem] font-semibold text-subtle">Mục tiếp theo</p>
          <TopicRow id={next.id} title={next.title} summary={next.summary} onOpen={() => navigate(`/help/${next.id}`, { replace: true })} />
        </Card>
      )}
    </Page>
  )
}
