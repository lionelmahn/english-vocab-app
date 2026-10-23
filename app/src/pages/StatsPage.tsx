import { motion } from 'motion/react'
import { Card, Page, PhaseBadge, SectionTitle } from '../components/ui'
import { itemLevel } from '../core/library'
import { LEVEL_LABELS, type MemoryLevel } from '../core/levels'
import { useLibrary } from '../lib/hooks'
import { duration, ease } from '../lib/motion'

const LEVELS: MemoryLevel[] = [0, 1, 2, 3, 4, 5]

/** Phân bố 5 cấp ghi nhớ (R10.7). Thống kê hoạt động chi tiết ở giai đoạn 2. */
export function StatsPage() {
  const lib = useLibrary()
  const dist: Record<MemoryLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const item of lib?.items ?? []) {
    if (item.archived) continue
    dist[itemLevel(lib!.cards.get(item.id))]++
  }
  const total = LEVELS.reduce<number>((sum, l) => sum + dist[l], 0)

  return (
    <Page title="Thống kê" subtitle={`${total} từ trong sổ tay`}>
      <Card>
        <SectionTitle>Cấp ghi nhớ</SectionTitle>
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

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle className="">Hoạt động theo ngày</SectionTitle>
          <PhaseBadge phase={2} />
        </div>
        <p className="text-sm text-muted">Số lượt học, ôn, tỷ lệ đúng và thời gian học theo tuần, tháng.</p>
      </Card>
    </Page>
  )
}
