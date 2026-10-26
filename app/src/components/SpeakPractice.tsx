import { AudioLines, Check, CircleX, Mic, Play, Repeat2, RotateCcw, Square, TriangleAlert, Volume2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { judgePronunciation, speechTokens, type PronounceResult } from '../core/pronounce'
import { recordingSupported, useRecorder } from '../lib/recorder'
import { useSettings } from '../lib/settings'
import { useAiOn, useAiRun } from '../lib/useAi'
import { prepareSpeech, SILENCE_PEAK, type PreparedAudio } from '../lib/wav'
import { transcribe } from '../services/ai'
import { pronounceTip } from '../services/aiTasks'
import { playAudio, speak, stopSpeaking } from '../services/speech'
import { AiErrorText, AiLink, AiNote } from './AiAssist'
import { Chip } from './kit'
import { Button } from './ui'

/** Một từ thường đọc dưới 3 giây; cụm từ, câu ngắn cần lâu hơn. */
const MAX_SECONDS = 8

/**
 * Luyện đọc (R7.2): ghi giọng mình đọc từ (hoặc câu ví dụ), rồi nghe lại xen với bản mẫu để tự so. Chấm phát âm (R7.3):
 * nếu bật trợ lý AI, gửi bản ghi đi nhận dạng giọng nói (Whisper) để xem máy nghe ra chữ gì. Bản ghi chỉ nằm trong bộ
 * nhớ, không lưu; muốn dùng bản ghi làm phát âm của từ thì dùng "Ghi âm" ở thẻ Phát âm.
 */
export function SpeakPractice({ text, sentence, ipa }: { text: string; sentence?: string; ipa?: string }) {
  const { accent } = useSettings()
  const aiOn = useAiOn()
  const [mode, setMode] = useState<'word' | 'sentence'>('word')
  const target = mode === 'sentence' && sentence ? sentence : text
  const [recording, setRecording] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const score = useAiRun<{ target: string; result: PronounceResult }>()
  const tip = useAiRun<string>()
  const { phase, error, elapsed, start, stop } = useRecorder(MAX_SECONDS, (blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    blobRef.current = blob
    setRecording(urlRef.current)
    score.reset()
    tip.reset()
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

  const playMine = () => (recording ? playAudio(recording, `mine:${target}`) : Promise.resolve(false))

  function switchMode(next: 'word' | 'sentence') {
    if (next === mode) return
    setMode(next)
    setRecording(null)
    blobRef.current = null
    score.reset()
    tip.reset()
  }

  async function check() {
    const blob = blobRef.current
    if (!blob || score.busy) return
    setDecodeError(null)
    let audio: PreparedAudio
    try {
      audio = await prepareSpeech(blob)
    } catch {
      setDecodeError('Không đọc được bản ghi này. Ghi lại rồi thử nhé.')
      return
    }
    const goal = target
    // Gần như im lặng: báo luôn, không gửi đi (máy hay "nghe" ra chữ từ khoảng lặng).
    await score.run(async () => ({ target: goal, result: audio.peak < SILENCE_PEAK ? { verdict: 'empty', heard: '' } : judgePronunciation(goal, (await transcribe(audio.base64)).text) }))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {sentence && (
        <div className="flex gap-2">
          <Chip active={mode === 'word'} onClick={() => switchMode('word')}>
            Đọc từ
          </Chip>
          <Chip active={mode === 'sentence'} onClick={() => switchMode('sentence')}>
            Đọc câu ví dụ
          </Chip>
        </div>
      )}
      <p className="text-center text-sm leading-relaxed text-muted">
        Nghe mẫu, rồi bấm micro và đọc to <b className="text-text">{target}</b>. Nghe lại xen kẽ với mẫu để tự so
        {aiOn ? ', hoặc bấm “Chấm phát âm” để xem máy nghe ra chữ gì' : ''}. Bản ghi không được lưu{aiOn ? '; chỉ gửi tới Cloudflare khi bạn bấm chấm' : ''}.
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
        <Button icon={Volume2} className="h-11 text-sm" disabled={phase !== 'idle' || busy} onClick={() => void run(() => speak(target, { accent }))}>
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
              await speak(target, { accent })
              await new Promise((r) => setTimeout(r, 350))
              await playMine()
            })
          }
        >
          Nghe mẫu rồi nghe bạn
        </Button>
        {aiOn && (
          <Button icon={AudioLines} className="col-span-2 h-11 text-sm" disabled={!recording || phase !== 'idle' || busy || score.busy} onClick={() => void check()}>
            {score.busy ? 'Máy đang nghe…' : 'Chấm phát âm'}
          </Button>
        )}
      </div>
      {decodeError && <p className="text-center text-[0.8125rem] leading-snug text-danger">{decodeError}</p>}
      <AiErrorText message={score.error} />
      {score.result && score.result.target === target && (
        <ScoreCard
          target={target}
          result={score.result.result}
          tip={tip}
          onTip={() => void tip.run(async () => (await pronounceTip(target, score.result!.result.heard, mode === 'word' ? ipa : undefined)).data)}
        />
      )}
    </div>
  )
}

const VERDICT = {
  match: { icon: Check, tone: 'text-accent', title: 'Máy nghe đúng!' },
  close: { icon: TriangleAlert, tone: 'text-warning', title: 'Gần đúng' },
  miss: { icon: CircleX, tone: 'text-danger', title: 'Máy nghe thành chữ khác' },
  empty: { icon: Mic, tone: 'text-muted', title: 'Không nghe thấy tiếng nói' },
} as const

/** Chữ của câu cần đọc, giữ nguyên dấu câu khi được (mỗi chữ gốc ứng với đúng một chữ đem so). */
function displayWords(target: string, words: { text: string; ok: boolean }[]): { text: string; ok: boolean }[] {
  const orig = target.trim().split(/\s+/)
  return orig.length === words.length && orig.every((w) => speechTokens(w).length === 1) ? orig.map((text, i) => ({ text, ok: words[i].ok })) : words
}

function ScoreCard({ target, result, tip, onTip }: { target: string; result: PronounceResult; tip: { busy: boolean; result: string | null; error: string | null }; onTip: () => void }) {
  const v = VERDICT[result.verdict]
  const Icon = v.icon
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed">
      <p className={`flex items-center gap-1.5 font-semibold ${v.tone}`}>
        <Icon aria-hidden className="h-4 w-4" /> {v.title}
      </p>
      {result.verdict === 'empty' ? (
        <p className="text-muted">Nói to, rõ và gần micro hơn rồi ghi lại.</p>
      ) : (
        <>
          {result.words && (
            <p className="text-[0.9375rem]">
              {displayWords(target, result.words).map((w, i) => (
                <span key={i}>
                  {i > 0 && ' '}
                  <span className={w.ok ? '' : 'text-danger underline decoration-wavy underline-offset-4'}>{w.text}</span>
                </span>
              ))}
            </p>
          )}
          <p>
            <span className="text-muted">Máy nghe được:</span> “{result.heard}”
          </p>
          {result.homophone && <p className="text-muted">Máy viết là “{result.homophone}”, đọc giống hệt “{target}”, nên vẫn tính là đúng.</p>}
          {result.words && result.words.some((w) => !w.ok) && <p className="text-muted">Chữ gạch sóng là chữ máy chưa nghe ra.</p>}
          {(result.verdict === 'close' || result.verdict === 'miss') && (
            <div className="flex flex-col gap-1">
              {tip.result ? <p>{tip.result}</p> : (
                <div>
                  <AiLink busy={tip.busy} onClick={onTip}>
                    Gợi ý cách đọc
                  </AiLink>
                </div>
              )}
              <AiErrorText message={tip.error} />
            </div>
          )}
        </>
      )}
      <AiNote>Máy nhận dạng giọng nói chỉ cho biết nghe ra chữ gì, không chấm từng âm; người bản xứ đôi khi cũng bị nghe nhầm.</AiNote>
    </div>
  )
}
