import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight, History, Lightbulb, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { BackButton, Badge } from '../components/kit'
import { HelpButton } from '../components/Guide'
import { Card, EmptyState, Page } from '../components/ui'
import { sessionAnswers, sessionHistory } from '../core/history'
import { db } from '../db/db'
import { useLibrary } from '../lib/hooks'
import { EXERCISE_LABEL, MODE_LABEL } from '../lib/labels'

const dateTime = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

function minutesText(ms: number): string {
  const m = Math.round(ms / 60_000)
  return m < 1 ? 'dưới 1 phút' : `${m} phút`
}

/** Lịch sử bài làm (R6.8): các buổi học, ôn, luyện, kiểm tra; mới nhất trước. */
export function HistoryPage() {
  const logs = useLiveQuery(() => db.reviewLogs.toArray(), [])
  const sessions = useMemo(() => (logs ? sessionHistory(logs) : null), [logs])

  return (
    <Page title="Lịch sử bài làm" subtitle="Các buổi học, ôn và kiểm tra" back={<BackButton fallback="/stats" />} action={<HelpButton topic="review" />}>
      {sessions && sessions.length === 0 && <EmptyState icon={History} title="Chưa có bài làm nào" body="Học hoặc ôn vài từ, kết quả từng buổi sẽ hiện ở đây." />}
      {sessions && sessions.length > 0 && (
        <Card>
          <ul className="flex flex-col divide-y divide-line">
            {sessions.slice(0, 200).map((s) => {
              const graded = s.correct + s.wrong
              return (
                <li key={s.sessionId}>
                  <Link to={`/history/${s.sessionId}`} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        {MODE_LABEL[s.mode]}
                        {s.mode === 'test' && graded > 0 && <Badge tone={s.correct / graded >= 0.8 ? 'accent' : 'neutral'}>{`${s.correct}/${graded}`}</Badge>}
                      </p>
                      <p className="text-[0.8125rem] text-muted">
                        {dateTime.format(s.startedAt)} · {s.items} từ{graded > 0 ? ` · đúng ${Math.round((s.correct / graded) * 100)}%` : ''} · {minutesText(s.durationMs)}
                      </p>
                    </div>
                    <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
                  </Link>
                </li>
              )
            })}
          </ul>
          {sessions.length > 200 && <p className="pt-2 text-xs text-subtle">Hiện 200 buổi gần nhất.</p>}
        </Card>
      )}
    </Page>
  )
}

/** Kết quả từng câu của một buổi. */
export function SessionDetailPage() {
  const { id = '' } = useParams()
  const lib = useLibrary()
  const logs = useLiveQuery(() => db.reviewLogs.where('sessionId').equals(id).toArray(), [id])
  const record = useMemo(() => (logs && logs.length > 0 ? sessionHistory(logs)[0] : null), [logs])
  const answers = useMemo(() => (logs ? sessionAnswers(logs, id) : []), [logs, id])

  if (!logs || !lib) return null
  if (!record) {
    return (
      <Page title="Không tìm thấy buổi này" back={<BackButton fallback="/history" />}>
        <p className="text-sm text-muted">Buổi này không có câu trả lời nào được lưu.</p>
      </Page>
    )
  }
  const graded = record.correct + record.wrong

  return (
    <Page title={MODE_LABEL[record.mode]} subtitle={`${dateTime.format(record.startedAt)} · ${minutesText(record.durationMs)}`} back={<BackButton fallback="/history" />}>
      <Card>
        <div className="grid grid-cols-3 text-center">
          <Stat label="Số từ" value={record.items} />
          <Stat label="Đúng" value={record.correct} tone="accent" />
          <Stat label="Sai" value={record.wrong} tone={record.wrong ? 'danger' : undefined} />
        </div>
        {graded > 0 && (
          <p className="mt-3 text-center text-sm text-muted">
            Đúng <b className="text-text">{Math.round((record.correct / graded) * 100)}%</b> theo câu trả lời đầu tiên của mỗi từ
            {record.answers > graded ? ` · ${record.answers} lượt trả lời (gồm luyện lại)` : ''}
          </p>
        )}
      </Card>
      <Card>
        <ul className="flex flex-col divide-y divide-line">
          {answers.map(({ log, attempt }) => {
            const item = lib.itemById.get(log.itemId)
            const icon =
              log.correct === null ? null : log.correct ? (
                <Check aria-label="Đúng" className="h-5 w-5 text-accent" strokeWidth={3} />
              ) : (
                <X aria-label="Sai" className="h-5 w-5 text-danger" strokeWidth={3} />
              )
            return (
              <li key={log.id} className="flex items-center gap-3 py-2.5">
                <span className="flex w-6 shrink-0 justify-center">{icon}</span>
                <div className="min-w-0 flex-1">
                  {item ? (
                    <Link to={`/words/${item.id}`} className="text-[0.9375rem] font-semibold">
                      {item.term}
                    </Link>
                  ) : (
                    <span className="text-[0.9375rem] font-semibold text-muted">(từ đã xóa)</span>
                  )}
                  <p className="text-[0.8125rem] text-muted">
                    {EXERCISE_LABEL[log.exercise]}
                    {attempt > 0 && ' · luyện lại'}
                    {log.responseMs !== null && log.responseMs > 0 && ` · ${Math.max(1, Math.round(log.responseMs / 1000))} giây`}
                  </p>
                </div>
                {!!log.hintLevel && (
                  <span className="flex items-center gap-1 text-[0.75rem] text-warning">
                    <Lightbulb aria-hidden className="h-4 w-4" /> gợi ý
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </Page>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'accent' | 'danger' }) {
  return (
    <div>
      <p className={`text-[1.75rem] font-bold tabular-nums ${tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : ''}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
