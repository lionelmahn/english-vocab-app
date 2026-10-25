import { AudioLines, ClipboardPaste, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { clipKey, clipTargets } from '../core/voiceClips'
import { useSettings } from '../lib/settings'
import { showToast } from '../lib/toast'
import { isAppleDevice } from '../services/speech'
import { cancelPending, pasteFromClipboard, runShortcut, useClipKeys, usePending } from '../services/voiceClips'
import { Button, Card } from './ui'

/**
 * Thanh "Dán âm thanh" nổi phía dưới, hiện ở mọi trang khi đang chờ kết quả từ app Phím tắt
 * (trang Giọng iPhone có ô dán riêng nên không hiện ở đó).
 */
export function VoiceClipBar({ raised }: { raised: boolean }) {
  const pending = usePending()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const show = !!pending && location.pathname !== '/voice'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="voice-clip-bar"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4"
          style={{ bottom: raised ? 'calc(5.25rem + env(safe-area-inset-bottom))' : 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="rounded-2xl border-2 border-accent/40 bg-surface p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-2.5">
              <AudioLines aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <p className="flex-1 text-[0.8125rem] leading-snug">
                Phím tắt chạy xong thì bấm <b>Dán âm thanh</b> ({pending.texts.length} mục), rồi bấm “Dán” khi iPhone hỏi.
              </p>
              <button
                type="button"
                aria-label="Hủy lượt tạo giọng"
                className="-m-1 rounded-full p-1 text-muted"
                onClick={() => {
                  cancelPending()
                  setError(null)
                }}
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
            {error && <p className="mt-2 text-[0.75rem] leading-snug text-danger">{error}</p>}
            <Button
              variant="primary"
              icon={ClipboardPaste}
              className="mt-2.5 h-10 w-full text-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const r = await pasteFromClipboard()
                setBusy(false)
                if (r.ok) {
                  setError(null)
                  showToast(`Đã lưu ${r.saved} âm thanh giọng iPhone`)
                } else setError(r.message)
              }}
            >
              {busy ? 'Đang lưu…' : 'Dán âm thanh'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Ở trang một từ: nếu từ/câu ví dụ chưa có giọng iPhone thì mời tạo ngay. */
export function VoiceClipPrompt({ item }: { item: { term: string; examples: readonly { en: string }[] } }) {
  const settings = useSettings()
  const have = useClipKeys()
  const pending = usePending()
  const navigate = useNavigate()
  if (!isAppleDevice() || !settings.useVoiceClips) return null
  const missing = clipTargets([item], have).map((t) => t.text)
  if (missing.length === 0) return null

  if (have.size === 0)
    return (
      <Card>
        <div className="flex items-center gap-3">
          <AudioLines aria-hidden className="h-5 w-5 shrink-0 text-accent" />
          <p className="flex-1 text-[0.8125rem] leading-snug text-muted">Muốn nghe từ bằng giọng Nâng cao/Cao cấp bạn tải trên iPhone?</p>
          <Button variant="ghost" className="h-9 shrink-0 px-2 text-sm" onClick={() => navigate('/voice')}>
            Thiết lập
          </Button>
        </div>
      </Card>
    )

  return (
    <Card>
      <div className="flex items-center gap-3">
        <AudioLines aria-hidden className="h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold">Chưa có giọng iPhone</p>
          <p className="text-[0.75rem] leading-snug text-muted">
            {missing.length === 1 ? '1 mục' : `${missing.length} mục (từ và câu ví dụ)`} đang phát bằng giọng tạm.
          </p>
        </div>
        <Button variant="primary" className="h-10 shrink-0 px-3 text-sm" disabled={!!pending} onClick={() => void runShortcut(missing)}>
          {pending ? 'Đang chờ dán' : 'Tạo giọng'}
        </Button>
      </div>
    </Card>
  )
}

/** Ở ô nhập từ: nhắc rằng giọng iPhone chỉ có sau khi lưu từ. */
export function VoiceClipFormNote({ text }: { text: string }) {
  const settings = useSettings()
  const have = useClipKeys()
  const t = text.trim()
  if (!t || !isAppleDevice() || !settings.useVoiceClips || have.size === 0 || have.has(clipKey(t))) return null
  return <p className="-mt-2 text-[0.75rem] leading-snug text-muted">Đang nghe giọng tạm. Lưu từ xong, bấm “Tạo giọng” ở trang của từ để có giọng iPhone bạn chọn.</p>
}
