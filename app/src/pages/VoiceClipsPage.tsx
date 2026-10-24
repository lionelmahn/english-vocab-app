import { ChevronDown, ClipboardPaste, Play, Trash2, Wand2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BackButton, TextArea } from '../components/kit'
import { Button, Card, FormMessage, Page, SectionTitle, Switch, TextField } from '../components/ui'
import { CLIP_BATCH, clipKey, clipTargets, DEFAULT_SHORTCUT_NAME, shortcutRunUrl } from '../core/voiceClips'
import { useLibrary } from '../lib/hooks'
import { updateSettings, useSettings } from '../lib/settings'
import { showToast } from '../lib/toast'
import { APP_VERSION } from '../lib/version'
import { isAppleDevice, speak } from '../services/speech'
import { cancelPending, clearClips, copyRequest, getPending, pasteFromClipboard, saveFromPaste, setPending, useClipKeys, usePending, type SaveResult } from '../services/voiceClips'

type Message = { tone: 'error' | 'success'; text: string } | null

function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-strong">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  )
}

/** Tên tác vụ trong app Phím tắt (kèm tên tiếng Anh để dễ tìm). */
function Action({ vi, en }: { vi: string; en: string }) {
  return (
    <>
      <b className="text-text">{vi}</b> <span className="text-subtle">({en})</span>
    </>
  )
}

export function VoiceClipsPage() {
  const lib = useLibrary()
  const settings = useSettings()
  const have = useClipKeys()
  const pending = usePending()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [shake, setShake] = useState(0)
  const [manual, setManual] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null)
  const [returned, setReturned] = useState(false)
  const apple = isAppleDevice()
  const name = settings.shortcutName.trim() || DEFAULT_SHORTCUT_NAME

  // Quay lại từ app Phím tắt: làm nổi nút "Dán âm thanh".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && getPending()) setReturned(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Từ đang học/ôn trước, rồi đến từ chưa học.
  const ordered = useMemo(() => (lib ? [...lib.items].sort((a, b) => Number(lib.cards.has(b.id)) - Number(lib.cards.has(a.id))) : []), [lib])
  const all = useMemo(() => clipTargets(ordered, new Set()), [ordered])
  const todo = useMemo(() => clipTargets(ordered, have), [ordered, have])
  const terms = all.filter((t) => t.kind === 'term')
  const sentences = all.filter((t) => t.kind === 'sentence')
  const termsDone = terms.filter((t) => have.has(clipKey(t.text))).length
  const sentencesDone = sentences.filter((t) => have.has(clipKey(t.text))).length
  const batch = todo.slice(0, CLIP_BATCH).map((t) => t.text)
  const guideShown = guideOpen ?? have.size === 0

  function done(r: SaveResult) {
    setBusy(false)
    if (r.ok) {
      setMessage({ tone: 'success', text: `Đã lưu ${r.saved} âm thanh giọng iPhone.` })
      showToast(`Đã lưu ${r.saved} âm thanh`)
      setReturned(false)
      setManual('')
      setShowManual(false)
    } else {
      setMessage({ tone: 'error', text: r.message })
      setShake((k) => k + 1)
    }
  }

  async function run() {
    setPending(batch)
    setMessage(null)
    setReturned(false)
    // Chép sẵn danh sách vào bộ nhớ tạm: phím tắt đọc từ "Bảng nhớ tạm" (chắc chắn hơn nhận qua đường dẫn).
    await copyRequest(batch)
    window.location.href = shortcutRunUrl(name, batch)
  }

  function preview() {
    const keys = [...have]
    const termKeys = keys.filter((k) => terms.some((t) => clipKey(t.text) === k))
    const pool = termKeys.length > 0 ? termKeys : keys
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) void speak(pick, { accent: settings.accent })
  }

  return (
    <Page title="Giọng iPhone" subtitle="Đọc từ và câu bằng giọng Nâng cao/Cao cấp bạn đã tải, nhờ app Phím tắt." back={<BackButton fallback="/me" />}>
      {!apple && (
        <Card>
          <p className="text-[14px] leading-relaxed text-muted">Tính năng này cần app Phím tắt trên iPhone, iPad hoặc Mac. Mở app trên iPhone để tạo giọng.</p>
        </Card>
      )}

      <Card>
        <SectionTitle>Đã có giọng iPhone</SectionTitle>
        <div className="flex flex-col gap-3">
          <Progress label="Từ vựng" done={termsDone} total={terms.length} />
          <Progress label="Câu ví dụ" done={sentencesDone} total={sentences.length} />
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <div className="flex-1">
            <p className="text-[15px] font-medium">Dùng giọng iPhone khi phát âm</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">Mục nào chưa có thì dùng bản ghi Wiktionary hoặc giọng máy.</p>
          </div>
          <Switch label="Dùng giọng iPhone khi phát âm" checked={settings.useVoiceClips} onChange={(v) => updateSettings({ useVoiceClips: v })} />
        </div>
        {have.size > 0 && (
          <Button icon={Play} className="mt-3 w-full" onClick={preview}>
            Nghe thử một từ
          </Button>
        )}
      </Card>

      <Card>
        <SectionTitle>Tạo âm thanh</SectionTitle>
        {!lib ? (
          <p className="text-sm text-muted">Đang tải…</p>
        ) : todo.length === 0 ? (
          <p className="text-[14px] leading-relaxed text-muted">
            {all.length === 0 ? 'Sổ tay chưa có từ nào.' : 'Mọi từ và câu ví dụ đều đã có giọng iPhone. Thêm từ mới thì quay lại đây tạo tiếp.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] leading-relaxed text-muted">
              Còn <b className="text-text">{todo.length}</b> mục chưa có. Mỗi lượt tạo {CLIP_BATCH} mục: app mở phím tắt “{name}”, phím tắt đọc lần lượt rồi chép âm thanh vào bộ nhớ tạm.
            </p>
            <Button variant={pending ? 'secondary' : 'primary'} icon={Wand2} className="w-full" onClick={run} disabled={busy}>
              {pending ? `Tạo lại ${batch.length} mục` : `Tạo ${batch.length} mục tiếp theo`}
            </Button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {pending && (
            <motion.div
              key="paste"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`mt-3 flex flex-col gap-3 rounded-2xl p-3 ${returned ? 'bg-accent-soft' : 'bg-surface-2'}`}>
                <p className="text-[14px] leading-relaxed">
                  <b>Bước 2:</b> đợi phím tắt chạy xong ({pending.texts.length} mục), quay lại app rồi bấm <b>Dán âm thanh</b>. Khi iPhone hiện nút “Dán”, bấm vào đó.
                </p>
                <Button
                  variant="primary"
                  icon={ClipboardPaste}
                  className={`w-full ${returned ? 'animate-pulse' : ''}`}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    done(await pasteFromClipboard())
                  }}
                >
                  {busy ? 'Đang lưu…' : 'Dán âm thanh'}
                </Button>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold">
                  <a
                    href={shortcutRunUrl(name, pending.texts)}
                    className="text-accent"
                    onClick={() => {
                      void copyRequest(pending.texts)
                    }}
                  >
                    Mở lại Phím tắt
                  </a>
                  <button type="button" className="text-accent" onClick={() => setShowManual((v) => !v)}>
                    {showManual ? 'Ẩn ô dán thủ công' : 'Dán thủ công'}
                  </button>
                  <button
                    type="button"
                    className="text-muted"
                    onClick={() => {
                      cancelPending()
                      setMessage(null)
                    }}
                  >
                    Hủy lượt này
                  </button>
                </div>
                {showManual && (
                  <div className="flex flex-col gap-2">
                    <TextArea label="Giữ ngón tay trong ô, chọn “Dán”" rows={3} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Nội dung phím tắt đã chép…" />
                    <Button
                      disabled={!manual.trim() || busy}
                      onClick={async () => {
                        setBusy(true)
                        done(await saveFromPaste(manual))
                      }}
                    >
                      Lưu âm thanh đã dán
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-3 empty:hidden">
          <FormMessage message={message} shakeKey={shake} />
        </div>
      </Card>

      <Card>
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setGuideOpen(!guideShown)} aria-expanded={guideShown}>
          <span className="text-[15px] font-semibold">Tạo phím tắt “{name}” (làm một lần)</span>
          <ChevronDown aria-hidden className={`h-5 w-5 text-muted transition-transform ${guideShown ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {guideShown && (
            <motion.div key="guide" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <ol className="mt-3 flex flex-col gap-3 text-[14px] leading-relaxed text-muted">
                <Step n={1}>
                  Mở app <b className="text-text">Phím tắt</b>, bấm <b className="text-text">+</b>. Bấm tên ở trên cùng → <b className="text-text">Đổi tên</b> thành{' '}
                  <b className="text-text">{name}</b> (đúng chữ hoa, chữ thường).
                </Step>
                <Step n={2}>
                  Thêm tác vụ <Action vi="Tách văn bản" en="Split Text" />. Bấm ô <b className="text-text">Văn bản</b> của nó → chọn <b className="text-text">Bảng nhớ tạm</b>{' '}
                  <span className="text-subtle">(Clipboard)</span>: app chép sẵn danh sách từ vào đó trước khi mở phím tắt. Phần “bằng” để <b className="text-text">Dòng mới</b>.
                </Step>
                <Step n={3}>
                  Thêm tác vụ <Action vi="Lặp lại với từng mục" en="Repeat with Each" />. Nó tự nhận “Chia văn bản”.
                </Step>
                <Step n={4}>
                  Thêm <Action vi="Tạo âm thanh đọc từ văn bản" en="Make Spoken Audio from Text" />, rồi giữ và kéo nó vào <b className="text-text">giữa</b> “Lặp lại” và
                  “Kết thúc lặp lại”. Bấm ô <b className="text-text">Văn bản</b> → chọn <b className="text-text">Lặp lại mục</b> <span className="text-subtle">(Repeat Item)</span>. Bấm mũi tên
                  mở rộng để chọn Ngôn ngữ, Giọng nói (ví dụ Jamie (Cao cấp)) và Tốc độ.
                </Step>
                <Step n={5}>
                  Thêm <Action vi="Mã hóa Base64" en="Base64 Encode" />, kéo vào trong vòng lặp, ngay dưới bước 4.{' '}
                  <b className="text-danger">Quan trọng:</b> ô sau chữ “Mã hóa” phải là <b className="text-text">âm thanh vừa tạo</b>, không phải “Lặp lại mục”. Bấm vào ô đó →{' '}
                  <b className="text-text">Chọn biến</b> → chạm vào khối <b className="text-text">“Tạo âm thanh đọc từ”</b> ở trên.
                </Step>
                <Step n={6}>
                  Dưới “Kết thúc lặp lại”, thêm <Action vi="Kết hợp văn bản" en="Combine Text" /> (nó tự nhận “Lặp lại kết quả”). Bấm <b className="text-text">Dòng mới</b> → chọn{' '}
                  <b className="text-text">Tùy chỉnh</b> → gõ dấu <b className="text-text">|</b>
                </Step>
                <Step n={7}>
                  Thêm <Action vi="Sao chép vào bảng nhớ tạm" en="Copy to Clipboard" /> rồi bấm <b className="text-text">Xong</b>.
                </Step>
              </ol>
              <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">
                Thứ tự đúng: Tách (Bảng nhớ tạm) → Lặp lại với từng mục → <i>Tạo âm thanh đọc từ (Lặp lại mục) → Mã hóa (âm thanh vừa tạo)</i> → Kết thúc lặp lại → Kết hợp (Lặp lại kết quả, dấu |) → Sao chép vào bảng nhớ tạm. Lần
                đầu chạy, iPhone có thể hỏi quyền dán/truy cập bảng nhớ tạm: chọn <b>Luôn cho phép</b>.
              </p>
              <div className="mt-3">
                <TextField label="Tên phím tắt" value={settings.shortcutName} onChange={(e) => updateSettings({ shortcutName: e.target.value })} autoCapitalize="none" autoCorrect="off" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {have.size > 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[13px] leading-snug text-muted">Muốn đổi sang giọng khác? Xóa hết rồi tạo lại với giọng mới trong phím tắt.</p>
            <Button
              icon={Trash2}
              className="h-10 shrink-0 px-3 text-sm"
              onClick={async () => {
                if (!window.confirm(`Xóa ${have.size} âm thanh giọng iPhone trên máy này?`)) return
                await clearClips()
                showToast('Đã xóa giọng iPhone')
              }}
            >
              Xóa hết
            </Button>
          </div>
        </Card>
      )}
      <p className="text-center text-[12px] text-subtle">Phiên bản app {APP_VERSION}</p>
    </Page>
  )
}
