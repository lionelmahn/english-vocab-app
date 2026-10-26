import { Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useSearchParams } from 'react-router'
import { BackButton } from '../components/kit'
import { Page } from '../components/ui'
import { ConfusableGroupView } from '../components/WordReference'
import { searchGroups } from '../core/reference'
import { REFERENCE_ATTRIBUTION } from '../data/reference'
import { riseIn } from '../lib/motion'
import { useConfusables } from '../lib/useReference'

/** Từ dễ nhầm (R7.5): mọi nhóm soạn sẵn, tìm theo từ hoặc nghĩa; mỗi nhóm có cách phân biệt và bài thử nhanh. */
export function ConfusablesPage() {
  const groups = useConfusables()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const list = groups ? searchGroups(groups, q) : []

  return (
    <Page title="Từ dễ nhầm" subtitle="So sánh nghĩa, cách dùng và ví dụ của những từ hay bị nhầm" back={<BackButton fallback="/lookup" />}>
      <motion.label variants={riseIn} className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
        <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
        <input
          value={q}
          onChange={(e) =>
            setParams(e.target.value ? { q: e.target.value } : {}, {
              replace: true,
            })
          }
          placeholder="Tìm từ, ví dụ: borrow"
          aria-label="Tìm nhóm từ dễ nhầm"
          autoCapitalize="none"
          className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
        />
      </motion.label>
      {groups && <p className="text-sm text-muted">{q ? `${list.length} nhóm khớp “${q}”` : `${groups.length} nhóm`}. Chạm một nhóm để xem cách dùng và “Thử phân biệt”.</p>}
      <div className="flex flex-col gap-2">
        {list.map((g) => (
          // Còn đúng một nhóm khớp thì mở sẵn (gắn lại khóa để nhóm mở ra).
          <ConfusableGroupView key={list.length === 1 ? `${g.id}-only` : g.id} group={g} highlight={q} defaultOpen={list.length === 1} />
        ))}
      </div>
      {groups && list.length === 0 && <p className="text-sm text-muted">Không có nhóm nào khớp. Thử gõ một từ tiếng Anh khác.</p>}
      <p className="mt-2 text-xs leading-relaxed text-subtle">{REFERENCE_ATTRIBUTION}</p>
    </Page>
  )
}
