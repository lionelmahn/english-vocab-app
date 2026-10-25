import { CheckCircle2, Clock, Flag, MessageSquareWarning } from 'lucide-react'
import { useState } from 'react'
import { HelpButton } from '../components/Guide'
import { BackButton } from '../components/kit'
import { ReportSheet } from '../components/ReportSheet'
import { Button, Card, EmptyState, Page, SectionTitle } from '../components/ui'
import { formatDate } from '../lib/format'
import { useAuth } from '../services/auth'
import { FEEDBACK_KINDS, useReports } from '../services/feedback'

const KIND_LABEL = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.value, k.label]))

/** Báo lỗi và góp ý (R14.4): gửi báo cáo chung, xem các báo cáo đã ghi trên máy này và trạng thái gửi. */
export function FeedbackPage() {
  const auth = useAuth()
  const reports = useReports()
  const [open, setOpen] = useState(false)
  if (!reports) return null
  const pending = reports.filter((r) => r.sentAt === null).length

  return (
    <Page title="Báo lỗi và góp ý" subtitle="Giúp app đúng và dễ dùng hơn" back={<BackButton fallback="/me" />} action={<HelpButton topic="feedback" />}>
      <Card>
        <p className="text-sm leading-relaxed text-muted">
          Thấy lỗi ở một từ hay một câu khi đang học? Dùng nút “Báo lỗi nội dung từ này” ở trang của từ, hoặc “Báo lỗi câu này” trong bảng tạm dừng buổi học, để app tự kèm đúng từ và câu đó. Lỗi khác thì gửi ở đây.
        </p>
        <Button variant="primary" icon={Flag} className="mt-3 w-full" onClick={() => setOpen(true)}>
          Gửi báo lỗi hoặc góp ý
        </Button>
        {pending > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-warning">
            {pending} báo lỗi đang chờ gửi{auth.status === 'signed_in' ? ' — sẽ tự gửi khi có mạng.' : ' — đăng nhập để gửi.'}
          </p>
        )}
      </Card>

      {reports.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title="Chưa có báo lỗi nào" body="Các báo lỗi bạn gửi từ máy này sẽ hiện ở đây." />
      ) : (
        <Card>
          <SectionTitle>Đã ghi trên máy này ({reports.length})</SectionTitle>
          <ul className="flex flex-col divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="font-semibold text-text">{KIND_LABEL[r.kind]}</span>
                  <span className="flex items-center gap-1">
                    {r.sentAt ? <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-accent" /> : <Clock aria-hidden className="h-3.5 w-3.5 text-warning" />}
                    {r.sentAt ? 'Đã gửi' : 'Chờ gửi'} · {formatDate(r.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line">{r.message}</p>
                {typeof r.context.term === 'string' && <p className="mt-0.5 text-xs text-subtle">Từ: {r.context.term}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReportSheet open={open} onClose={() => setOpen(false)} kind="bug" />
    </Page>
  )
}
