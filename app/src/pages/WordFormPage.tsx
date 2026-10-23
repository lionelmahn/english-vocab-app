import { ChevronDown, Flame, Plus, Star, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { BackButton, Chip, Sheet, SpeakButtons, TextArea } from '../components/kit'
import { showToast } from '../lib/toast'
import { Button, Card, Page, SectionTitle, TextField } from '../components/ui'
import { liveCard } from '../core/library'
import { POS_LABEL, POS_ORDER, type PartOfSpeech } from '../core/pos'
import { meaningKey, parseTags, termKey, type DuplicateMatch } from '../core/vocab'
import type { Library } from '../db/library'
import { repo, type ItemInput } from '../db/repo'
import type { Example, VocabItem } from '../db/types'
import { useLibrary } from '../lib/hooks'
import { duration, ease, riseIn } from '../lib/motion'

/** Thêm từ (R2.2) và sửa từ (R2.3). */
export function WordFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const lib = useLibrary()
  if (!lib) return null
  const editing = id ? lib.itemById.get(id) : undefined
  if (id && !editing) {
    return (
      <Page title="Không tìm thấy từ" action={<BackButton fallback="/notebook" />}>
        <p className="text-sm text-muted">Từ này đã bị xóa hoặc không tồn tại.</p>
      </Page>
    )
  }
  const presetDeck = params.get('deck')
  return <WordForm key={editing?.id ?? 'new'} lib={lib} editing={editing} presetDeckIds={presetDeck ? [presetDeck] : []} />
}

interface FormState {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
  meaningEn: string
  ipaUs: string
  ipaUk: string
  examples: Example[]
  note: string
  mnemonic: string
  source: string
  tags: string
  accepted: string
  favorite: boolean
  difficult: boolean
  deckIds: string[]
}

function initialState(editing: VocabItem | undefined, lib: Library, presetDeckIds: string[]): FormState {
  if (!editing) {
    return {
      term: '',
      partOfSpeech: 'noun',
      meaningVi: '',
      meaningEn: '',
      ipaUs: '',
      ipaUk: '',
      examples: [{ en: '', vi: '' }],
      note: '',
      mnemonic: '',
      source: '',
      tags: '',
      accepted: '',
      favorite: false,
      difficult: false,
      deckIds: presetDeckIds.filter((d) => lib.deckById.has(d)),
    }
  }
  return {
    term: editing.term,
    partOfSpeech: editing.partOfSpeech,
    meaningVi: editing.meaningVi,
    meaningEn: editing.meaningEn ?? '',
    ipaUs: editing.ipaUs ?? '',
    ipaUk: editing.ipaUk ?? '',
    examples: editing.examples.length ? editing.examples.map((e) => ({ en: e.en, vi: e.vi ?? '' })) : [{ en: '', vi: '' }],
    note: editing.note ?? '',
    mnemonic: editing.mnemonic ?? '',
    source: editing.source ?? '',
    tags: editing.tags.join(', '),
    accepted: editing.acceptedAnswers.join(', '),
    favorite: editing.favorite,
    difficult: editing.difficult,
    deckIds: [...(lib.members.get(editing.id) ?? [])],
  }
}

function toInput(f: FormState): ItemInput {
  return {
    term: f.term,
    partOfSpeech: f.partOfSpeech,
    meaningVi: f.meaningVi,
    meaningEn: f.meaningEn,
    ipaUs: f.ipaUs,
    ipaUk: f.ipaUk,
    examples: f.examples,
    note: f.note,
    mnemonic: f.mnemonic,
    source: f.source,
    tags: parseTags(f.tags),
    acceptedAnswers: f.accepted.split(/[,;]/),
    favorite: f.favorite,
    difficult: f.difficult,
  }
}

function WordForm({ lib, editing, presetDeckIds }: { lib: Library; editing?: VocabItem; presetDeckIds: string[] }) {
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>(() => initialState(editing, lib, presetDeckIds))
  const [more, setMore] = useState(() => !!editing && !!(editing.meaningEn || editing.note || editing.mnemonic || editing.source || editing.acceptedAnswers.length))
  const [errors, setErrors] = useState<{ term?: string; meaningVi?: string }>({})
  const [sameTerm, setSameTerm] = useState<DuplicateMatch<VocabItem>[] | null>(null)
  const [exact, setExact] = useState<VocabItem | null>(null)
  const [progressAsk, setProgressAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const andNew = useRef(false)
  const termRef = useRef<HTMLInputElement>(null)

  const decks = lib.decks.filter((d) => !d.archived || f.deckIds.includes(d.id))
  const hasProgress = !!editing && !!liveCard(lib.cards.get(editing.id))

  function patch(p: Partial<FormState>) {
    setF((x) => ({ ...x, ...p }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!f.term.trim()) e.term = 'Nhập từ hoặc cụm từ.'
    if (!f.meaningVi.trim()) e.meaningVi = 'Nhập nghĩa tiếng Việt.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function persist(resetProgress = false) {
    setBusy(true)
    try {
      const input = toInput(f)
      if (editing) {
        await repo.updateItem(editing.id, input, { resetProgress, deckIds: f.deckIds })
        showToast(resetProgress ? 'Đã lưu, từ sẽ được học lại từ đầu' : 'Đã lưu thay đổi')
        navigate(`/words/${editing.id}`, { replace: true })
        return
      }
      const id = await repo.createItem(input, f.deckIds)
      showToast(`Đã lưu “${input.term.trim()}”`)
      if (andNew.current) {
        setF((x) => ({ ...initialState(undefined, lib, x.deckIds), partOfSpeech: x.partOfSpeech }))
        setSameTerm(null)
        termRef.current?.focus()
      } else {
        navigate(`/words/${id}`, { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (busy || !validate()) return
    const matches = await repo.duplicatesOf({ term: f.term, partOfSpeech: f.partOfSpeech, meaningVi: f.meaningVi }, editing?.id)
    const exactMatch = matches.find((m) => m.kind === 'exact')
    if (exactMatch) {
      setExact(exactMatch.item)
      return
    }
    if (editing) {
      const coreChanged = termKey(f.term) !== editing.termKey || meaningKey(f.meaningVi) !== meaningKey(editing.meaningVi) || f.partOfSpeech !== editing.partOfSpeech
      if (coreChanged && hasProgress) {
        setProgressAsk(true)
        return
      }
      await persist()
      return
    }
    const others = matches.filter((m) => m.kind === 'same_term')
    if (others.length > 0 && !sameTerm) {
      // Lần bấm đầu: báo đã có từ cùng mặt chữ; bấm lần nữa để lưu thành mục mới.
      setSameTerm(others)
      return
    }
    await persist()
  }

  const exactMissingDecks = exact ? f.deckIds.filter((d) => !lib.members.get(exact.id)?.has(d)) : []

  return (
    <Page title={editing ? 'Sửa từ' : 'Thêm từ'} action={<BackButton fallback={editing ? `/words/${editing.id}` : '/notebook'} />}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <Card>
          <div className="flex flex-col gap-4">
            <TextField
              ref={termRef}
              label="Từ hoặc cụm từ tiếng Anh"
              value={f.term}
              error={errors.term}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="resilient"
              onChange={(e) => {
                patch({ term: e.target.value })
                setErrors((x) => ({ ...x, term: undefined }))
                setSameTerm(null)
              }}
              trailing={f.term.trim() ? <SpeakButtons text={f.term.trim()} size="sm" slow={false} /> : undefined}
            />

            <div>
              <span className="mb-1.5 block text-sm font-medium">Loại từ</span>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {POS_ORDER.map((p) => (
                  <Chip key={p} active={f.partOfSpeech === p} onClick={() => patch({ partOfSpeech: p })}>
                    {POS_LABEL[p]}
                  </Chip>
                ))}
              </div>
            </div>

            <TextField
              label="Nghĩa tiếng Việt"
              value={f.meaningVi}
              error={errors.meaningVi}
              placeholder="kiên cường, mau phục hồi"
              onChange={(e) => {
                patch({ meaningVi: e.target.value })
                setErrors((x) => ({ ...x, meaningVi: undefined }))
                setSameTerm(null)
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <TextField label="Phiên âm Anh–Mỹ" value={f.ipaUs} placeholder="/rɪˈzɪliənt/" onChange={(e) => patch({ ipaUs: e.target.value })} />
              <TextField label="Phiên âm Anh–Anh" value={f.ipaUk} placeholder="/rɪˈzɪliənt/" onChange={(e) => patch({ ipaUk: e.target.value })} />
            </div>
          </div>
        </Card>

        <AnimatePresence>
          {sameTerm && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
              className="rounded-2xl bg-warning-soft px-4 py-3 text-sm leading-relaxed text-warning"
            >
              <p className="font-semibold">Sổ tay đã có “{f.term.trim()}” với nghĩa khác:</p>
              <ul className="mt-1 list-disc pl-5">
                {sameTerm.map((m) => (
                  <li key={m.item.id}>
                    {m.item.meaningVi} <span className="opacity-75">({POS_LABEL[m.item.partOfSpeech].toLowerCase()})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1">Bấm Lưu lần nữa để thêm thành một mục học riêng với nghĩa mới.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <SectionTitle>Câu ví dụ</SectionTitle>
          <div className="flex flex-col gap-3">
            {f.examples.map((ex, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={ex.en}
                    aria-label={`Câu ví dụ ${i + 1}`}
                    placeholder="Children are often more resilient than adults."
                    onChange={(e) => patch({ examples: f.examples.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)) })}
                    className="min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-subtle"
                  />
                  {f.examples.length > 1 && (
                    <button
                      type="button"
                      aria-label="Xóa câu ví dụ"
                      onClick={() => patch({ examples: f.examples.filter((_, j) => j !== i) })}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle"
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input
                  value={ex.vi ?? ''}
                  aria-label={`Dịch câu ví dụ ${i + 1}`}
                  placeholder="Dịch (không bắt buộc)"
                  onChange={(e) => patch({ examples: f.examples.map((x, j) => (j === i ? { ...x, vi: e.target.value } : x)) })}
                  className="border-t border-line pt-2 text-sm text-muted outline-none placeholder:text-subtle"
                />
              </div>
            ))}
            {f.examples.length < 5 && (
              <button type="button" onClick={() => patch({ examples: [...f.examples, { en: '', vi: '' }] })} className="flex items-center gap-1.5 self-start text-sm font-semibold text-accent">
                <Plus aria-hidden className="h-4 w-4" /> Thêm câu ví dụ
              </button>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle>Bộ từ và đánh dấu</SectionTitle>
          {decks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {decks.map((d) => (
                <Chip
                  key={d.id}
                  active={f.deckIds.includes(d.id)}
                  onClick={() => patch({ deckIds: f.deckIds.includes(d.id) ? f.deckIds.filter((x) => x !== d.id) : [...f.deckIds, d.id] })}
                >
                  {d.name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Chưa có bộ từ. Từ không thuộc bộ nào vẫn được học bình thường.</p>
          )}
          <div className="mt-4 flex gap-2">
            <Chip active={f.favorite} onClick={() => patch({ favorite: !f.favorite })}>
              <span className="inline-flex items-center gap-1.5">
                <Star aria-hidden className="h-4 w-4" fill={f.favorite ? 'currentColor' : 'none'} /> Yêu thích
              </span>
            </Chip>
            <Chip active={f.difficult} onClick={() => patch({ difficult: !f.difficult })}>
              <span className="inline-flex items-center gap-1.5">
                <Flame aria-hidden className="h-4 w-4" /> Từ khó
              </span>
            </Chip>
          </div>
          <div className="mt-4">
            <TextField label="Nhãn cá nhân" value={f.tags} placeholder="ielts, công việc" onChange={(e) => patch({ tags: e.target.value })} />
          </div>
        </Card>

        <motion.button type="button" variants={riseIn} onClick={() => setMore((v) => !v)} className="flex items-center justify-center gap-1.5 py-1 text-sm font-semibold text-accent">
          {more ? 'Ẩn bớt' : 'Thêm chi tiết (nghĩa tiếng Anh, ghi chú, mẹo nhớ…)'}
          <motion.span animate={{ rotate: more ? 180 : 0 }} className="flex">
            <ChevronDown aria-hidden className="h-4 w-4" />
          </motion.span>
        </motion.button>

        <AnimatePresence initial={false}>
          {more && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Card>
                <div className="flex flex-col gap-4">
                  <TextField label="Nghĩa tiếng Anh" value={f.meaningEn} placeholder="able to recover quickly" onChange={(e) => patch({ meaningEn: e.target.value })} />
                  <TextArea label="Ghi chú" value={f.note} onChange={(e) => patch({ note: e.target.value })} />
                  <TextArea label="Mẹo nhớ" value={f.mnemonic} onChange={(e) => patch({ mnemonic: e.target.value })} />
                  <TextField label="Nguồn" value={f.source} placeholder="Sách, bài báo, phim…" onChange={(e) => patch({ source: e.target.value })} />
                  <TextField
                    label="Đáp án chấp nhận thêm"
                    value={f.accepted}
                    placeholder="colour, color"
                    autoCapitalize="none"
                    onChange={(e) => patch({ accepted: e.target.value })}
                  />
                  <p className="-mt-2 text-xs text-subtle">Cách viết khác vẫn được chấm đúng khi gõ từ, ví dụ biến thể Anh–Anh/Anh–Mỹ.</p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-2.5 pt-1">
          <Button type="submit" variant="primary" disabled={busy} className="w-full disabled:opacity-70" onClick={() => (andNew.current = false)}>
            {sameTerm ? 'Lưu thành mục mới' : 'Lưu'}
          </Button>
          {!editing && (
            <Button type="submit" disabled={busy} className="w-full disabled:opacity-70" onClick={() => (andNew.current = true)}>
              Lưu và thêm từ khác
            </Button>
          )}
        </div>
      </form>

      <Sheet open={!!exact} onClose={() => setExact(null)} title="Từ này đã có trong sổ tay">
        {exact && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted">
              “{exact.term}” ({POS_LABEL[exact.partOfSpeech].toLowerCase()}) — {exact.meaningVi}. Thêm lần nữa sẽ tạo tiến độ học trùng lặp.
            </p>
            {exactMissingDecks.length > 0 && (
              <Button
                variant="primary"
                onClick={async () => {
                  for (const d of exactMissingDecks) await repo.addToDeck(d, [exact.id])
                  showToast('Đã thêm từ có sẵn vào bộ đã chọn')
                  navigate(`/words/${exact.id}`, { replace: true })
                }}
              >
                Thêm từ có sẵn vào bộ đã chọn
              </Button>
            )}
            <Button variant={exactMissingDecks.length ? 'secondary' : 'primary'} onClick={() => navigate(`/words/${exact.id}`, { replace: true })}>
              Mở từ đã có
            </Button>
            <Button variant="ghost" onClick={() => setExact(null)}>
              Sửa lại
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={progressAsk} onClose={() => setProgressAsk(false)} title="Giữ tiến độ học?">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Bạn đã đổi từ, loại từ hoặc nghĩa chính. Nếu chỉ sửa lỗi gõ, hãy giữ tiến độ. Nếu đây gần như là một từ khác, nên học lại từ đầu.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              setProgressAsk(false)
              void persist(false)
            }}
          >
            Giữ tiến độ
          </Button>
          <Button
            onClick={() => {
              setProgressAsk(false)
              void persist(true)
            }}
          >
            Học lại từ đầu
          </Button>
        </div>
      </Sheet>
    </Page>
  )
}
