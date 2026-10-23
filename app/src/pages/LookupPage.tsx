import { Search, Volume2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { EmptyState, Page, PhaseBadge } from '../components/ui'
import { duration, ease, riseIn } from '../lib/motion'

export function LookupPage() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(query.trim() || null)
  }

  return (
    <Page title="Tra từ" subtitle="Tra nghĩa, phiên âm và lưu nhanh vào sổ tay" action={<PhaseBadge phase={2} />}>
      <motion.form
        variants={riseIn}
        onSubmit={onSubmit}
        className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent"
      >
        <Search aria-hidden className="h-5 w-5 text-subtle" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSubmitted(null)
          }}
          placeholder="resilient, give up, take care of…"
          aria-label="Từ hoặc cụm từ cần tra"
          enterKeyHint="search"
          autoCapitalize="none"
          className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
        />
      </motion.form>

      <AnimatePresence mode="wait" initial={false}>
        {submitted ? (
          <motion.p
            key="notice"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning"
          >
            Tra từ điển cho “{submitted}” sẽ hoạt động từ giai đoạn 2.
          </motion.p>
        ) : (
          <motion.div key="empty" exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
            <EmptyState
              icon={Volume2}
              title="Tra từ và lưu nhanh"
              body="Xem nghĩa, loại từ, phiên âm Anh–Anh/Anh–Mỹ, nghe phát âm và câu ví dụ, rồi chọn nghĩa để lưu vào bộ từ."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}
