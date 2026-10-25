import { BookmarkPlus, Check, ChevronDown, CloudOff, ExternalLink, History, LoaderCircle, Plus, RotateCcw, Search, SearchX, Trash2, Volume2, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Badge, Chip, IpaPill, Sheet, SpeakButtons } from '../components/kit'
import { Button, Card, EmptyState, Page, SectionTitle, TextField } from '../components/ui'
import type { DictEntry, DictGroup, DictSense, Ipa, VietnameseHint } from '../core/dictionary'
import { POS_LABEL } from '../core/pos'
import { termKey } from '../core/vocab'
import type { Library } from '../db/library'
import { db } from '../db/db'
import { repo, type ItemInput } from '../db/repo'
import { useLibrary } from '../lib/hooks'
import { duration, ease, riseIn } from '../lib/motion'
import { showToast } from '../lib/toast'
import { cleanQuery, dictionary, type LookupResult } from '../services/dictionary'
import { speak } from '../services/speech'

/** Số nghĩa hiện sẵn cho mỗi loại từ; còn lại bấm "Xem thêm". */
const SHOWN = 5

/**
 * Chuyển giữa các trạng thái (đang tra, kết quả, không tìm thấy). Dùng nhãn hidden/show giống khung trang,
 * để các thẻ bên trong (variants riseIn) nhận nhãn và hiện lên; dùng đối tượng thì thẻ con kẹt ở "hidden".
 */
const fadeVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: duration.fast, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: duration.fast, ease: ease.out } },
}
const fade = { variants: fadeVariants, initial: 'hidden', animate: 'show', exit: 'exit' } as const

/** Tra từ và cụm từ (R15.1), xem mục từ (R15.2), chọn nghĩa để lưu nhanh (R15.3 → R2.8), xử lý từ không tìm thấy (R15.5). */
export function LookupPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [done, setDone] = useState<{ q: string; attempt: number; result: LookupResult } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const lib = useLibrary()

  useEffect(() => {
    if (!q) return
    let cancelled = false
    void dictionary.lookup(q).then((result) => {
      if (cancelled) return
      setDone({ q, attempt, result })
      // Lịch sử tra (R15.4): ghi khi tra xong, kể cả không tìm thấy; mất mạng hay lỗi thì không ghi.
      if (result.status === 'found' || result.status === 'not_found') void repo.recordLookup(q)
    })
    return () => {
      cancelled = true
    }
  }, [q, attempt])

  function go(term: string) {
    const next = cleanQuery(term)
    setInput(next)
    if (next) setParams({ q: next })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur()
    if (cleanQuery(input) === q) setAttempt((n) => n + 1)
    else go(input)
  }

  const result = done && done.q === q && done.attempt === attempt ? done.result : null
  const view = !q ? 'idle' : !result ? 'loading' : result.status

  return (
    <Page title="Tra từ" subtitle="Tra nghĩa, phiên âm và lưu nhanh vào sổ tay">
      <motion.form variants={riseIn} onSubmit={onSubmit} className="flex gap-2">
        <label className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="resilient, give up, take care of…"
            aria-label="Từ hoặc cụm từ cần tra"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
        </label>
        <Button type="submit" variant="primary" className="h-12 px-4" disabled={!cleanQuery(input)}>
          Tra
        </Button>
      </motion.form>

      {/* popLayout: kết quả hiện ngay, phần cũ mờ dần phía trên thay vì bắt người dùng chờ. */}
      <AnimatePresence mode="popLayout" initial={false}>
        {view === 'idle' && (
          <motion.div key="idle" {...fade}>
            <RecentLookups onLookup={go}>
              <EmptyState
                icon={Volume2}
                title="Tra từ và lưu nhanh"
                body="Xem nghĩa theo loại từ, phiên âm Anh–Mỹ/Anh–Anh, nghe phát âm và câu ví dụ, rồi chọn nghĩa để lưu vào sổ tay."
              />
            </RecentLookups>
          </motion.div>
        )}
        {view === 'loading' && (
          <motion.div key={`loading-${q}`} {...fade} className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
            <LoaderCircle aria-hidden className="h-5 w-5 animate-spin" /> Đang tra “{q}”…
          </motion.div>
        )}
        {result?.status === 'found' && lib && (
          <motion.div key={`found-${result.entry.title}`} {...fade}>
            <EntryView entry={result.entry} lib={lib} onLookup={go} />
          </motion.div>
        )}
        {result?.status === 'not_found' && (
          <motion.div key={`missing-${q}`} {...fade}>
            <NotFound q={q} suggestions={result.suggestions} onLookup={go} />
          </motion.div>
        )}
        {(result?.status === 'offline' || result?.status === 'error') && (
          <motion.div key={`problem-${q}`} {...fade}>
            <Card>
              <div className="flex flex-col items-center gap-3 py-3 text-center">
                <CloudOff aria-hidden className="h-8 w-8 text-subtle" />
                <p className="text-sm leading-relaxed text-muted">
                  {result.status === 'offline' ? 'Đang mất mạng. Từ đã tra trước đây vẫn xem được, từ mới cần có mạng.' : result.message}
                </p>
                <Button icon={RotateCcw} onClick={() => setAttempt((n) => n + 1)}>
                  Thử lại
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

// ---- Lịch sử tra (R15.4) ---------------------------------------------------------------------

const RECENT = 30

/** Từ đã tra gần đây (đồng bộ giữa các máy): chạm để tra lại, bỏ từng từ hoặc xóa hết. Chưa tra gì thì hiện `children`. */
function RecentLookups({ onLookup, children }: { onLookup: (term: string) => void; children: ReactNode }) {
  const entries = useLiveQuery(async () => (await db.lookupHistory.orderBy('lookedUpAt').reverse().toArray()).filter((e) => e.deletedAt === null), [])
  const [confirm, setConfirm] = useState(false)
  if (!entries) return null
  if (entries.length === 0) return <>{children}</>
  // Cùng một từ tra trên hai máy trước khi đồng bộ: chỉ hiện một lần.
  const seen = new Set<string>()
  const list = entries.filter((e) => !seen.has(e.query.toLowerCase()) && seen.add(e.query.toLowerCase())).slice(0, RECENT)
  return (
    <Card className="p-2">
      <div className="flex items-center justify-between px-2 pt-1 pb-1">
        <SectionTitle className="flex items-center gap-2">
          <History aria-hidden className="h-4 w-4 text-subtle" /> Đã tra gần đây
        </SectionTitle>
        <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-1 text-sm font-semibold text-muted">
          <Trash2 aria-hidden className="h-4 w-4" /> Xóa lịch sử
        </button>
      </div>
      <ul>
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-1">
            <button type="button" onClick={() => onLookup(e.query)} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-surface-2">
              <Search aria-hidden className="h-4 w-4 shrink-0 text-subtle" />
              <span className="truncate font-medium">{e.query}</span>
            </button>
            <button type="button" aria-label={`Bỏ “${e.query}” khỏi lịch sử`} onClick={() => void repo.clearLookups([e.id])} className="flex h-10 w-10 shrink-0 items-center justify-center text-subtle">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Xóa lịch sử tra?">
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">Danh sách từ đã tra bị xóa trên mọi máy đã đăng nhập. Từ đã lưu vào sổ tay và kết quả tra đã lưu để xem khi mất mạng vẫn giữ nguyên.</p>
          <Button
            variant="danger"
            onClick={async () => {
              await repo.clearLookups()
              setConfirm(false)
              showToast('Đã xóa lịch sử tra')
            }}
          >
            Xóa lịch sử
          </Button>
          <Button onClick={() => setConfirm(false)}>Hủy</Button>
        </div>
      </Sheet>
    </Card>
  )
}

// ---- Mục từ (R15.2) --------------------------------------------------------------------------

interface Pick {
  key: string
  group: DictGroup
  sense: DictSense
}

const pickKey = (gi: number, si: number) => `${gi}:${si}`

function hintsFor(entry: DictEntry, group: DictGroup): VietnameseHint[] {
  const own = entry.vietnamese.filter((h) => h.partOfSpeech === group.partOfSpeech)
  return own.length > 0 ? own : entry.vietnamese.filter((h) => !h.partOfSpeech)
}

function ipaFor(entry: DictEntry, group: DictGroup): Ipa {
  return entry.ipaByPos[group.partOfSpeech] ?? entry.ipa
}

function EntryView({ entry, lib, onLookup }: { entry: DictEntry; lib: Library; onLookup: (term: string) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [expanded, setExpanded] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const key = termKey(entry.title)
  const saved = useMemo(() => lib.items.filter((i) => i.termKey === key), [lib.items, key])
  const savedDefinitions = new Set(saved.map((i) => i.meaningEn).filter(Boolean))
  const picks: Pick[] = picked.map((k) => {
    const [gi, si] = k.split(':').map(Number)
    return { key: k, group: entry.groups[gi], sense: entry.groups[gi].senses[si] }
  })

  function toggle(k: string) {
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-[1.75rem] leading-tight font-bold break-words">{entry.title}</h2>
          <SpeakButtons text={entry.title} />
        </div>
        {(entry.ipa.us || entry.ipa.uk) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.ipa.us && <IpaPill label="Mỹ" ipa={entry.ipa.us} onPlay={() => void speak(entry.title, { accent: 'us' })} />}
            {entry.ipa.uk && <IpaPill label="Anh" ipa={entry.ipa.uk} onPlay={() => void speak(entry.title, { accent: 'uk' })} />}
          </div>
        )}
        {saved.length > 0 && (
          <Link to={saved.length === 1 ? `/words/${saved[0].id}` : `/notebook?q=${encodeURIComponent(entry.title)}`} className="mt-3 inline-flex">
            <Badge tone="accent">
              Đã có {saved.length} nghĩa trong sổ tay{saved.length === 1 ? `: ${saved[0].meaningVi}` : ''}
            </Badge>
          </Link>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle">
          <Plus aria-hidden className="h-3.5 w-3.5" /> Chạm dấu cộng ở nghĩa bạn muốn học để lưu vào sổ tay.
        </p>
      </Card>

      {entry.groups.map((group, gi) => {
        const hints = hintsFor(entry, group)
        const ipa = ipaFor(entry, group)
        const showAll = expanded.includes(gi)
        const senses = showAll ? group.senses : group.senses.slice(0, SHOWN)
        return (
          <Card key={gi} className="p-1.5">
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <SectionTitle className="">{POS_LABEL[group.partOfSpeech]}</SectionTitle>
                {group.partOfSpeech === 'other' && <span className="text-xs text-subtle">{group.label}</span>}
                {(ipa.us !== entry.ipa.us || ipa.uk !== entry.ipa.uk) && <span className="text-sm text-muted">{ipa.us ?? ipa.uk}</span>}
              </div>
              {hints.length > 0 && (
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  <span className="text-xs font-semibold text-subtle">Tiếng Việt: </span>
                  {[...new Set(hints.flatMap((h) => h.words))].join(', ')}
                </p>
              )}
            </div>
            <ol>
              {senses.map((sense, si) => {
                const k = pickKey(gi, si)
                const on = picked.includes(k)
                const isSaved = savedDefinitions.has(sense.definition)
                return (
                  <li key={k} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors ${on ? 'bg-accent-soft' : ''}`}>
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-subtle tabular-nums">{si + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] leading-snug">{sense.definition}</p>
                      {sense.examples.map((ex, i) => (
                        <p key={i} className="mt-1 text-sm leading-snug text-muted italic">
                          {ex}
                        </p>
                      ))}
                      {sense.formOf && (
                        <button type="button" onClick={() => onLookup(sense.formOf!)} className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                          <Search aria-hidden className="h-3.5 w-3.5" /> Tra “{sense.formOf}”
                        </button>
                      )}
                    </div>
                    {isSaved ? (
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-accent" aria-label="Đã lưu nghĩa này">
                        <Check aria-hidden className="h-5 w-5" strokeWidth={2.6} />
                      </span>
                    ) : (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        aria-pressed={on}
                        aria-label={on ? 'Bỏ chọn nghĩa này' : 'Chọn nghĩa này để lưu'}
                        onClick={() => toggle(k)}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          on ? 'border-accent bg-accent text-on-accent' : 'border-line text-subtle'
                        }`}
                      >
                        {on ? <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> : <Plus aria-hidden className="h-4 w-4" strokeWidth={2.6} />}
                      </motion.button>
                    )}
                  </li>
                )
              })}
            </ol>
            {group.senses.length > SHOWN && (
              <button
                type="button"
                onClick={() => setExpanded((e) => (showAll ? e.filter((x) => x !== gi) : [...e, gi]))}
                className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-accent"
              >
                {showAll ? 'Thu gọn' : `Xem thêm ${group.senses.length - SHOWN} nghĩa`}
                <motion.span animate={{ rotate: showAll ? 180 : 0 }} className="flex">
                  <ChevronDown aria-hidden className="h-4 w-4" />
                </motion.span>
              </button>
            )}
          </Card>
        )
      })}

      <p className="px-1 text-xs leading-relaxed text-subtle">
        Nguồn:{' '}
        <a href={`https://en.wiktionary.org/wiki/${encodeURIComponent(entry.title.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
          Wiktionary <ExternalLink aria-hidden className="h-3 w-3" />
        </a>{' '}
        (CC BY-SA). Không thấy nghĩa bạn cần?{' '}
        <Link to={`/words/new?term=${encodeURIComponent(entry.title)}`} className="font-semibold text-accent">
          Tự thêm từ này
        </Link>
      </p>

      <AnimatePresence>
        {picks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] pt-1"
          >
            <Button variant="primary" icon={BookmarkPlus} className="w-full shadow-lg" onClick={() => setSaving(true)}>
              Lưu {picks.length} nghĩa vào sổ tay
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <SaveSheet
        open={saving}
        entry={entry}
        picks={picks}
        lib={lib}
        onClose={() => setSaving(false)}
        onSaved={() => {
          setSaving(false)
          setPicked([])
        }}
      />
    </div>
  )
}

// ---- Chọn nghĩa để lưu nhanh (R15.3 → R2.8) ----------------------------------------------------

function SaveSheet({
  open,
  entry,
  picks,
  lib,
  onClose,
  onSaved,
}: {
  open: boolean
  entry: DictEntry
  picks: Pick[]
  lib: Library
  onClose: () => void
  onSaved: () => void
}) {
  const [meanings, setMeanings] = useState<Record<string, string>>({})
  const [noExample, setNoExample] = useState<string[]>([])
  const [deckIds, setDeckIds] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const decks = lib.decks.filter((d) => !d.archived)
  const missing = picks.filter((p) => !meanings[p.key]?.trim())

  /** Đóng bảng: giữ nghĩa đã gõ (mở lại vẫn còn), bỏ thông báo lỗi. */
  function close() {
    setTried(false)
    onClose()
  }

  async function save() {
    setTried(true)
    if (missing.length > 0 || busy) return
    setBusy(true)
    try {
      const inputs: ItemInput[] = picks.map((p) => {
        const ipa = ipaFor(entry, p.group)
        const example = noExample.includes(p.key) ? undefined : p.sense.examples[0]
        return {
          term: entry.title,
          partOfSpeech: p.group.partOfSpeech,
          meaningVi: meanings[p.key],
          meaningEn: p.sense.definition,
          ipaUs: ipa.us,
          ipaUk: ipa.uk,
          examples: example ? [{ en: example }] : [],
          acceptedAnswers: [],
          tags: [],
          favorite: false,
          difficult: false,
        }
      })
      const res = await repo.saveFromSource(inputs, deckIds)
      const parts = [res.created.length > 0 && `Đã lưu ${res.created.length} nghĩa của “${entry.title}”`, res.existing.length > 0 && `${res.existing.length} nghĩa đã có sẵn`]
      showToast(parts.filter(Boolean).join(' · '))
      setMeanings({})
      setNoExample([])
      setTried(false)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={close} title={`Lưu “${entry.title}”`}>
      <div className="-mx-5 max-h-[62dvh] overflow-y-auto px-5 pb-1">
        <div className="flex flex-col gap-4">
          {picks.map((p) => {
            const hints = [...new Set(hintsFor(entry, p.group).flatMap((h) => h.words))]
            const value = meanings[p.key] ?? ''
            const example = p.sense.examples[0]
            return (
              <div key={p.key} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
                <p className="text-sm leading-snug">
                  <span className="font-semibold text-accent">{POS_LABEL[p.group.partOfSpeech]}</span> · {p.sense.definition}
                </p>
                <TextField
                  label="Nghĩa tiếng Việt"
                  value={value}
                  placeholder="Nghĩa bạn muốn học"
                  error={tried && !value.trim() ? 'Nhập nghĩa tiếng Việt.' : null}
                  onChange={(e) => setMeanings((m) => ({ ...m, [p.key]: e.target.value }))}
                />
                {hints.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-subtle">Gợi ý:</span>
                    {hints.map((w) => (
                      <Chip key={w} active={value.trim() === w} onClick={() => setMeanings((m) => ({ ...m, [p.key]: w }))}>
                        {w}
                      </Chip>
                    ))}
                  </div>
                )}
                {example && (
                  <label className="flex items-start gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={!noExample.includes(p.key)}
                      onChange={(e) => setNoExample((n) => (e.target.checked ? n.filter((x) => x !== p.key) : [...n, p.key]))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--app-accent)]"
                    />
                    <span>
                      Lưu câu ví dụ: <i>{example}</i>
                    </span>
                  </label>
                )}
              </div>
            )
          })}

          <div>
            <p className="mb-2 text-sm font-medium">Đưa vào bộ từ</p>
            {decks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {decks.map((d) => (
                  <Chip key={d.id} active={deckIds.includes(d.id)} onClick={() => setDeckIds((x) => (x.includes(d.id) ? x.filter((y) => y !== d.id) : [...x, d.id]))}>
                    {d.name}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Chưa có bộ từ. Từ không thuộc bộ nào vẫn được học bình thường.</p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" className="w-full disabled:opacity-70" disabled={busy} onClick={() => void save()}>
          {busy ? 'Đang lưu…' : `Lưu ${picks.length} nghĩa`}
        </Button>
        <Button variant="ghost" className="w-full" onClick={close}>
          Để sau
        </Button>
      </div>
    </Sheet>
  )
}

// ---- Không tìm thấy (R15.5) -----------------------------------------------------------------

function NotFound({ q, suggestions, onLookup }: { q: string; suggestions: string[]; onLookup: (term: string) => void }) {
  const navigate = useNavigate()
  return (
    <Card>
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <SearchX aria-hidden className="h-8 w-8 text-subtle" />
        <p className="text-[0.9375rem] font-semibold">Không tìm thấy “{q}” trong từ điển</p>
        <p className="text-sm leading-relaxed text-muted">Kiểm tra lại chính tả, thử dạng gốc của từ (ví dụ “give up” thay vì “gave up”), hoặc tự thêm vào sổ tay.</p>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Có phải bạn muốn tra:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s} active={false} onClick={() => onLookup(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <Button icon={Plus} className="mt-4 w-full" onClick={() => navigate(`/words/new?term=${encodeURIComponent(q)}`)}>
        Tự thêm “{q}” vào sổ tay
      </Button>
      <p className="mt-3 text-center text-xs text-subtle">Gợi ý nghĩa bằng AI sẽ có khi bật trợ lý AI (giai đoạn 5).</p>
    </Card>
  )
}
