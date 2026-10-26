import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ChevronDown, Flag, Flame, Languages, Lightbulb, Mic, Pause, Pencil, Play, Plus, RotateCcw, StickyNote, Star, Trash } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Badge, BackButton, IconButton, IpaPill, LevelDots, Sheet, SpeakButtons } from '../components/kit'
import { formatDate, formatDueIn } from '../lib/format'
import { showToast } from '../lib/toast'
import { HelpTitle } from '../components/Guide'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { itemLevel, itemStatus, liveCard, STATUS_LABEL } from '../core/library'
import { LEVEL_LABELS } from '../core/levels'
import { POS_LABEL } from '../core/pos'
import { db } from '../db/db'
import { MAX_EXAMPLES, repo } from '../db/repo'
import { useLibrary, useNow } from '../lib/hooks'
import { EXERCISE_LABEL, GRADE_LABEL } from '../lib/labels'
import { useSettings } from '../lib/settings'
import { speak } from '../services/speech'
import { VoiceClipPrompt } from '../components/VoiceClip'
import { WordAudioCard } from '../components/WordAudio'
import { WordImageCard } from '../components/WordImage'
import { SpeakPractice } from '../components/SpeakPractice'
import { ReportSheet } from '../components/ReportSheet'
import { AiLink } from '../components/AiAssist'
import { AiMnemonicSheet, ExamplesSheet } from '../components/AiWordExtras'
import { UseButton } from '../components/AiWordSuggest'
import { CollocationsCard, ConfusablesCard } from '../components/WordReference'
import { WritingCard } from '../components/WritingPractice'
import { sameSense } from '../core/reference'
import { useAiOn } from '../lib/useAi'
import { useWordReference } from '../lib/useReference'

/** Chi tiết mục từ (R2.9): nghĩa, cách đọc, ví dụ, bộ từ, tiến độ. */
export function WordDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const lib = useLibrary()
  const now = useNow()
  const settings = useSettings()
  const [showVi, setShowVi] = useState(settings.showTranslations)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [report, setReport] = useState(false)
  const [aiSheet, setAiSheet] = useState<'mnemonic' | 'examples' | null>(null)
  const aiOn = useAiOn()
  const [practice, setPractice] = useState(false)
  const ref = useWordReference(lib?.itemById.get(id)?.term)
  const logs = useLiveQuery(async () => (await db.reviewLogs.where('itemId').equals(id).toArray()).sort((a, b) => b.reviewedAt - a.reviewedAt).slice(0, 10), [id], [])

  if (!lib) return null
  const item = lib.itemById.get(id)
  if (!item) {
    return (
      <Page title="Không tìm thấy từ" back={<BackButton fallback="/notebook" />}>
        <p className="text-sm text-muted">Từ này đã bị xóa hoặc không tồn tại.</p>
      </Page>
    )
  }

  const card = liveCard(lib.cards.get(item.id))
  const status = itemStatus(item, card, now)
  const level = itemLevel(card)
  const decks = [...(lib.members.get(item.id) ?? [])].map((d) => lib.deckById.get(d)).filter((d) => !!d)
  // Nội dung soạn sẵn (bộ 1.000 từ) viết theo một nghĩa: chỉ gợi ý mẹo nhớ, câu ví dụ khi cùng loại từ.
  const ready = sameSense(ref ?? undefined, item.partOfSpeech)
  const tip = ready && !item.mnemonic ? ref?.mnemonic : undefined

  return (
    <Page
      title={item.term}
      subtitle={POS_LABEL[item.partOfSpeech]}
      back={<BackButton fallback="/notebook" />}
      action={
        <div className="flex gap-2">
          <IconButton icon={Star} label="Yêu thích" tone="warning" active={item.favorite} onClick={() => void repo.setItemFlags(item.id, { favorite: !item.favorite })} />
          <IconButton icon={Flame} label="Từ khó" tone="danger" active={item.difficult} onClick={() => void repo.setItemFlags(item.id, { difficult: !item.difficult })} />
          <IconButton icon={Pencil} label="Sửa từ" onClick={() => navigate(`/words/${item.id}/edit`)} />
        </div>
      }
    >
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[1.375rem] leading-snug font-semibold">{item.meaningVi}</p>
          <SpeakButtons text={item.term} />
        </div>
        {item.meaningEn && <p className="mt-1 text-sm text-muted italic">{item.meaningEn}</p>}
        {(item.ipaUs || item.ipaUk) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.ipaUs && <IpaPill label="Mỹ" ipa={item.ipaUs} onPlay={() => void speak(item.term, { accent: 'us' })} />}
            {item.ipaUk && <IpaPill label="Anh" ipa={item.ipaUk} onPlay={() => void speak(item.term, { accent: 'uk' })} />}
          </div>
        )}
      </Card>

      <VoiceClipPrompt item={item} />

      {(item.examples.length > 0 || aiOn || ready) && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle className="">Câu ví dụ</SectionTitle>
            {item.examples.some((e) => e.vi) && (
              <button type="button" onClick={() => setShowVi((v) => !v)} className="flex items-center gap-1.5 text-sm font-semibold text-accent" aria-pressed={showVi}>
                <Languages aria-hidden className="h-4 w-4" />
                {showVi ? 'Ẩn bản dịch' : 'Hiện bản dịch'}
              </button>
            )}
          </div>
          {item.examples.length === 0 && <p className="text-sm text-muted">Chưa có câu ví dụ.</p>}
          <ul className="flex flex-col gap-3">
            {item.examples.map((ex, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-relaxed">{ex.en}</p>
                  <AnimatePresence initial={false}>
                    {showVi && ex.vi && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden text-sm text-muted">
                        {ex.vi}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <SpeakButtons text={ex.en} size="sm" />
              </li>
            ))}
          </ul>
          {(ready || aiOn) && item.examples.length < MAX_EXAMPLES && (
            <div className="mt-2">
              {ready ? (
                <button type="button" onClick={() => setAiSheet('examples')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  <Plus aria-hidden className="h-4 w-4" /> Thêm câu ví dụ
                </button>
              ) : (
                <AiLink onClick={() => setAiSheet('examples')}>Thêm câu ví dụ bằng AI</AiLink>
              )}
            </div>
          )}
        </Card>
      )}

      {(item.note || item.mnemonic || aiOn || tip) && (
        <Card>
          {tip && (
            <div className="flex items-start gap-3">
              <p className="flex min-w-0 flex-1 gap-2.5 text-sm leading-relaxed">
                <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  <span className="block text-xs font-semibold text-muted">Mẹo nhớ soạn sẵn</span>
                  {tip}
                </span>
              </p>
              <UseButton
                label="Dùng mẹo này"
                onClick={async () => {
                  await repo.setMnemonic(item.id, tip)
                  showToast('Đã lưu mẹo nhớ')
                }}
              />
            </div>
          )}
          {item.mnemonic && (
            <p className="flex gap-2.5 text-sm leading-relaxed">
              <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{item.mnemonic}</span>
            </p>
          )}
          {item.note && (
            <p className={`flex gap-2.5 text-sm leading-relaxed text-muted ${item.mnemonic ? 'mt-3' : ''}`}>
              <StickyNote aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{item.note}</span>
            </p>
          )}
          {aiOn && (
            <div className={item.note || item.mnemonic || tip ? 'mt-2' : ''}>
              {!item.mnemonic && !item.note && !tip && <p className="text-sm text-muted">Chưa có mẹo nhớ.</p>}
              <AiLink onClick={() => setAiSheet('mnemonic')}>{item.mnemonic ? 'Gợi ý mẹo nhớ khác bằng AI' : 'Gợi ý mẹo nhớ bằng AI'}</AiLink>
            </div>
          )}
        </Card>
      )}
      <AiMnemonicSheet item={item} open={aiSheet === 'mnemonic'} onClose={() => setAiSheet(null)} />
      <ExamplesSheet item={item} ready={ready} open={aiSheet === 'examples'} onClose={() => setAiSheet(null)} />

      <CollocationsCard item={item} />

      <ConfusablesCard item={item} />

      <WritingCard item={item} />

      <WordImageCard item={item} />

      <WordAudioCard item={item} />

      <Card>
        <button type="button" onClick={() => setPractice((p) => !p)} className="flex w-full items-center gap-3 text-left" aria-expanded={practice}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Mic aria-hidden className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold">Luyện đọc</span>
            <span className="block text-[0.8125rem] leading-snug text-muted">Ghi giọng bạn rồi nghe lại xen với bản mẫu để tự so</span>
          </span>
          <ChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-subtle transition-transform ${practice ? 'rotate-180' : ''}`} />
        </button>
        {practice && (
          <div className="mt-4">
            <SpeakPractice text={item.term} />
          </div>
        )}
      </Card>

      <Card>
        <HelpTitle topic="levels">Tiến độ</HelpTitle>
        {card ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <LevelDots level={level} size="md" />
                <span className="text-sm font-semibold">
                  Cấp {level} · {LEVEL_LABELS[level]}
                </span>
              </span>
              <Badge tone={status === 'due' ? 'warning' : status === 'suspended' ? undefined : 'accent'}>{STATUS_LABEL[status]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Ôn tiếp theo</dt>
              <dd className="text-right font-medium">{card.suspended ? 'Đang tạm dừng' : card.due <= now ? 'Có thể ôn ngay' : formatDueIn(card.due, now)}</dd>
              <dt className="text-muted">Số lần ôn</dt>
              <dd className="text-right font-medium">{card.reps}</dd>
              <dt className="text-muted">Số lần quên</dt>
              <dd className="text-right font-medium">{card.lapses}</dd>
              {card.lastReview && (
                <>
                  <dt className="text-muted">Lần ôn gần nhất</dt>
                  <dd className="text-right font-medium">{formatDate(card.lastReview)}</dd>
                </>
              )}
            </dl>
            {/* R5.8 — tạm dừng ôn hoặc học lại từ đầu */}
            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Button
                icon={card.suspended ? Play : Pause}
                className="h-11 px-2! text-sm"
                onClick={async () => {
                  await repo.setSuspended([item.id], !card.suspended)
                  showToast(card.suspended ? 'Đã bỏ tạm dừng — từ lại được ôn theo lịch' : 'Đã tạm dừng ôn từ này')
                }}
              >
                {card.suspended ? 'Bỏ tạm dừng' : 'Tạm dừng ôn'}
              </Button>
              <Button icon={RotateCcw} className="h-11 px-2! text-sm" onClick={() => setConfirmReset(true)}>
                Học lại từ đầu
              </Button>
            </div>
            {card.suspended && <p className="text-[0.8125rem] leading-snug text-muted">Từ đang tạm dừng: không đến hạn, không vào buổi ôn hay ôn chủ động, cho tới khi bạn bỏ tạm dừng.</p>}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            {item.archived ? 'Từ đã lưu trữ, không xuất hiện khi học và ôn.' : 'Chưa học. Từ này sẽ xuất hiện trong buổi “Học từ mới”.'}
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>Bộ từ và nhãn</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {decks.length === 0 && <span className="text-sm text-muted">Chưa thuộc bộ nào.</span>}
          {decks.map((d) => (
            <Link key={d.id} to={`/decks/${d.id}`} className="rounded-full bg-accent-soft px-3 py-1.5 text-[0.8125rem] font-semibold text-accent">
              {d.name}
            </Link>
          ))}
          {item.tags.map((t) => (
            <Link key={t} to={`/notebook?tag=${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-3 py-1.5 text-[0.8125rem] text-muted">
              #{t}
            </Link>
          ))}
        </div>
      </Card>

      {logs.length > 0 && (
        <Card>
          <SectionTitle>Lịch sử gần đây</SectionTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-muted">
                  {formatDate(l.reviewedAt)} · {EXERCISE_LABEL[l.exercise]}
                </span>
                {l.grade ? (
                  <Badge tone={l.grade === 1 ? 'danger' : l.grade === 2 ? 'warning' : 'accent'}>{GRADE_LABEL[l.grade]}</Badge>
                ) : (
                  <Badge>{l.correct ? 'Đúng' : 'Luyện'}</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          icon={item.archived ? ArchiveRestore : Archive}
          className="flex-1"
          onClick={async () => {
            await repo.setItemFlags(item.id, { archived: !item.archived })
            showToast(item.archived ? 'Đã khôi phục từ' : 'Đã lưu trữ — từ không còn xuất hiện khi học')
          }}
        >
          {item.archived ? 'Khôi phục' : 'Lưu trữ'}
        </Button>
        <Button icon={Trash} className="flex-1 text-danger" onClick={() => setConfirmDelete(true)}>
          Xóa
        </Button>
      </div>
      <button type="button" onClick={() => setReport(true)} className="mx-auto flex items-center gap-1.5 py-1 text-sm font-semibold text-muted">
        <Flag aria-hidden className="h-4 w-4" /> Báo lỗi nội dung từ này
      </button>
      <ReportSheet
        open={report}
        onClose={() => setReport(false)}
        kind="content"
        context={{ itemId: item.id, term: item.term, meaningVi: item.meaningVi, partOfSpeech: item.partOfSpeech, source: item.source }}
        about={`từ “${item.term}”`}
      />

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title={`Học lại “${item.term}” từ đầu?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">
            Lịch ôn và cấp ghi nhớ của từ này bị xóa; từ trở về chưa học và sẽ xuất hiện trong buổi “Học từ mới”. Lịch sử trả lời vẫn được giữ.
          </p>
          <Button
            variant="primary"
            onClick={async () => {
              await repo.resetProgress([item.id])
              setConfirmReset(false)
              showToast('Đã đặt lại — từ trở về chưa học')
            }}
          >
            Học lại từ đầu
          </Button>
          <Button onClick={() => setConfirmReset(false)}>Hủy</Button>
        </div>
      </Sheet>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Xóa “${item.term}”?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted">Từ sẽ bị xóa khỏi sổ tay và mọi bộ từ, cùng lịch ôn. Nếu chỉ muốn tạm ngừng học, hãy chọn Lưu trữ.</p>
          <Button
            variant="danger"
            onClick={async () => {
              await repo.deleteItems([item.id])
              showToast('Đã xóa từ')
              navigate('/notebook', { replace: true })
            }}
          >
            Xóa từ
          </Button>
          <Button onClick={() => setConfirmDelete(false)}>Hủy</Button>
        </div>
      </Sheet>
    </Page>
  )
}
