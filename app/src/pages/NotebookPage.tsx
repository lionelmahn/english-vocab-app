import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, FileUp, FolderPlus, Plus, Search, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Card, EmptyState, Page, PhaseBadge } from '../components/ui'
import { normalizeAnswer } from '../core/answers'
import { db } from '../db/db'
import { riseIn } from '../lib/motion'

const UPCOMING: { icon: LucideIcon; label: string }[] = [
  { icon: Plus, label: 'Thêm từ hoặc cụm từ' },
  { icon: FileUp, label: 'Nhập từ file Excel/CSV' },
  { icon: FolderPlus, label: 'Tạo và quản lý bộ từ' },
]

export function NotebookPage() {
  const [query, setQuery] = useState('')
  const key = normalizeAnswer(query)
  const total = useLiveQuery(() => db.vocabItems.count(), [], 0)
  const results = useLiveQuery(
    () => (key ? db.vocabItems.where('termKey').startsWith(key).limit(50).toArray() : db.vocabItems.orderBy('updatedAt').reverse().limit(50).toArray()),
    [key],
    [],
  )

  return (
    <Page title="Sổ tay" subtitle={`${total} từ`}>
      <motion.label variants={riseIn} className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
        <Search aria-hidden className="h-5 w-5 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo từ"
          aria-label="Tìm trong sổ tay"
          className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
        />
      </motion.label>

      {results.length > 0 ? (
        <Card className="p-2">
          <ul>
            {results.map((item) => (
              <li key={item.id} className="rounded-2xl px-3 py-2.5">
                <p className="font-semibold">{item.term}</p>
                <p className="text-sm text-muted">{item.meaningVi}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : total === 0 ? (
        <EmptyState icon={BookOpen} title="Sổ tay đang trống" body="Từ bạn lưu sẽ nằm ở đây, kèm nghĩa, phiên âm, ví dụ và tiến độ ghi nhớ của từng từ." />
      ) : (
        <p className="py-8 text-center text-sm text-muted">Không có từ nào bắt đầu bằng “{query.trim()}”.</p>
      )}

      <Card>
        <ul className="flex flex-col gap-3.5">
          {UPCOMING.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                <Icon aria-hidden className="h-[18px] w-[18px] text-muted" />
              </span>
              <span className="flex-1 text-sm">{label}</span>
              <PhaseBadge phase={1} />
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  )
}
