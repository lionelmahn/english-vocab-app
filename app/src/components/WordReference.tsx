import { Check, ChevronDown, RotateCcw, Shuffle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { COLLOCATION_KIND_LABEL, confusableQuiz, plainSentence, splitMarked, type Collocation, type ConfusableGroup } from '../core/reference'
import { termKey } from '../core/vocab'
import type { VocabItem } from '../db/types'
import { useAiOn, useAiRun } from '../lib/useAi'
import { useConfusablesOf, useWordReference } from '../lib/useReference'
import { cachedCollocations, cachedConfusables, suggestCollocations, suggestConfusables, wordRefOf } from '../services/aiTasks'
import { AiErrorText, AiLink, AiNote } from './AiAssist'
import { SpeakButtons } from './kit'
import { Card, SectionTitle } from './ui'

/** Câu có [từ]: in đậm từ đó, hoặc thay bằng chỗ trống khi làm bài. */
export function MarkedSentence({ text, blank = false }: { text: string; blank?: boolean }) {
  const { before, form, after } = splitMarked(text)
  if (!form) return <>{text}</>
  return (
    <>
      {before}
      {blank ? (
        <span className="inline-block min-w-14 border-b-2 border-accent align-baseline" aria-label="chỗ trống">
          &nbsp;
        </span>
      ) : (
        <b className="font-semibold text-accent">{form}</b>
      )}
      {after}
    </>
  )
}

export function CollocationList({ items }: { items: readonly Collocation[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => (
        <li key={c.en} className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <p>
              <b className="text-[0.9375rem] font-semibold">{c.en}</b> <span className="text-xs text-subtle">· {COLLOCATION_KIND_LABEL[c.kind]}</span>
            </p>
            <p className="text-muted">{c.vi}</p>
            {c.ex && (
              <p className="mt-1">
                {c.ex}
                {c.exVi && <span className="block text-muted italic">{c.exVi}</span>}
              </p>
            )}
          </div>
          {c.ex && <SpeakButtons text={c.ex} size="sm" slow={false} />}
        </li>
      ))}
    </ul>
  )
}

/** Kết hợp từ (R7.4): soạn sẵn cho bộ 1.000 từ; từ khác thì hỏi AI (nếu bật). */
export function CollocationsCard({ item }: { item: VocabItem }) {
  const ref = useWordReference(item.term)
  const aiOn = useAiOn()
  const ai = useAiRun<Collocation[]>()
  const [cached, setCached] = useState<Collocation[] | null>(null)
  const needAi = ref === null && aiOn

  useEffect(() => {
    if (!needAi) return
    let cancelled = false
    void cachedCollocations(wordRefOf(item)).then((c) => !cancelled && setCached(c))
    return () => {
      cancelled = true
    }
  }, [needAi, item])

  if (ref === undefined || (ref === null && !aiOn)) return null
  const shown = ref?.collocations.length ? ref.collocations : (ai.result ?? cached)
  return (
    <Card>
      <SectionTitle>Kết hợp từ</SectionTitle>
      {shown && shown.length > 0 ? <CollocationList items={shown} /> : <p className="text-sm text-muted">Cụm từ hay đi cùng, giới từ và mẫu câu của từ này.</p>}
      {!ref?.collocations.length && (
        <div className="mt-2 flex flex-col gap-1">
          <AiErrorText message={ai.error} />
          {shown ? (
            <AiNote>Do AI gợi ý, có thể chưa chuẩn.</AiNote>
          ) : (
            <div>
              <AiLink busy={ai.busy} onClick={() => void ai.run(async () => (await suggestCollocations(wordRefOf(item))).data)}>
                Gợi ý kết hợp từ bằng AI
              </AiLink>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/** Bài thử nhanh: câu có chỗ trống, chọn từ đúng trong nhóm. Đang làm thì ẩn phần cách dùng (vì có sẵn đáp án). */
export function ConfusableQuiz({ group, onClose }: { group: ConfusableGroup; onClose: () => void }) {
  const [questions, setQuestions] = useState(() => confusableQuiz(group))
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  if (questions.length === 0) return null

  if (index >= questions.length) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl bg-surface-2 p-3">
        <p className="text-sm font-semibold">
          Đúng {score}/{questions.length} câu.
        </p>
        <button
          type="button"
          onClick={() => {
            setQuestions(confusableQuiz(group))
            setIndex(0)
            setScore(0)
            setPicked(null)
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
        >
          <RotateCcw aria-hidden className="h-4 w-4" /> Làm lại
        </button>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-accent">
          Xem lại cách dùng
        </button>
      </div>
    )
  }

  const q = questions[index]
  const done = picked !== null
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">
          Câu {index + 1}/{questions.length}: chọn từ đúng
        </p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-muted">
          Dừng
        </button>
      </div>
      <p className="text-[0.9375rem] leading-relaxed">
        <MarkedSentence text={q.sentence} blank={!done} />
      </p>
      <div className="flex flex-wrap gap-2">
        {q.options.map((o) => {
          const right = done && (o === q.answer || (o === picked && q.accept.includes(o)))
          const wrong = done && o === picked && !q.accept.includes(o)
          return (
            <button
              key={o}
              type="button"
              disabled={done}
              onClick={() => {
                setPicked(o)
                if (q.accept.includes(o)) setScore((s) => s + 1)
              }}
              className={`inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                right ? 'border-accent bg-accent-soft text-accent' : wrong ? 'border-danger bg-danger-soft text-danger' : 'border-line bg-surface text-text'
              }`}
            >
              {right && <Check aria-hidden className="h-4 w-4" />}
              {wrong && <X aria-hidden className="h-4 w-4" />}
              {o}
            </button>
          )
        })}
      </div>
      {done && (
        <div className="flex flex-col gap-2">
          {picked !== q.answer && q.accept.includes(picked) && (
            <p className="text-sm">
              “{picked}” cũng đúng ở câu này; câu mẫu dùng “{q.answer}”.
            </p>
          )}
          <p className="text-sm text-muted italic">{q.vi}</p>
          <div>
            <button
              type="button"
              onClick={() => {
                setPicked(null)
                setIndex((i) => i + 1)
              }}
              className="text-sm font-semibold text-accent"
            >
              {index + 1 < questions.length ? 'Câu tiếp' : 'Xem kết quả'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Một nhóm từ dễ nhầm: cách phân biệt, nghĩa, cách dùng, ví dụ của từng từ và bài thử nhanh. */
export function ConfusableGroupView({ group, highlight, defaultOpen = false }: { group: ConfusableGroup; highlight?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [quiz, setQuiz] = useState(false)
  const key = highlight ? termKey(highlight) : ''
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold">
            {group.words.map((w, i) => (
              <span key={w}>
                {i > 0 && <span className="text-subtle"> / </span>}
                <span className={termKey(w) === key ? 'text-accent' : ''}>{w}</span>
              </span>
            ))}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-muted">{group.summary}</span>
        </span>
        <ChevronDown aria-hidden className={`mt-1 h-4 w-4 shrink-0 text-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 pt-3">
              {quiz && <ConfusableQuiz group={group} onClose={() => setQuiz(false)} />}
              {!quiz &&
                group.items.map((it) => (
                  <div key={it.word} className="rounded-xl bg-surface px-3 py-2.5 text-sm leading-snug">
                    <p>
                      <b className="text-[0.9375rem] font-semibold">{it.word}</b> <span className="text-muted">· {it.meaning}</span>
                    </p>
                    <p className="mt-1 text-muted">{it.usage}</p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {it.examples.map((e) => (
                        <li key={e.en} className="flex items-start gap-2">
                          <p className="min-w-0 flex-1">
                            <MarkedSentence text={e.en} />
                            <span className="block text-muted italic">{e.vi}</span>
                          </p>
                          <SpeakButtons text={plainSentence(e.en)} size="sm" slow={false} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              {!quiz && (
                <div>
                  <button type="button" onClick={() => setQuiz(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    <Shuffle aria-hidden className="h-4 w-4" /> Thử phân biệt
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Từ dễ nhầm (R7.5): nhóm soạn sẵn có chứa từ này; không có thì hỏi AI (nếu bật). */
export function ConfusablesCard({ item }: { item: VocabItem }) {
  const groups = useConfusablesOf(item.term)
  const aiOn = useAiOn()
  const ai = useAiRun<ConfusableGroup[]>()
  const [cached, setCached] = useState<ConfusableGroup[] | null>(null)
  const needAi = groups !== undefined && groups.length === 0 && aiOn

  useEffect(() => {
    if (!needAi) return
    let cancelled = false
    void cachedConfusables(wordRefOf(item)).then((c) => !cancelled && setCached(c))
    return () => {
      cancelled = true
    }
  }, [needAi, item])

  if (groups === undefined || (groups.length === 0 && !aiOn)) return null
  const fromAi = groups.length === 0
  const shown = fromAi ? (ai.result ?? cached) : groups
  return (
    <Card>
      <SectionTitle>Từ dễ nhầm</SectionTitle>
      {shown && shown.length > 0 && (
        <div className="flex flex-col gap-2">
          {shown.map((g) => (
            <ConfusableGroupView key={g.id} group={g} highlight={item.term} />
          ))}
        </div>
      )}
      {fromAi && (
        <div className={`flex flex-col gap-1 ${shown?.length ? 'mt-2' : ''}`}>
          {shown?.length === 0 && <p className="text-sm text-muted">AI không thấy từ nào người Việt hay nhầm với “{item.term}”.</p>}
          {!shown && <p className="text-sm text-muted">Những từ hay bị nhầm với từ này, cách phân biệt và bài thử nhanh.</p>}
          <AiErrorText message={ai.error} />
          {shown ? (
            shown.length > 0 && <AiNote>Do AI gợi ý, có thể chưa chuẩn.</AiNote>
          ) : (
            <div>
              <AiLink busy={ai.busy} onClick={() => void ai.run(async () => (await suggestConfusables(wordRefOf(item))).data)}>
                Tìm từ dễ nhầm bằng AI
              </AiLink>
            </div>
          )}
        </div>
      )}
      <Link to="/confusables" className="mt-3 inline-block text-sm font-semibold text-accent">
        Xem mọi nhóm từ dễ nhầm
      </Link>
    </Card>
  )
}

/** Trang Tra từ: kết hợp từ và nhóm từ dễ nhầm soạn sẵn của từ vừa tra (không hỏi AI). */
export function LookupReference({ term }: { term: string }) {
  const ref = useWordReference(term)
  const groups = useConfusablesOf(term)
  return (
    <>
      {ref && ref.collocations.length > 0 && (
        <Card>
          <SectionTitle>Kết hợp từ</SectionTitle>
          <CollocationList items={ref.collocations} />
        </Card>
      )}
      {groups && groups.length > 0 && (
        <Card>
          <SectionTitle>Từ dễ nhầm</SectionTitle>
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <ConfusableGroupView key={g.id} group={g} highlight={term} />
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
