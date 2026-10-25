import { Send } from 'lucide-react'
import { useState } from 'react'
import type { FeedbackKind } from '../db/types'
import { showToast } from '../lib/toast'
import { FEEDBACK_KINDS, MAX_MESSAGE, submitReport } from '../services/feedback'
import { useAuth } from '../services/auth'
import { Chip, Sheet, TextArea } from './kit'
import { Button } from './ui'

/**
 * Khung báo lỗi ngay tại màn hình liên quan (R14.4): chọn loại, ghi vài dòng; app tự kèm phiên bản, trang đang mở và
 * `context` của màn hình (ví dụ từ đang học). `about` là dòng mô tả ngắn phần đính kèm cho người dùng thấy.
 */
export function ReportSheet({
  open,
  onClose,
  kind: initialKind = 'bug',
  context = {},
  about,
}: {
  open: boolean
  onClose: () => void
  kind?: FeedbackKind
  context?: Record<string, unknown>
  about?: string
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Báo lỗi hoặc góp ý">
      {open && <ReportForm initialKind={initialKind} context={context} about={about} onDone={onClose} />}
    </Sheet>
  )
}

function ReportForm({ initialKind, context, about, onDone }: { initialKind: FeedbackKind; context: Record<string, unknown>; about?: string; onDone: () => void }) {
  const auth = useAuth()
  const [kind, setKind] = useState<FeedbackKind>(initialKind)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = message.trim().length > 0

  async function send() {
    if (!ok || busy) return
    setBusy(true)
    await submitReport(kind, message, context)
    showToast(auth.status === 'signed_in' ? 'Đã ghi báo lỗi — sẽ gửi khi có mạng' : 'Đã lưu báo lỗi trên máy — đăng nhập để gửi')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_KINDS.map((k) => (
          <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>
            {k.label}
          </Chip>
        ))}
      </div>
      <TextArea
        label="Mô tả"
        value={message}
        maxLength={MAX_MESSAGE}
        rows={4}
        placeholder={kind === 'answer' ? 'Bạn đã trả lời gì, vì sao nghĩ là đúng?' : kind === 'content' ? 'Phần nào sai (nghĩa, phiên âm, câu ví dụ…), nên sửa thế nào?' : 'Bạn đang làm gì thì gặp lỗi?'}
        onChange={(e) => setMessage(e.target.value)}
      />
      <p className="text-xs leading-relaxed text-subtle">
        Kèm theo: phiên bản app, trang đang mở, loại thiết bị{about ? `, ${about}` : ''}. {auth.status === 'signed_in' ? 'Gửi vào tài khoản của bạn trên máy chủ.' : 'Chưa đăng nhập: báo lỗi được lưu trên máy, đăng nhập rồi sẽ tự gửi.'}
      </p>
      <Button variant="primary" icon={Send} disabled={!ok || busy} className="disabled:opacity-60" onClick={() => void send()}>
        Gửi báo lỗi
      </Button>
    </div>
  )
}
