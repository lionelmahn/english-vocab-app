import { BookOpen, BookOpenCheck, ChevronRight, Copy, FileUp, Flame, FolderPlus, Plus, Search, SlidersHorizontal, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge, Chip, LevelDots, Segmented, Select, Sheet } from '../components/kit'
import { Button, Card, EmptyState, Page, Switch } from '../components/ui'
import { deckStats, itemLevel, itemStatus, type ItemStatus } from '../core/library'
import { LEVEL_LABELS, type MemoryLevel } from '../core/levels'
import { POS_LABEL, POS_ORDER, POS_SHORT, type PartOfSpeech } from '../core/pos'
import { duplicateGroups, foldText } from '../core/vocab'
import { repo } from '../db/repo'
import type { Library } from '../db/library'
import { useLibrary, useNow } from '../lib/hooks'
import { riseIn } from '../lib/motion'

type View = 'words' | 'decks'
type StatusFilter = 'all' | ItemStatus

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'new', label: 'Chưa học' },
  { value: 'due', label: 'Đến hạn' },
  { value: 'learning', label: 'Đang học' },
  { value: 'review', label: 'Đã học' },
  { value: 'archived', label: 'Lưu trữ' },
]

const PAGE = 100

export function NotebookPage({ view }: { view: View }) {
  const navigate = useNavigate()
  const lib = useLibrary()
  const total = lib?.items.filter((i) => !i.archived).length ?? 0

  return (
    <Page
      title="Sổ tay"
      subtitle={view === 'words' ? `${total} từ` : `${lib?.decks.filter((d) => !d.archived).length ?? 0} bộ từ`}
      action={
        <Button variant="primary" icon={Plus} className="h-10 px-4" onClick={() => navigate(view === 'words' ? '/words/new' : '/decks/new')}>
          {view === 'words' ? 'Thêm từ' : 'Tạo bộ'}
        </Button>
      }
    >
      <motion.div variants={riseIn}>
        <Segmented
          layoutId="notebook-tab"
          value={view}
          onChange={(v) => navigate(v === 'words' ? '/notebook' : '/notebook/decks', { replace: true })}
          options={[
            { value: 'words', label: 'Từ vựng' },
            { value: 'decks', label: 'Bộ từ' },
          ]}
        />
      </motion.div>
      {lib && (view === 'words' ? <WordsView lib={lib} /> : <DecksView lib={lib} />)}
    </Page>
  )
}

// ---- Danh sách từ (R2.1) ---------------------------------------------------------------------

function WordsView({ lib }: { lib: Library }) {
  const navigate = useNavigate()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE)

  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? 'all') as StatusFilter
  const fav = params.get('fav') === '1'
  const hard = params.get('hard') === '1'
  const deck = params.get('deck') ?? ''
  const pos = params.get('pos') ?? ''
  const tag = params.get('tag') ?? ''
  const level = params.get('level') ?? ''

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null || value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  const allTags = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of lib.items) for (const t of i.tags) m.set(t.toLowerCase(), t)
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'vi'))
  }, [lib.items])

  const results = useMemo(() => {
    const needle = foldText(q)
    return lib.items
      .filter((i) => {
        const st = itemStatus(i, lib.cards.get(i.id), now)
        if (status === 'all' ? st === 'archived' : st !== status) return false
        if (fav && !i.favorite) return false
        if (hard && !i.difficult) return false
        if (deck && !lib.members.get(i.id)?.has(deck)) return false
        if (pos && i.partOfSpeech !== pos) return false
        if (tag && !i.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false
        if (level !== '' && itemLevel(lib.cards.get(i.id)) !== Number(level)) return false
        if (needle && !foldText(i.term).includes(needle) && !foldText(i.meaningVi).includes(needle)) return false
        return true
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [lib, now, q, status, fav, hard, deck, pos, tag, level])

  const advancedCount = [deck, pos, tag, level].filter(Boolean).length
  const duplicates = useMemo(() => duplicateGroups(lib.items).length, [lib.items])

  if (lib.items.length === 0) {
    return (
      <EmptyState icon={BookOpen} title="Sổ tay đang trống" body="Thêm từ đầu tiên, hoặc nhập danh sách bạn đang có từ file Excel/CSV.">
        <Button variant="primary" icon={Plus} onClick={() => navigate('/words/new')}>
          Thêm từ
        </Button>
        <Button icon={FileUp} onClick={() => navigate('/import')}>
          Nhập từ file
        </Button>
      </EmptyState>
    )
  }

  return (
    <>
      {duplicates > 0 && (
        <motion.button
          type="button"
          variants={riseIn}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/backup')}
          className="flex items-center gap-3 rounded-2xl bg-warning-soft px-4 py-3 text-left text-sm font-medium text-warning"
        >
          <Copy aria-hidden className="h-5 w-5 shrink-0" />
          <span className="flex-1">{duplicates} từ bị trùng (cùng từ, cùng nghĩa). Chạm để gộp.</span>
          <ChevronRight aria-hidden className="h-5 w-5 shrink-0" />
        </motion.button>
      )}
      <motion.div variants={riseIn} className="flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
          <input
            value={q}
            onChange={(e) => set('q', e.target.value)}
            placeholder="Tìm từ hoặc nghĩa"
            aria-label="Tìm trong sổ tay"
            autoCapitalize="none"
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
        </label>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => setFiltersOpen(true)}
          aria-label="Bộ lọc"
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${advancedCount ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted'}`}
        >
          <SlidersHorizontal aria-hidden className="h-5 w-5" />
          {advancedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] font-bold text-on-accent">
              {advancedCount}
            </span>
          )}
        </motion.button>
      </motion.div>

      <motion.div variants={riseIn} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {STATUS_CHIPS.map((c) => (
          <Chip key={c.value} active={status === c.value} onClick={() => set('status', c.value)}>
            {c.label}
          </Chip>
        ))}
        <Chip active={fav} onClick={() => set('fav', fav ? null : '1')}>
          ★ Yêu thích
        </Chip>
        <Chip active={hard} onClick={() => set('hard', hard ? null : '1')}>
          Từ khó
        </Chip>
      </motion.div>

      {results.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Không có từ nào khớp bộ lọc.</p>
      ) : (
        <Card className="p-1.5">
          <ul>
            {results.slice(0, limit).map((item) => {
              const card = lib.cards.get(item.id)
              const st = itemStatus(item, card, now)
              return (
                <li key={item.id}>
                  <Link to={`/words/${item.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 active:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-1.5 truncate">
                        <span className="font-semibold">{item.term}</span>
                        {POS_SHORT[item.partOfSpeech] && <span className="text-xs text-subtle">{POS_SHORT[item.partOfSpeech]}</span>}
                        {item.favorite && <Star aria-label="Yêu thích" className="h-3.5 w-3.5 shrink-0 self-center text-warning" fill="currentColor" />}
                        {item.difficult && <Flame aria-label="Từ khó" className="h-3.5 w-3.5 shrink-0 self-center text-danger" />}
                      </p>
                      <p className="truncate text-sm text-muted">{item.meaningVi}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {st === 'due' ? <Badge tone="warning">Đến hạn</Badge> : st === 'new' ? <Badge>Chưa học</Badge> : st === 'archived' ? <Badge>Lưu trữ</Badge> : null}
                      {st !== 'new' && st !== 'archived' && <LevelDots level={itemLevel(card)} />}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          {results.length > limit && (
            <button type="button" className="w-full py-3 text-sm font-semibold text-accent" onClick={() => setLimit((l) => l + PAGE)}>
              Hiện thêm ({results.length - limit} từ)
            </button>
          )}
        </Card>
      )}
      <p className="text-center text-xs text-subtle">{results.length} từ</p>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Bộ lọc">
        <div className="flex flex-col gap-3">
          <Select label="Bộ từ" value={deck} onChange={(e) => set('deck', e.target.value)}>
            <option value="">Tất cả</option>
            {lib.decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select label="Loại từ" value={pos} onChange={(e) => set('pos', e.target.value)}>
            <option value="">Tất cả</option>
            {POS_ORDER.map((p) => (
              <option key={p} value={p}>
                {POS_LABEL[p as PartOfSpeech]}
              </option>
            ))}
          </Select>
          <Select label="Nhãn" value={tag} onChange={(e) => set('tag', e.target.value)}>
            <option value="">Tất cả</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select label="Cấp ghi nhớ" value={level} onChange={(e) => set('level', e.target.value)}>
            <option value="">Tất cả</option>
            {([0, 1, 2, 3, 4, 5] as MemoryLevel[]).map((l) => (
              <option key={l} value={l}>
                {l === 0 ? LEVEL_LABELS[0] : `${l} – ${LEVEL_LABELS[l]}`}
              </option>
            ))}
          </Select>
          <div className="mt-2 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const k of ['deck', 'pos', 'tag', 'level']) next.delete(k)
                setParams(next, { replace: true })
              }}
            >
              Xóa bộ lọc
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setFiltersOpen(false)}>
              Xem {results.length} từ
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}

// ---- Danh sách bộ từ (R3.1, R3.6) ----------------------------------------------------------

function DecksView({ lib }: { lib: Library }) {
  const navigate = useNavigate()
  const now = useNow()
  const [showArchived, setShowArchived] = useState(false)
  const visible = lib.decks.filter((d) => showArchived || !d.archived).sort((a, b) => b.createdAt - a.createdAt)
  const looseCount = lib.items.filter((i) => !i.archived && !lib.members.get(i.id)?.size).length
  const archivedCount = lib.decks.filter((d) => d.archived).length

  if (lib.decks.length === 0) {
    return (
      <EmptyState icon={FolderPlus} title="Chưa có bộ từ nào" body="Gom từ theo chủ đề hoặc mục tiêu (IELTS, công việc…). Một từ có thể nằm trong nhiều bộ mà vẫn dùng chung tiến độ.">
        <Button variant="primary" icon={Plus} onClick={() => navigate('/decks/new')}>
          Tạo bộ từ
        </Button>
        <Button icon={BookOpenCheck} onClick={() => navigate('/decks/starter')}>
          Thêm bộ có sẵn (1.000 từ thông dụng)
        </Button>
      </EmptyState>
    )
  }

  return (
    <>
      {visible.map((d) => {
        const s = deckStats(d.id, lib.itemById, lib.members, lib.cards, now)
        const pct = s.total ? s.learned / s.total : 0
        return (
          <Card key={d.id} className={d.archived ? 'opacity-60' : ''}>
            <div className="flex items-start gap-3">
              <Link to={`/decks/${d.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[1rem] font-semibold">{d.name}</p>
                <p className="mt-0.5 text-[0.8125rem] text-muted">
                  {s.total} từ · {s.learned} đã học{s.due > 0 && <span className="font-semibold text-warning"> · {s.due} đến hạn</span>}
                </p>
              </Link>
              {d.archived ? (
                <Badge>Lưu trữ</Badge>
              ) : (
                <Switch label={`Học bộ ${d.name}`} checked={d.active} onChange={(v) => void repo.updateDeck(d.id, { active: v })} />
              )}
            </div>
            <Link to={`/decks/${d.id}`} className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6 }} />
            </Link>
            {!d.active && !d.archived && <p className="mt-2 text-xs text-subtle">Đang tắt: không đưa vào học mới và ôn tập.</p>}
          </Card>
        )
      })}
      <Button icon={BookOpenCheck} className="w-full" onClick={() => navigate('/decks/starter')}>
        Thêm bộ có sẵn
      </Button>
      <p className="px-2 text-center text-xs leading-relaxed text-subtle">
        {looseCount > 0 && `${looseCount} từ chưa thuộc bộ nào (vẫn được học và ôn). `}
        {archivedCount > 0 && (
          <button type="button" className="font-semibold text-accent" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Ẩn bộ đã lưu trữ' : `Hiện ${archivedCount} bộ đã lưu trữ`}
          </button>
        )}
      </p>
    </>
  )
}

