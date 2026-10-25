import { CircleHelp, ChevronRight, Lightbulb } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { guideTopic, type GuideBlock, type GuideTopicId } from '../data/guide'
import { Sheet } from './kit'
import { SectionTitle } from './ui'

/**
 * Nội dung hướng dẫn (R14.3): trang Hướng dẫn và nút "?" mở đúng mục ngay tại màn hình liên quan.
 * Chữ trong “…” là tên nút/mục trên màn hình, in đậm để dễ tìm.
 */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(“[^”]+”)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('“') ? (
          <span key={i} className="font-semibold text-text">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  )
}

function Block({ block }: { block: GuideBlock }) {
  if ('h' in block) return <h3 className="pt-2 text-[0.9375rem] font-bold text-text">{block.h}</h3>
  if ('p' in block)
    return (
      <p>
        <Inline text={block.p} />
      </p>
    )
  if ('tip' in block)
    return (
      <p className="flex gap-2.5 rounded-2xl bg-accent-soft p-3 text-text">
        <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          <Inline text={block.tip} />
        </span>
      </p>
    )
  if ('steps' in block)
    return (
      <ol className="flex flex-col gap-2">
        {block.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.8125rem] font-bold text-accent">{i + 1}</span>
            <span className="pt-0.5">
              <Inline text={s} />
            </span>
          </li>
        ))}
      </ol>
    )
  if ('list' in block)
    return (
      <ul className="flex flex-col gap-1.5">
        {block.list.map((s, i) => (
          <li key={i} className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-subtle" />
            <span>
              <Inline text={s} />
            </span>
          </li>
        ))}
      </ul>
    )
  return (
    <dl className="flex flex-col gap-2.5">
      {block.terms.map((t, i) => (
        <div key={i}>
          <dt className="font-semibold text-text">
            <Inline text={t.term} />
          </dt>
          <dd>
            <Inline text={t.text} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function GuideBody({ blocks }: { blocks: readonly GuideBlock[] }) {
  return (
    <div className="flex flex-col gap-3 text-[0.9375rem] leading-relaxed text-muted">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  )
}

/** Nút "?" nhỏ cạnh tiêu đề: mở mục hướng dẫn tương ứng trong bảng trượt. */
export function HelpButton({ topic, label, className = '' }: { topic: GuideTopicId; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const t = guideTopic(topic)
  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        aria-label={label ?? `Giải thích: ${t.title}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle ${className}`}
      >
        <CircleHelp aria-hidden className="h-[18px] w-[18px]" />
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.title}>
        <div className="-mx-1 max-h-[62vh] overflow-y-auto px-1 pb-2">
          <GuideBody blocks={t.blocks} />
        </div>
        <GuideLink
          onClick={() => {
            setOpen(false)
            navigate('/help')
          }}
        >
          Xem toàn bộ hướng dẫn
        </GuideLink>
      </Sheet>
    </>
  )
}

/** Tiêu đề thẻ kèm nút "?" ở bên phải. */
export function HelpTitle({ topic, children }: { topic: GuideTopicId; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <SectionTitle className="">{children}</SectionTitle>
      <HelpButton topic={topic} className="-my-1.5 -mr-1.5" />
    </div>
  )
}

function GuideLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-1 py-2 text-sm font-semibold text-accent">
      {children}
      <ChevronRight aria-hidden className="h-4 w-4" />
    </button>
  )
}
