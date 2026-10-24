import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Flame, Languages, Lightbulb, Pencil, StickyNote, Star, Trash } from 'lucide-react'
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
import { repo } from '../db/repo'
import { useLibrary, useNow } from '../lib/hooks'
import { EXERCISE_LABEL, GRADE_LABEL } from '../lib/labels'
import { useSettings } from '../lib/settings'
import { speak } from '../services/speech'
import { VoiceClipPrompt } from '../components/VoiceClip'
import { WordAudioCard } from '../components/WordAudio'

/** Chi tiết mục từ (R2.9): nghĩa, cách đọc, ví dụ, bộ từ, tiến độ. */
export function WordDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const lib = useLibrary()
  const now = useNow()
  const settings = useSettings()
  const [showVi, setShowVi] = useState(settings.showTranslations)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
          <p className="text-[22px] leading-snug font-semibold">{item.meaningVi}</p>
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

      {item.examples.length > 0 && (
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
          <ul className="flex flex-col gap-3">
            {item.examples.map((ex, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-relaxed">{ex.en}</p>
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
        </Card>
      )}

      {(item.note || item.mnemonic) && (
        <Card>
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
        </Card>
      )}

      <WordAudioCard item={item} />

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
              <Badge tone={status === 'due' ? 'warning' : 'accent'}>{STATUS_LABEL[status]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Ôn tiếp theo</dt>
              <dd className="text-right font-medium">{card.due <= now ? 'Có thể ôn ngay' : formatDueIn(card.due, now)}</dd>
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
            <Link key={d.id} to={`/decks/${d.id}`} className="rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent">
              {d.name}
            </Link>
          ))}
          {item.tags.map((t) => (
            <Link key={t} to={`/notebook?tag=${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-3 py-1.5 text-[13px] text-muted">
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
