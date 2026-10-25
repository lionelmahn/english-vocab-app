import { Mic, Play, Repeat2, RotateCcw, Square, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { recordingSupported, useRecorder } from '../lib/recorder'
import { useSettings } from '../lib/settings'
import { playAudio, speak, stopSpeaking } from '../services/speech'
import { Button } from './ui'

/** Một từ thường đọc dưới 3 giây; cụm từ, câu ngắn cần lâu hơn. */
const MAX_SECONDS = 8

/**
 * Luyện đọc (R7.2): ghi giọng mình đọc từ, rồi nghe lại xen với bản mẫu để tự so. Bản ghi chỉ nằm trong bộ nhớ,
 * không lưu và không gửi đi; muốn dùng bản ghi làm phát âm của từ thì dùng "Ghi âm" ở thẻ Phát âm.
 */
export function SpeakPractice({ text }: { text: string }) {
  const { accent } = useSettings()
  const [recording, setRecording] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const urlRef = useRef<string | null>(null)
  const { phase, error, elapsed, start, stop } = useRecorder(MAX_SECONDS, (blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    setRecording(urlRef.current)
  })

  // Đóng bảng hoặc rời trang: bỏ bản ghi, dừng phát.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      stopSpeaking()
    },
    [],
  )

  if (!recordingSupported()) return <p className="text-sm leading-relaxed text-muted">Trình duyệt này không ghi âm được, nên chưa luyện đọc ở đây được.</p>

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    await action()
    setBusy(false)
  }

  const playMine = () => (recording ? playAudio(recording, `mine:${text}`) : Promise.resolve(false))

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm leading-relaxed text-muted">
        Nghe mẫu, rồi bấm micro và đọc to <b className="text-text">{text}</b>. Nghe lại xen kẽ với mẫu để tự so. Bản ghi không được lưu.
      </p>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        disabled={phase === 'asking' || busy}
        aria-label={phase === 'recording' ? 'Dừng ghi' : recording ? 'Ghi lại giọng bạn' : 'Ghi giọng bạn'}
        onClick={() => {
          if (phase === 'recording') return stop()
          stopSpeaking()
          void start()
        }}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full ${phase === 'recording' ? 'bg-danger text-on-danger' : 'bg-accent text-on-accent'}`}
      >
        {phase === 'recording' && (
          <motion.span className="absolute inset-0 rounded-full bg-danger" initial={{ opacity: 0.4, scale: 1 }} animate={{ opacity: 0, scale: 1.5 }} transition={{ duration: 1.1, repeat: Infinity }} />
        )}
        {phase === 'recording' ? <Square aria-hidden className="relative h-7 w-7" fill="currentColor" /> : recording ? <RotateCcw aria-hidden className="h-8 w-8" /> : <Mic aria-hidden className="h-8 w-8" />}
      </motion.button>
      <p className="h-5 text-sm font-semibold tabular-nums">
        {phase === 'recording'
          ? `Đang ghi… ${Math.floor(elapsed)}/${MAX_SECONDS} giây · bấm để dừng`
          : phase === 'asking'
            ? 'Đang mở micro…'
            : recording
              ? 'Bấm để ghi lại'
              : 'Bấm để ghi giọng bạn'}
      </p>
      {error && <p className="text-center text-[0.8125rem] leading-snug text-danger">{error}</p>}
      <div className="grid w-full grid-cols-2 gap-2">
        <Button icon={Volume2} className="h-11 text-sm" disabled={phase !== 'idle' || busy} onClick={() => void run(() => speak(text, { accent }))}>
          Nghe mẫu
        </Button>
        <Button icon={Play} className="h-11 text-sm" disabled={!recording || phase !== 'idle' || busy} onClick={() => void run(playMine)}>
          Nghe bạn
        </Button>
        <Button
          icon={Repeat2}
          variant="primary"
          className="col-span-2 h-11 text-sm"
          disabled={!recording || phase !== 'idle' || busy}
          onClick={() =>
            void run(async () => {
              await speak(text, { accent })
              await new Promise((r) => setTimeout(r, 350))
              await playMine()
            })
          }
        >
          Nghe mẫu rồi nghe bạn
        </Button>
      </div>
    </div>
  )
}
