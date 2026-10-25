import { Download, FileSpreadsheet, FileUp, RotateCcw } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackButton, Badge, Chip, Select } from '../components/kit'
import { showToast } from '../lib/toast'
import { Button, Card, FormMessage, Page, SectionTitle, TextField } from '../components/ui'
import { POS_SHORT } from '../core/pos'
import { repo, type ItemInput } from '../db/repo'
import { summarizeRows, TEMPLATE_CSV, toImportRows, type ImportRow, type RowStatus } from '../import/parse'
import { useLibrary } from '../lib/hooks'
import { riseIn } from '../lib/motion'

type DeckMode = 'perRow' | 'newDeck' | 'deck' | 'none'

const STATUS_BADGE: Record<RowStatus, { label: string; tone: 'accent' | 'warning' | 'danger' | 'neutral' }> = {
  ok: { label: 'Mới', tone: 'accent' },
  same_term: { label: 'Nghĩa mới', tone: 'warning' },
  duplicate: { label: 'Đã có', tone: 'neutral' },
  dup_in_file: { label: 'Lặp', tone: 'neutral' },
  error: { label: 'Lỗi', tone: 'danger' },
}

async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    const data = await readSheet(file)
    return data.map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c))))
  }
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' })
  return result.data
}

function toInput(r: ImportRow): ItemInput {
  return {
    term: r.term,
    partOfSpeech: r.partOfSpeech,
    meaningVi: r.meaningVi,
    meaningEn: r.meaningEn,
    ipaUs: r.ipaUs,
    ipaUk: r.ipaUk,
    examples: r.example ? [{ en: r.example, vi: r.exampleVi }] : [],
    acceptedAnswers: [],
    note: r.note,
    tags: r.tags,
    favorite: false,
    difficult: false,
  }
}

/** Nhập từ vựng từ file CSV, TXT (Anki) hoặc Excel (R11.2). */
export function ImportPage() {
  const lib = useLibrary()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [includeSameTerm, setIncludeSameTerm] = useState(true)
  const [deckMode, setDeckMode] = useState<DeckMode>('perRow')
  const [deckId, setDeckId] = useState('')
  const [newDeckName, setNewDeckName] = useState('')

  const summary = useMemo(() => (rows ? summarizeRows(rows) : null), [rows])
  const hasDeckColumn = !!rows?.some((r) => r.deck)
  const accepted = rows?.filter((r) => r.status === 'ok' || (includeSameTerm && r.status === 'same_term')) ?? []

  async function onFile(file: File | undefined) {
    if (!file || !lib) return
    setReading(true)
    setError(null)
    try {
      const table = await readTable(file)
      const parsed = toImportRows(table, lib.items)
      if (parsed.length === 0) {
        setError('File không có dòng dữ liệu nào.')
        setRows(null)
      } else {
        setRows(parsed)
        setFileName(file.name)
        const hasDeck = parsed.some((r) => r.deck)
        setDeckMode(hasDeck ? 'perRow' : 'newDeck')
        setNewDeckName(file.name.replace(/\.[^.]+$/, '').slice(0, 120))
      }
    } catch (e) {
      setError(`Không đọc được file: ${(e as Error).message}`)
      setRows(null)
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function doImport() {
    if (!rows || accepted.length === 0 || importing) return
    if (deckMode === 'newDeck' && !newDeckName.trim()) {
      setError('Đặt tên cho bộ từ mới.')
      return
    }
    if (deckMode === 'deck' && !deckId) {
      setError('Chọn bộ từ để nhập vào.')
      return
    }
    setImporting(true)
    const target =
      deckMode === 'perRow' ? { kind: 'perRow' as const } : deckMode === 'deck' ? { kind: 'deck' as const, deckId } : deckMode === 'newDeck' ? { kind: 'newDeck' as const, name: newDeckName } : { kind: 'none' as const }
    const res = await repo.importItems(
      accepted.map((r) => ({ input: toInput(r), deckName: r.deck })),
      target,
    )
    showToast(`Đã nhập ${res.items} từ${res.decks ? `, tạo ${res.decks} bộ từ` : ''}`)
    navigate('/notebook', { replace: true })
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau-nhap-tu-vung.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Page title="Nhập từ file" subtitle="CSV, Excel (.xlsx) hoặc file xuất từ Anki (.txt)" back={<BackButton fallback="/notebook" />}>
      <input ref={inputRef} type="file" accept=".csv,.txt,.tsv,.xlsx,text/csv,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      {!rows ? (
        <>
          <Card>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-accent-soft">
                <FileSpreadsheet aria-hidden className="h-8 w-8 text-accent" />
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                Cột bắt buộc: <b className="text-text">từ</b> và <b className="text-text">nghĩa</b>. Có thể thêm: loại từ, phiên âm, ví dụ, dịch ví dụ, nhãn, bộ từ. Tên cột tiếng Việt hay tiếng Anh đều được.
              </p>
              <Button variant="primary" icon={FileUp} className="mt-1 w-full disabled:opacity-70" disabled={reading} onClick={() => inputRef.current?.click()}>
                {reading ? 'Đang đọc file…' : 'Chọn file'}
              </Button>
              <Button variant="ghost" icon={Download} onClick={downloadTemplate}>
                Tải file mẫu
              </Button>
            </div>
          </Card>
          <FormMessage message={error ? { tone: 'error', text: error } : null} />
        </>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{fileName}</p>
                <p className="text-sm text-muted">{summary?.total} dòng</p>
              </div>
              <Button icon={RotateCcw} className="h-9 px-3 text-sm" onClick={() => setRows(null)}>
                Chọn lại
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="accent">{summary?.ok} từ mới</Badge>
              {!!summary?.sameTerm && <Badge tone="warning">{summary.sameTerm} nghĩa mới của từ đã có</Badge>}
              {!!summary?.duplicate && <Badge>{summary.duplicate} đã có — bỏ qua</Badge>}
              {!!summary?.dupInFile && <Badge>{summary.dupInFile} lặp trong file — bỏ qua</Badge>}
              {!!summary?.error && <Badge tone="danger">{summary.error} dòng lỗi — bỏ qua</Badge>}
            </div>
            {!!summary?.sameTerm && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeSameTerm} onChange={(e) => setIncludeSameTerm(e.target.checked)} className="h-4 w-4 accent-[var(--app-accent)]" />
                Nhập cả các nghĩa mới của từ đã có (thành mục học riêng)
              </label>
            )}
          </Card>

          <Card>
            <SectionTitle>Đưa vào bộ từ</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {hasDeckColumn && (
                <Chip active={deckMode === 'perRow'} onClick={() => setDeckMode('perRow')}>
                  Theo cột “bộ từ” trong file
                </Chip>
              )}
              <Chip active={deckMode === 'newDeck'} onClick={() => setDeckMode('newDeck')}>
                Bộ mới
              </Chip>
              {lib && lib.decks.length > 0 && (
                <Chip active={deckMode === 'deck'} onClick={() => setDeckMode('deck')}>
                  Bộ có sẵn
                </Chip>
              )}
              <Chip active={deckMode === 'none'} onClick={() => setDeckMode('none')}>
                Không đưa vào bộ
              </Chip>
            </div>
            <AnimatePresence initial={false}>
              {deckMode === 'newDeck' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-3">
                  <TextField label="Tên bộ từ mới" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)} />
                </motion.div>
              )}
              {deckMode === 'deck' && lib && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-3">
                  <Select label="Bộ từ" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                    <option value="">Chọn bộ…</option>
                    {lib.decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Card className="p-1.5">
            <p className="px-3 pt-2 pb-1 text-sm font-semibold">Xem trước{rows.length > 60 && ` (60/${rows.length} dòng đầu)`}</p>
            <ul>
              {rows.slice(0, 60).map((r) => {
                const b = STATUS_BADGE[r.status]
                const skipped = r.status === 'error' || r.status === 'duplicate' || r.status === 'dup_in_file' || (r.status === 'same_term' && !includeSameTerm)
                return (
                  <li key={r.line} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${skipped ? 'opacity-50' : ''}`}>
                    <span className="w-6 shrink-0 text-right text-xs text-subtle tabular-nums">{r.line}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem]">
                        <span className="font-semibold">{r.term || '—'}</span> <span className="text-xs text-subtle">{POS_SHORT[r.partOfSpeech]}</span>
                      </p>
                      <p className="truncate text-sm text-muted">{r.message && r.status === 'error' ? r.message : r.meaningVi}</p>
                    </div>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </li>
                )
              })}
            </ul>
          </Card>

          <FormMessage message={error ? { tone: 'error', text: error } : null} />
          <motion.div variants={riseIn} className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] pt-2">
            <Button variant="primary" className="w-full shadow-lg disabled:opacity-50" disabled={accepted.length === 0 || importing} onClick={() => void doImport()}>
              {importing ? 'Đang nhập…' : `Nhập ${accepted.length} từ`}
            </Button>
          </motion.div>
        </>
      )}
    </Page>
  )
}
