import { Check, Flag, FlagOff, ListMusic, Mic, Play, RotateCcw, Square, Undo2, Upload, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { POS_LABEL } from '../core/pos'
import { clipKey } from '../core/voiceClips'
import { chooseUrl, isShortTerm, withoutFlagged } from '../core/wordAudio'
import type { Accent, AudioAsset, WordAudio } from '../db/types'
import { useSettings } from '../lib/settings'
import { showToast } from '../lib/toast'
import { listWordRecordings, resolveWordAudio, type WiktionaryRecording } from '../services/audio'
import { chooseDictionary, flagDictionary, flaggedUrls, MAX_AUDIO_BYTES, pickChosen, removeAsset, saveWordAudio, useWordAssets, type WordRef } from '../services/audioStore'
import { useAuth } from '../services/auth'
import { playAudio, speak, useSpeaking } from '../services/speech'
import { useSyncStatus } from '../services/sync'
import { useClipKeys } from '../services/voiceClips'
import { Badge, Segmented, Sheet } from './kit'
import { Button, Card, SectionTitle } from './ui'

/**
 * Phát âm của một từ (R7.8, R13.8): cho biết đang phát từ nguồn nào, cho ghi âm hoặc tải file lên,
 * chọn bản Wiktionary khác và báo bản đọc sai. Mỗi giọng (Mỹ/Anh) chọn riêng.
 */

const ACCENT_LABEL: Record<Accent, string> = { us: 'Mỹ', uk: 'Anh' }
/** Ghi âm tối đa (giây): đủ cho một từ hoặc cụm. */
const MAX_SECONDS = 15

type Source =
  | { kind: 'own'; asset: AudioAsset }
  | { kind: 'clip' }
  | { kind: 'wiktionary'; url: string }
  | { kind: 'device' }

const OWN_LABEL: Record<AudioAsset['source'], string> = {
  recording: 'Bản bạn ghi âm',
  upload: 'File bạn tải lên',
  dictionary: 'Bản Wiktionary bạn chọn',
  tts: 'Giọng iPhone',
}

function sourceLabel(s: Source, accent: Accent): string {
  if (s.kind === 'own') return OWN_LABEL[s.asset.source] + (s.asset.accent !== accent ? ` (giọng ${ACCENT_LABEL[s.asset.accent]})` : '')
  if (s.kind === 'clip') return 'Giọng iPhone bạn đã tạo'
  if (s.kind === 'wiktionary') return 'Giọng người thật (Wiktionary)'
  return 'Giọng đọc của máy'
}

type Panel = { kind: 'record' } | { kind: 'review'; blob: Blob; source: 'recording' | 'upload' } | { kind: 'choose' }

export function WordAudioCard({ item }: { item: WordRef }) {
  const settings = useSettings()
  const [accent, setAccent] = useState<Accent>(settings.accent)
  const assets = useWordAssets(item.term)
  const clipKeys = useClipKeys()
  const speaking = useSpeaking() === item.term
  const auth = useAuth()
  const sync = useSyncStatus()
  const [wiktionary, setWiktionary] = useState<{ term: string; audio: WordAudio | null } | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    resolveWordAudio(item.term).then((audio) => {
      if (!cancelled) setWiktionary({ term: item.term, audio })
    })
    return () => {
      cancelled = true
    }
  }, [item.term])

  if (!assets) return null
  const chosen = pickChosen(assets, accent)
  const flagged = flaggedUrls(assets)
  const audio = wiktionary?.term === item.term ? wiktionary.audio : null
  const wikUrl = settings.preferRecordings && isShortTerm(item.term) ? chooseUrl(withoutFlagged(audio, flagged), accent) : null
  const source: Source = chosen
    ? { kind: 'own', asset: chosen }
    : settings.useVoiceClips && clipKeys.has(clipKey(item.term))
      ? { kind: 'clip' }
      : wikUrl
        ? { kind: 'wiktionary', url: wikUrl }
        : { kind: 'device' }
  const flaggedUrl = source.kind === 'wiktionary' ? source.url : source.kind === 'own' && source.asset.source === 'dictionary' ? source.asset.remoteUrl : undefined

  function pickFile(file: File | undefined) {
    if (!file) return
    const audioLike = file.type.startsWith('audio/') || /\.(m4a|mp3|wav|aac|ogg|oga|opus|webm|caf|aiff?)$/i.test(file.name)
    if (!audioLike) return showToast('File này không phải âm thanh')
    if (file.size > MAX_AUDIO_BYTES) return showToast('File quá lớn: tối đa 2 MB (khoảng một phút)')
    setPanel({ kind: 'review', blob: file, source: 'upload' })
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle className="">Phát âm</SectionTitle>
        <div className="w-36">
          <Segmented
            layoutId="word-audio-accent"
            value={accent}
            onChange={setAccent}
            options={[
              { value: 'us', label: 'Mỹ' },
              { value: 'uk', label: 'Anh' },
            ]}
          />
        </div>
      </div>

      <button type="button" onClick={() => void speak(item.term, { accent })} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          {speaking && (
            <motion.span
              className="absolute inset-0 rounded-full bg-accent"
              initial={{ opacity: 0.35, scale: 1 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
          <Volume2 aria-hidden className="relative h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{sourceLabel(source, accent)}</span>
          <span className="block text-[12px] text-muted">Đang dùng cho giọng {ACCENT_LABEL[accent]} · chạm để nghe</span>
        </span>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ToolButton icon={Mic} onClick={() => setPanel({ kind: 'record' })}>
          Ghi âm
        </ToolButton>
        <ToolButton icon={Upload} onClick={() => fileInput.current?.click()}>
          Tải file lên
        </ToolButton>
        <ToolButton icon={ListMusic} onClick={() => setPanel({ kind: 'choose' })}>
          Bản khác
        </ToolButton>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {(flaggedUrl || chosen) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {flaggedUrl && (
            <LinkButton
              icon={Flag}
              onClick={async () => {
                await flagDictionary(item, accent, flaggedUrl)
                showToast('Đã báo đọc sai, từ nay không phát bản này')
              }}
            >
              Báo bản này đọc sai
            </LinkButton>
          )}
          {chosen && (
            <LinkButton
              icon={Undo2}
              onClick={async () => {
                await removeAsset(chosen)
                showToast('Đã bỏ, quay về nguồn mặc định')
              }}
            >
              {chosen.source === 'dictionary' ? 'Bỏ chọn bản này' : 'Xóa bản của tôi'}
            </LinkButton>
          )}
        </div>
      )}

      {(chosen?.source === 'recording' || chosen?.source === 'upload') && (
        <p className="mt-3 text-[12px] leading-snug text-subtle">
          {auth.status !== 'signed_in'
            ? 'Bản này đang lưu trên máy này; đăng nhập để có trên các máy khác.'
            : sync.audio === 'not_ready'
              ? 'Kho âm thanh trên máy chủ chưa mở nên bản này đang lưu trên máy này.'
              : chosen.storagePath
                ? 'Đã lưu lên kho, có trên mọi máy đăng nhập cùng tài khoản.'
                : 'Sẽ tải lên kho ở lần đồng bộ tới.'}
        </p>
      )}

      <Sheet
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.kind === 'choose' ? 'Các bản ghi trên Wiktionary' : panel?.kind === 'review' ? 'Nghe thử trước khi lưu' : `Ghi âm “${item.term}”`}
      >
        {panel?.kind === 'record' && <Recorder accent={accent} onRecorded={(blob) => setPanel({ kind: 'review', blob, source: 'recording' })} />}
        {panel?.kind === 'review' && (
          <Review
            blob={panel.blob}
            source={panel.source}
            accent={accent}
            onRetry={() => {
              if (panel.source === 'recording') return setPanel({ kind: 'record' })
              setPanel(null)
              fileInput.current?.click()
            }}
            onSave={async (data, mime) => {
              await saveWordAudio(item, accent, panel.source, { data, mime })
              setPanel(null)
              showToast(`Đã lưu cho giọng ${ACCENT_LABEL[accent]}`)
            }}
          />
        )}
        {panel?.kind === 'choose' && <ChooseRecording item={item} accent={accent} assets={assets} current={source} onDone={() => setPanel(null)} />}
      </Sheet>
    </Card>
  )
}

function ToolButton({ icon: Icon, onClick, children }: { icon: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-2xl border-2 border-line bg-surface px-1 py-2.5 text-[13px] font-semibold"
    >
      <Icon aria-hidden className="h-5 w-5 text-accent" />
      {children}
    </motion.button>
  )
}

function LinkButton({ icon: Icon, onClick, children }: { icon: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 py-1 text-[13px] font-semibold text-muted">
      <Icon aria-hidden className="h-4 w-4" />
      {children}
    </button>
  )
}

// ---- Ghi âm ------------------------------------------------------------------------------------

/** Loại file ghi âm: iPhone ghi được m4a (phát được ở mọi máy), máy khác thường là webm. */
function recorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t))
}

function micError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'App chưa được dùng micro. Trên iPhone: Cài đặt → Safari → Micro → Hỏi hoặc Cho phép, rồi thử lại.'
  if (name === 'NotFoundError') return 'Không tìm thấy micro trên máy này.'
  return 'Không mở được micro. Thử lại, hoặc dùng “Tải file lên”.'
}

function Recorder({ accent, onRecorded }: { accent: Accent; onRecorded: (blob: Blob) => void }) {
  const [phase, setPhase] = useState<'idle' | 'asking' | 'recording'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const cleanup = useRef<() => void>(() => undefined)

  // Đóng bảng giữa chừng: tắt micro, bỏ bản đang ghi.
  useEffect(() => () => cleanup.current(), [])

  const supported = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  if (!supported) return <p className="text-sm leading-relaxed text-muted">Trình duyệt này không ghi âm được. Hãy ghi bằng app Ghi âm của máy rồi dùng “Tải file lên”.</p>

  async function start() {
    setError(null)
    setPhase('asking')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      setPhase('idle')
      setError(micError(e))
      return
    }
    const type = recorderType()
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []
    const startedAt = Date.now()
    let keep = true
    const tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000
      setElapsed(s)
      if (s >= MAX_SECONDS && rec.state === 'recording') rec.stop()
    }, 200)
    cleanup.current = () => {
      keep = false
      clearInterval(tick)
      if (rec.state !== 'inactive') rec.stop()
      stream.getTracks().forEach((t) => t.stop())
    }
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      clearInterval(tick)
      stream.getTracks().forEach((t) => t.stop())
      setPhase('idle')
      const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' })
      if (keep && blob.size > 0) onRecorded(blob)
    }
    recorder.current = rec
    setElapsed(0)
    rec.start()
    setPhase('recording')
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-2">
      <p className="text-center text-sm leading-relaxed text-muted">
        Đọc to, rõ một lần theo giọng {ACCENT_LABEL[accent]}. Tối đa {MAX_SECONDS} giây; bạn được nghe thử trước khi lưu.
      </p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        disabled={phase === 'asking'}
        aria-label={phase === 'recording' ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
        onClick={() => (phase === 'recording' ? recorder.current?.stop() : void start())}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full ${phase === 'recording' ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent'}`}
      >
        {phase === 'recording' && (
          <motion.span className="absolute inset-0 rounded-full bg-danger" initial={{ opacity: 0.4, scale: 1 }} animate={{ opacity: 0, scale: 1.5 }} transition={{ duration: 1.1, repeat: Infinity }} />
        )}
        {phase === 'recording' ? <Square aria-hidden className="relative h-7 w-7" fill="currentColor" /> : <Mic aria-hidden className="h-8 w-8" />}
      </motion.button>
      <p className="h-5 text-sm font-semibold tabular-nums">
        {phase === 'recording' ? `Đang ghi… ${Math.floor(elapsed)}/${MAX_SECONDS} giây · bấm để dừng` : phase === 'asking' ? 'Đang mở micro…' : 'Bấm để bắt đầu'}
      </p>
      {error && <p className="text-center text-[13px] leading-snug text-danger">{error}</p>}
    </div>
  )
}

/** Nghe thử bản vừa ghi/chọn rồi mới lưu (R7.8). */
function Review({
  blob,
  source,
  accent,
  onRetry,
  onSave,
}: {
  blob: Blob
  source: 'recording' | 'upload'
  accent: Accent
  onRetry: () => void
  onSave: (data: ArrayBuffer, mime: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const kb = Math.max(1, Math.round(blob.size / 1024))

  async function preview() {
    const url = URL.createObjectURL(blob)
    const ok = await playAudio(url, 'preview')
    URL.revokeObjectURL(url)
    if (!ok) setError('Máy này không phát được file này. Thử file khác (m4a hoặc mp3).')
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-sm text-muted">
        {source === 'recording' ? 'Bản vừa ghi' : 'File đã chọn'} · {kb} KB · dùng cho giọng {ACCENT_LABEL[accent]}
      </p>
      <Button icon={Play} onClick={() => void preview()}>
        Nghe thử
      </Button>
      {error && <p className="text-[13px] leading-snug text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button icon={RotateCcw} onClick={onRetry}>
          {source === 'recording' ? 'Ghi lại' : 'Chọn file khác'}
        </Button>
        <Button
          variant="primary"
          icon={Check}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onSave(await blob.arrayBuffer(), blob.type || 'audio/mp4')
            setBusy(false)
          }}
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}

// ---- Chọn bản Wiktionary khác ------------------------------------------------------------------

const FILE_ACCENT: Record<WiktionaryRecording['accent'], string> = { us: 'Giọng Mỹ', uk: 'Giọng Anh', other: 'Giọng khác' }

function ChooseRecording({ item, accent, assets, current, onDone }: { item: WordRef; accent: Accent; assets: AudioAsset[]; current: Source; onDone: () => void }) {
  const [list, setList] = useState<WiktionaryRecording[] | 'loading' | 'error'>('loading')
  const playing = useSpeaking()

  useEffect(() => {
    let cancelled = false
    listWordRecordings(item.term).then(
      (r) => !cancelled && setList(r),
      () => !cancelled && setList('error'),
    )
    return () => {
      cancelled = true
    }
  }, [item.term])

  if (list === 'loading') return <p className="py-6 text-center text-sm text-muted">Đang tải danh sách…</p>
  if (list === 'error') return <p className="py-6 text-center text-sm text-muted">Không tải được danh sách. Kiểm tra mạng rồi thử lại.</p>
  if (list.length === 0)
    return <p className="py-6 text-center text-sm leading-relaxed text-muted">Wiktionary chưa có bản ghi cho từ này. Bạn có thể tự ghi âm hoặc tải file lên.</p>

  const currentUrl = current.kind === 'wiktionary' ? current.url : current.kind === 'own' ? current.asset.remoteUrl : undefined
  const flags = new Map(assets.filter((a) => a.status === 'flagged' && a.remoteUrl).map((a) => [a.remoteUrl!, a]))

  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pt-1">
      <p className="mb-1 text-[13px] leading-snug text-muted">Nghe từng bản rồi chọn bản dùng cho giọng {ACCENT_LABEL[accent]}. Bản đọc sai thì báo để không phát nữa.</p>
      {list.map((r) => {
        const flag = flags.get(r.url)
        const inUse = r.url === currentUrl
        return (
          <div key={r.url} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
            <button
              type="button"
              aria-label={`Nghe ${r.file}`}
              onClick={() => void playAudio(r.url, r.url)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
            >
              {playing === r.url ? <Volume2 aria-hidden className="h-5 w-5" /> : <Play aria-hidden className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {FILE_ACCENT[r.accent]}
                {r.pos && <span className="font-normal text-muted">· {POS_LABEL[r.pos].toLowerCase()}</span>}
                {inUse && <Badge tone="accent">Đang dùng</Badge>}
                {flag && <Badge tone="danger">Đã báo sai</Badge>}
              </p>
              <p className="truncate text-[11px] text-subtle">{r.file}</p>
            </div>
            {flag ? (
              <button type="button" aria-label="Bỏ báo sai" onClick={() => void removeAsset(flag)} className="rounded-xl p-2 text-muted">
                <FlagOff aria-hidden className="h-5 w-5" />
              </button>
            ) : (
              <>
                <button type="button" aria-label="Báo bản này đọc sai" onClick={() => void flagDictionary(item, accent, r.url, r.file)} className="rounded-xl p-2 text-muted">
                  <Flag aria-hidden className="h-5 w-5" />
                </button>
                <Button
                  variant="primary"
                  className="h-9 px-3 text-sm"
                  disabled={inUse}
                  onClick={async () => {
                    await chooseDictionary(item, accent, r.url, r.file)
                    showToast(`Đã chọn cho giọng ${ACCENT_LABEL[accent]}`)
                    onDone()
                  }}
                >
                  Dùng
                </Button>
              </>
            )}
          </div>
        )
      })}
      <p className="mt-1 text-[11px] leading-snug text-subtle">Bản ghi của cộng đồng Wiktionary/Wikimedia Commons, giấy phép mở (CC BY-SA, CC BY hoặc PD).</p>
    </div>
  )
}
