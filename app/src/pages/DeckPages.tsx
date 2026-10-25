import { Archive, ArchiveRestore, Check, Copy, Dumbbell, FolderInput, GraduationCap, Pause, Pencil, Play, Plus, Repeat, Search, Trash, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackButton, Badge, IconButton, LevelDots, Sheet, TextArea } from '../components/kit'
import { showToast } from '../lib/toast'
import { Button, Card, EmptyState, Page, SectionTitle, Switch, TextField } from '../components/ui'
import { deckStats, itemLevel, itemStatus } from '../core/library'
import { POS_SHORT } from '../core/pos'
import { foldText } from '../core/vocab'
import type { Library } from '../db/library'
import { repo } from '../db/repo'
import type { Deck } from '../db/types'
import { useLibrary, useNow } from '../lib/hooks'
import { riseIn } from '../lib/motion'

// ---- Tạo / sửa bộ từ (R3.2, R3.3) ----------------------------------------------------------

export function DeckFormPage() {
  const { id } = useParams()
  const lib = useLibrary()
  if (!lib) return null
  const deck = id ? lib.deckById.get(id) : undefined
  if (id && !deck) return <MissingDeck />
  return <DeckForm key={deck?.id ?? 'new'} deck={deck} />
}

function DeckForm({ deck }: { deck?: Deck }) {
  const navigate = useNavigate()
  const [name, setName] = useState(deck?.name ?? '')
  const [description, setDescription] = useState(deck?.description ?? '')
  const [topic, setTopic] = useState(deck?.topic ?? '')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Đặt tên cho bộ từ.')
      return
    }
    if (deck) {
      await repo.updateDeck(deck.id, { name, description, topic })
      showToast('Đã lưu bộ từ')
      navigate(`/decks/${deck.id}`, { replace: true })
    } else {
      const id = await repo.createDeck({ name, description, topic })
      showToast(`Đã tạo bộ “${name.trim()}”`)
      navigate(`/decks/${id}`, { replace: true })
    }
  }

  return (
    <Page title={deck ? 'Sửa bộ từ' : 'Tạo bộ từ'} back={<BackButton fallback={deck ? `/decks/${deck.id}` : '/notebook/decks'} />}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <Card>
          <div className="flex flex-col gap-4">
            <TextField
              label="Tên bộ từ"
              value={name}
              error={error}
              placeholder="IELTS Writing, Từ vựng công việc…"
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
            />
            <TextField label="Chủ đề" value={topic} placeholder="Môi trường, công nghệ…" onChange={(e) => setTopic(e.target.value)} />
            <TextArea label="Mô tả" value={description} placeholder="Mục tiêu của bộ từ này" onChange={(e) => setDescription(e.target.value)} />
          </div>
        </Card>
        <Button type="submit" variant="primary" className="w-full">
          {deck ? 'Lưu' : 'Tạo bộ từ'}
        </Button>
      </form>
    </Page>
  )
}

function MissingDeck() {
  return (
    <Page title="Không tìm thấy bộ từ" back={<BackButton fallback="/notebook/decks" />}>
      <p className="text-sm text-muted">Bộ từ này đã bị xóa hoặc không tồn tại.</p>
    </Page>
  )
}

// ---- Chi tiết bộ từ (R3.1, R3.3, R3.4, R3.6) -------------------------------------------------

export function DeckDetailPage() {
  const { id = '' } = useParams()
  const lib = useLibrary()
  if (!lib) return null
  const deck = lib.deckById.get(id)
  if (!deck) return <MissingDeck />
  return <DeckDetail key={deck.id} lib={lib} deck={deck} />
}

function DeckDetail({ lib, deck }: { lib: Library; deck: Deck }) {
  const navigate = useNavigate()
  const now = useNow()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)

  const stats = deckStats(deck.id, lib.itemById, lib.members, lib.cards, now)
  const items = useMemo(() => {
    const pos = new Map(lib.deckItems.filter((d) => d.deckId === deck.id).map((d) => [d.itemId, d.position]))
    return lib.items.filter((i) => pos.has(i.id)).sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
  }, [lib, deck.id])
  const otherDecks = lib.decks.filter((d) => d.id !== deck.id && !d.archived)
  // Từ đã học trong số đang chọn: để ôn chủ động hoặc tạm dừng ôn (R5.7, R5.8).
  const selectedCards = [...selected].map((id) => lib.cards.get(id)).filter((c) => !!c)
  const allPaused = selectedCards.length > 0 && selectedCards.every((c) => c.suspended)

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function exitSelect() {
    setSelecting(false)
    setSelected(new Set())
  }

  return (
    <Page
      title={deck.name}
      subtitle={deck.description || deck.topic}
      back={<BackButton fallback="/notebook/decks" />}
      action={<IconButton icon={Pencil} label="Sửa bộ từ" onClick={() => navigate(`/decks/${deck.id}/edit`)} />}
    >
      <Card>
        <div className="grid grid-cols-3 text-center">
          <Stat label="Số từ" value={stats.total} />
          <Stat label="Đã học" value={stats.learned} />
          <Stat label="Đến hạn" value={stats.due} tone={stats.due > 0 ? 'warning' : undefined} />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${stats.total ? (stats.learned / stats.total) * 100 : 0}%` }}
            transition={{ duration: 0.7 }}
          />
        </div>
        {!deck.archived && (
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3">
            <div>
              <p className="text-[0.9375rem] font-medium">Đưa vào kế hoạch học</p>
              <p className="text-[0.8125rem] text-muted">Tắt thì từ chỉ thuộc bộ này sẽ không được học và ôn.</p>
            </div>
            <Switch label="Đưa vào kế hoạch học" checked={deck.active} onChange={(v) => void repo.updateDeck(deck.id, { active: v })} />
          </div>
        )}
      </Card>

      {stats.total > 0 && !deck.archived && (
        <motion.div variants={riseIn} className="grid grid-cols-2 gap-2">
          <Button variant="primary" icon={GraduationCap} disabled={stats.newCount === 0} className="disabled:opacity-50" onClick={() => navigate(`/learn?deck=${deck.id}`)}>
            Học mới ({stats.newCount})
          </Button>
          <Button icon={Repeat} disabled={stats.due === 0} className="disabled:opacity-50" onClick={() => navigate(`/review?deck=${deck.id}`)}>
            Ôn tập ({stats.due})
          </Button>
          {stats.learned > 0 && (
            <Button icon={Dumbbell} className="col-span-2" onClick={() => navigate(`/practice?deck=${deck.id}`)}>
              Ôn chủ động
            </Button>
          )}
        </motion.div>
      )}

      <Card className="p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <SectionTitle className="">Từ trong bộ</SectionTitle>
          {items.length > 0 && (
            <button type="button" className="text-sm font-semibold text-accent" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              {selecting ? 'Xong' : 'Chọn'}
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-2 pb-3 text-sm text-muted">Bộ này chưa có từ nào.</p>
        ) : (
          <ul>
            {items.map((item) => {
              const card = lib.cards.get(item.id)
              const st = itemStatus(item, card, now)
              const isSel = selected.has(item.id)
              const body = (
                <>
                  <AnimatePresence initial={false}>
                    {selecting && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 28, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="flex shrink-0 items-center overflow-hidden"
                      >
                        <span className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 ${isSel ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
                          {isSel && <Check aria-hidden className="h-4 w-4" strokeWidth={3} />}
                        </span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-semibold">{item.term}</span> <span className="text-xs text-subtle">{POS_SHORT[item.partOfSpeech]}</span>
                    </p>
                    <p className="truncate text-sm text-muted">{item.meaningVi}</p>
                  </div>
                  {st === 'due' ? <Badge tone="warning">Đến hạn</Badge> : st === 'new' ? <Badge>Chưa học</Badge> : st === 'archived' ? <Badge>Lưu trữ</Badge> : st === 'suspended' ? <Badge>Tạm dừng</Badge> : <LevelDots level={itemLevel(card)} />}
                </>
              )
              return (
                <li key={item.id}>
                  {selecting ? (
                    <button type="button" onClick={() => toggle(item.id)} aria-pressed={isSel} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-surface-2">
                      {body}
                    </button>
                  ) : (
                    <Link to={`/words/${item.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 active:bg-surface-2">
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <AnimatePresence initial={false} mode="wait">
        {selecting ? (
          <motion.div key="bulk" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="grid grid-cols-2 gap-2">
            <Button
              icon={X}
              disabled={selected.size === 0}
              className="px-2! disabled:opacity-50"
              onClick={async () => {
                await repo.removeFromDeck(deck.id, [...selected])
                showToast(`Đã gỡ ${selected.size} từ khỏi bộ (vẫn còn trong sổ tay)`)
                exitSelect()
              }}
            >
              Gỡ khỏi bộ
            </Button>
            <Button icon={FolderInput} disabled={selected.size === 0 || otherDecks.length === 0} className="px-2! disabled:opacity-50" onClick={() => setMoveOpen(true)}>
              Chuyển / thêm…
            </Button>
            <Button icon={Dumbbell} disabled={selectedCards.length === 0} className="px-2! disabled:opacity-50" onClick={() => navigate('/practice', { state: { itemIds: [...selected] } })}>
              Ôn chủ động
            </Button>
            <Button
              icon={allPaused ? Play : Pause}
              disabled={selectedCards.length === 0}
              className="px-2! disabled:opacity-50"
              onClick={async () => {
                const n = await repo.setSuspended(
                  selectedCards.map((c) => c.id),
                  !allPaused,
                )
                showToast(allPaused ? `Đã bỏ tạm dừng ${n} từ` : `Đã tạm dừng ôn ${n} từ`)
                exitSelect()
              }}
            >
              {allPaused ? 'Bỏ tạm dừng' : 'Tạm dừng ôn'}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="grid grid-cols-2 gap-2">
            <Button icon={Plus} onClick={() => navigate(`/decks/${deck.id}/add`)}>
              Từ có sẵn
            </Button>
            <Button icon={Plus} onClick={() => navigate(`/words/new?deck=${deck.id}`)}>
              Từ mới
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 pt-2">
        <Button
          icon={deck.archived ? ArchiveRestore : Archive}
          className="flex-1"
          onClick={async () => {
            await repo.updateDeck(deck.id, { archived: !deck.archived })
            showToast(deck.archived ? 'Đã khôi phục bộ từ' : 'Đã lưu trữ bộ từ')
          }}
        >
          {deck.archived ? 'Khôi phục' : 'Lưu trữ'}
        </Button>
        <Button icon={Trash} className="flex-1 text-danger" onClick={() => setDeleteOpen(true)}>
          Xóa bộ
        </Button>
      </div>
      {stats.total > 0 && (
        <Button icon={Copy} className="w-full" onClick={() => setCopyOpen(true)}>
          Sao chép bộ từ
        </Button>
      )}

      <Sheet open={copyOpen} onClose={() => setCopyOpen(false)} title={`Sao chép “${deck.name}”?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Tạo bộ mới “{deck.name} (bản sao)” gồm {stats.total} từ theo đúng thứ tự, để bạn thêm, bớt từ hay đổi tên mà không ảnh hưởng bộ gốc. Hai bộ dùng chung các từ, nên tiến độ học là một và sửa nội dung một từ thì đổi ở cả hai bộ.
          </p>
          <Button
            variant="primary"
            icon={Copy}
            onClick={async () => {
              const id = await repo.copyDeck(deck.id)
              setCopyOpen(false)
              if (id) {
                showToast('Đã tạo bản sao')
                navigate(`/decks/${id}`)
              }
            }}
          >
            Tạo bản sao
          </Button>
          <Button onClick={() => setCopyOpen(false)}>Hủy</Button>
        </div>
      </Sheet>

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title={`${selected.size} từ đã chọn`}>
        <p className="mb-3 text-sm text-muted">Chọn bộ đích. Từ dùng chung tiến độ dù nằm trong nhiều bộ.</p>
        <ul className="mb-2 flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
          {otherDecks.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-2 pl-4">
              <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              <Button
                className="h-9 bg-surface px-3 text-sm"
                onClick={async () => {
                  await repo.addToDeck(d.id, [...selected])
                  showToast(`Đã thêm vào “${d.name}”`)
                  setMoveOpen(false)
                  exitSelect()
                }}
              >
                Thêm vào
              </Button>
              <Button
                variant="primary"
                className="h-9 px-3 text-sm"
                onClick={async () => {
                  await repo.moveToDeck(deck.id, d.id, [...selected])
                  showToast(`Đã chuyển sang “${d.name}”`)
                  setMoveOpen(false)
                  exitSelect()
                }}
              >
                Chuyển
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Xóa bộ “${deck.name}”?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            {stats.total > 0 ? `${stats.total} từ trong bộ vẫn còn trong sổ tay và các bộ khác, tiến độ học được giữ nguyên.` : 'Bộ này đang trống.'} Chỉ bộ từ bị xóa.
          </p>
          <Button
            variant="danger"
            onClick={async () => {
              await repo.deleteDeck(deck.id)
              showToast('Đã xóa bộ từ')
              navigate('/notebook/decks', { replace: true })
            }}
          >
            Xóa bộ từ
          </Button>
          <Button onClick={() => setDeleteOpen(false)}>Hủy</Button>
        </div>
      </Sheet>
    </Page>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warning' }) {
  return (
    <div>
      <p className={`text-[1.5rem] font-bold tabular-nums ${tone === 'warning' ? 'text-warning' : ''}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

// ---- Thêm từ có sẵn vào bộ (R3.4) ----------------------------------------------------------

export function DeckAddWordsPage() {
  const { id = '' } = useParams()
  const lib = useLibrary()
  if (!lib) return null
  const deck = lib.deckById.get(id)
  if (!deck) return <MissingDeck />
  return <DeckAddWords lib={lib} deck={deck} />
}

function DeckAddWords({ lib, deck }: { lib: Library; deck: Deck }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const candidates = useMemo(() => {
    const needle = foldText(q)
    return lib.items
      .filter((i) => !i.archived && !lib.members.get(i.id)?.has(deck.id))
      .filter((i) => !needle || foldText(i.term).includes(needle) || foldText(i.meaningVi).includes(needle))
      .sort((a, b) => a.term.localeCompare(b.term, 'en'))
  }, [lib, deck.id, q])

  const allVisibleSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.id))

  return (
    <Page title="Thêm từ vào bộ" subtitle={deck.name} back={<BackButton fallback={`/decks/${deck.id}`} />}>
      {lib.items.length === 0 ? (
        <EmptyState icon={Plus} title="Sổ tay chưa có từ" body="Hãy thêm từ mới trước.">
          <Button variant="primary" onClick={() => navigate(`/words/new?deck=${deck.id}`)}>
            Thêm từ mới
          </Button>
        </EmptyState>
      ) : (
        <>
          <motion.label variants={riseIn} className="flex h-12 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
            <Search aria-hidden className="h-5 w-5 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm từ hoặc nghĩa" aria-label="Tìm từ" className="h-full flex-1 bg-transparent outline-none" />
          </motion.label>
          {candidates.length > 0 && (
            <button
              type="button"
              className="self-end text-sm font-semibold text-accent"
              onClick={() =>
                setSelected((s) => {
                  const n = new Set(s)
                  for (const c of candidates) {
                    if (allVisibleSelected) n.delete(c.id)
                    else n.add(c.id)
                  }
                  return n
                })
              }
            >
              {allVisibleSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${candidates.length})`}
            </button>
          )}
          <Card className="p-1.5">
            {candidates.length === 0 ? (
              <p className="p-3 text-sm text-muted">Không còn từ nào để thêm.</p>
            ) : (
              <ul>
                {candidates.slice(0, 300).map((i) => {
                  const on = selected.has(i.id)
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setSelected((s) => {
                            const n = new Set(s)
                            if (on) n.delete(i.id)
                            else n.add(i.id)
                            return n
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-surface-2"
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${on ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
                          {on && <Check aria-hidden className="h-4 w-4" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{i.term}</span>
                          <span className="block truncate text-sm text-muted">{i.meaningVi}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] pt-2">
            <Button
              variant="primary"
              disabled={selected.size === 0}
              className="w-full shadow-lg disabled:opacity-50"
              onClick={async () => {
                await repo.addToDeck(deck.id, [...selected])
                showToast(`Đã thêm ${selected.size} từ vào “${deck.name}”`)
                navigate(`/decks/${deck.id}`, { replace: true })
              }}
            >
              Thêm {selected.size || ''} từ
            </Button>
          </div>
        </>
      )}
    </Page>
  )
}
