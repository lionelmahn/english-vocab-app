import { Check, CircleDashed, Languages, MessagesSquare, Mic, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { AiErrorText, AiNote } from '../components/AiAssist'
import { BackButton, Chip, SpeakButtons } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { cefrOf, CHAT_MAX_TURNS, CHAT_SCENARIOS, CHAT_START, usesTerm, type ChatSummary, type ChatTurnResult } from '../core/ai'
import { studiedItems } from '../db/library'
import { useLibrary, useNow } from '../lib/hooks'
import { useAiOn, useAiRun } from '../lib/useAi'
import { chatTurn, summarizeChat, type ChatTurn } from '../services/aiTasks'
import { useProfile } from '../services/profile'
import { practiceCandidates } from '../study/plans'

const MAX_WORDS = 5

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  vi?: string
  /** Nhận xét cho câu của người học (đến cùng lượt trả lời sau đó). */
  feedbackVi?: string
  corrected?: string
}

interface ChatState {
  words: string[]
  scenario: string
  messages: ChatMessage[]
  usedOk: string[]
  usedWrong: string[]
}

/** Buổi đang dở, giữ trong phiên để rời trang rồi quay lại vẫn còn. */
const KEY = 'chat-session'
function load(): ChatState | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ChatState) : null
  } catch {
    return null
  }
}
function save(state: ChatState | null) {
  try {
    if (state) sessionStorage.setItem(KEY, JSON.stringify(state))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Không lưu được (chế độ riêng tư): buổi vẫn chạy, chỉ không giữ khi rời trang.
  }
}

const turnsOf = (messages: readonly ChatMessage[]): ChatTurn[] => messages.map((m) => ({ role: m.role, content: m.text }))

/** Hội thoại luyện từ (R8.7): đóng vai một tình huống với AI, được nhắc dùng các từ đã chọn, cuối buổi có nhận xét. */
export function ChatPage() {
  const aiOn = useAiOn()
  const [state, setState] = useState<ChatState | null>(load)
  useEffect(() => {
    save(state)
  }, [state])
  return (
    <Page title="Hội thoại luyện từ" subtitle="Đóng vai một tình huống với AI và tập dùng các từ bạn chọn" back={<BackButton fallback="/practice" />}>
      {!aiOn ? (
        <Card>
          <p className="text-sm leading-relaxed text-muted">Chức năng này dùng trợ lý AI. Bật ở Cá nhân → Trợ lý AI rồi quay lại.</p>
          <Link to="/me/ai" className="mt-2 inline-block text-sm font-semibold text-accent">
            Mở Trợ lý AI
          </Link>
        </Card>
      ) : state ? (
        <ChatRoom state={state} setState={setState} />
      ) : (
        <ChatSetup onStart={(words, scenario) => setState({ words, scenario, messages: [{ role: 'user', text: CHAT_START }], usedOk: [], usedWrong: [] })} />
      )}
    </Page>
  )
}

function ChatSetup({ onStart }: { onStart: (words: string[], scenario: string) => void }) {
  const lib = useLibrary()
  const now = useNow()
  const preset = (useLocation().state as { terms?: string[] } | null)?.terms
  // Gợi ý: từ hay quên trước, rồi từ học gần đây; chưa học từ nào thì lấy từ mới thêm vào sổ tay.
  const candidates = useMemo(() => {
    if (!lib) return []
    const hard = practiceCandidates(lib, { kind: 'hard' }, now).slice(0, 6)
    const recent = [...studiedItems(lib)].sort((a, b) => b.createdAt - a.createdAt)
    const fallback = [...lib.items].filter((i) => !i.archived).sort((a, b) => b.createdAt - a.createdAt)
    const terms = [...(preset ?? []), ...[...hard, ...recent, ...fallback].map((i) => i.term)]
    return [...new Set(terms)].slice(0, 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib])
  const [picked, setPicked] = useState<string[] | null>(null)
  const words = picked ?? candidates.slice(0, 3)
  const [scenarioId, setScenarioId] = useState<string>(CHAT_SCENARIOS[0].id)
  const [custom, setCustom] = useState('')
  const scenario = scenarioId === 'custom' ? custom.trim() : (CHAT_SCENARIOS.find((s) => s.id === scenarioId)?.en ?? '')

  return (
    <>
      <Card>
        <SectionTitle>Từ muốn luyện (tối đa {MAX_WORDS})</SectionTitle>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">Sổ tay chưa có từ nào. Thêm vài từ rồi quay lại nhé.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {candidates.map((t) => (
              <Chip
                key={t}
                active={words.includes(t)}
                onClick={() => setPicked(words.includes(t) ? words.filter((w) => w !== t) : words.length < MAX_WORDS ? [...words, t] : words)}
              >
                {t}
              </Chip>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">Gợi ý từ hay quên và từ học gần đây. AI sẽ đặt câu hỏi để bạn có dịp dùng các từ này.</p>
      </Card>
      <Card>
        <SectionTitle>Tình huống</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {CHAT_SCENARIOS.map((s) => (
            <Chip key={s.id} active={scenarioId === s.id} onClick={() => setScenarioId(s.id)}>
              {s.label}
            </Chip>
          ))}
          <Chip active={scenarioId === 'custom'} onClick={() => setScenarioId('custom')}>
            Tự đặt tình huống
          </Chip>
        </div>
        {scenarioId === 'custom' && (
          <input
            value={custom}
            maxLength={160}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Ví dụ: Gọi điện đặt phòng khách sạn ở Đà Nẵng"
            aria-label="Tình huống tự đặt"
            className="mt-3 h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[0.9375rem] outline-none placeholder:text-subtle focus:border-accent"
          />
        )}
      </Card>
      <Button variant="primary" icon={MessagesSquare} className="w-full" disabled={words.length === 0 || !scenario} onClick={() => onStart(words, scenario)}>
        Bắt đầu hội thoại
      </Button>
      <p className="px-1 text-xs leading-relaxed text-subtle">
        Mỗi buổi tối đa {CHAT_MAX_TURNS} lượt nói của bạn. Muốn nói thay vì gõ, chạm nút micro trên bàn phím điện thoại. Câu bạn viết được gửi tới Cloudflare để AI trả lời.
      </p>
    </>
  )
}

function ChatRoom({ state, setState }: { state: ChatState; setState: (s: ChatState | null) => void }) {
  const profile = useProfile()
  const level = cefrOf(profile?.selfLevel)
  const [text, setText] = useState('')
  const [showVi, setShowVi] = useState<number[]>([])
  const reply = useAiRun<ChatTurnResult>()
  const summary = useAiRun<ChatSummary>()
  const [ended, setEnded] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const learnerTurns = state.messages.filter((m) => m.role === 'user' && m.text !== CHAT_START).length
  const waiting = state.messages.at(-1)?.role === 'user'

  // Gửi lượt của người học (hoặc lời mở đầu ẩn) và nhận lượt trả lời; nhận xét gắn vào câu vừa nói.
  async function ask(messages: ChatMessage[]) {
    const r = await reply.run(async () => (await chatTurn({ scenario: state.scenario, words: state.words, level }, turnsOf(messages))).data)
    if (!r) return
    const next = messages.map((m, i) => (i === messages.length - 1 && m.role === 'user' && m.text !== CHAT_START ? { ...m, feedbackVi: r.feedbackVi, corrected: r.corrected } : m))
    setState({
      ...state,
      messages: [...next, { role: 'assistant', text: r.reply, vi: r.replyVi }],
      usedOk: [...new Set([...state.usedOk, ...r.usedOk])],
      usedWrong: [...new Set([...state.usedWrong, ...r.usedWrong])],
    })
  }

  // Lượt mở đầu khi mới vào buổi (hoặc lượt trả lời bị lỗi mạng lúc trước); chỉ gửi một lần.
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (waiting) void ask(state.messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trình duyệt mới trả về Promise từ scrollIntoView: bọc trong khối để hiệu ứng không trả về gì.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [state.messages.length, reply.busy])

  function send() {
    const t = text.trim()
    if (!t || waiting || reply.busy || learnerTurns >= CHAT_MAX_TURNS) return
    const messages: ChatMessage[] = [...state.messages, { role: 'user', text: t }]
    setText('')
    setState({ ...state, messages })
    void ask(messages)
  }

  const status = (w: string) => {
    if (state.usedOk.includes(w)) return 'ok'
    if (state.usedWrong.includes(w)) return 'wrong'
    return state.messages.some((m) => m.role === 'user' && m.text !== CHAT_START && usesTerm(m.text, w)) ? 'said' : 'unused'
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {state.words.map((w) => {
          const s = status(w)
          return (
            <span
              key={w}
              className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[0.8125rem] font-semibold ${
                s === 'ok' ? 'border-accent bg-accent-soft text-accent' : s === 'wrong' ? 'border-warning bg-warning-soft text-warning' : 'border-line bg-surface text-muted'
              }`}
            >
              {s === 'ok' ? <Check aria-hidden className="h-3.5 w-3.5" /> : s === 'wrong' ? <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> : <CircleDashed aria-hidden className="h-3.5 w-3.5" />}
              {w}
            </span>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        {state.messages.map((m, i) => {
          if (m.text === CHAT_START) return null
          if (m.role === 'assistant') {
            const vi = showVi.includes(i)
            return (
              <div key={i} className="max-w-[88%] self-start rounded-3xl rounded-tl-md bg-surface px-4 py-3 shadow-sm">
                <p className="text-[0.9375rem] leading-relaxed">{m.text}</p>
                {vi && m.vi && <p className="mt-1 text-sm text-muted italic">{m.vi}</p>}
                <div className="mt-1 flex items-center gap-3">
                  <SpeakButtons text={m.text} size="sm" slow={false} />
                  {m.vi && (
                    <button type="button" onClick={() => setShowVi((v) => (vi ? v.filter((x) => x !== i) : [...v, i]))} className="inline-flex items-center gap-1 text-xs font-semibold text-accent" aria-pressed={vi}>
                      <Languages aria-hidden className="h-3.5 w-3.5" /> {vi ? 'Ẩn bản dịch' : 'Dịch'}
                    </button>
                  )}
                </div>
              </div>
            )
          }
          return (
            <div key={i} className="flex max-w-[88%] flex-col items-end gap-1 self-end">
              <p className="rounded-3xl rounded-tr-md bg-accent px-4 py-3 text-[0.9375rem] leading-relaxed text-on-accent">{m.text}</p>
              {(m.feedbackVi || m.corrected) && (
                <div className="rounded-2xl bg-warning-soft px-3 py-2 text-sm leading-snug">
                  {m.corrected && (
                    <p>
                      <span className="font-semibold">Nên nói:</span> {m.corrected}
                    </p>
                  )}
                  {m.feedbackVi && <p className="text-muted">{m.feedbackVi}</p>}
                </div>
              )}
            </div>
          )
        })}
        {reply.busy && <p className="self-start px-2 text-sm text-muted">AI đang trả lời…</p>}
        <div ref={endRef} />
      </div>

      {reply.error && (
        <div className="flex flex-col items-start gap-1">
          <AiErrorText message={reply.error} />
          {waiting && (
            <button type="button" onClick={() => void ask(state.messages)} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
              <RotateCcw aria-hidden className="h-4 w-4" /> Thử lại
            </button>
          )}
        </div>
      )}

      {!ended && (
        <Card>
          {learnerTurns < CHAT_MAX_TURNS ? (
            <>
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  rows={2}
                  maxLength={400}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Viết câu trả lời bằng tiếng Anh…"
                  aria-label="Câu trả lời của bạn"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  className="min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[0.9375rem] leading-relaxed outline-none placeholder:text-subtle focus:border-accent"
                />
                <Button variant="primary" icon={Send} className="h-12 shrink-0 px-4!" disabled={!text.trim() || waiting || reply.busy} onClick={send}>
                  Gửi
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-xs text-subtle">
                  <Mic aria-hidden className="h-3.5 w-3.5" /> Lượt {learnerTurns}/{CHAT_MAX_TURNS}. Có thể nói bằng nút micro trên bàn phím.
                </p>
                <button type="button" onClick={() => setState(null)} className="shrink-0 text-xs font-semibold text-muted">
                  Bỏ buổi này
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Đã đủ {CHAT_MAX_TURNS} lượt. Xem nhận xét để biết bạn dùng các từ thế nào.</p>
          )}
          {learnerTurns > 0 && (
            <Button
              className="mt-3 w-full"
              disabled={reply.busy}
              onClick={() => {
                setEnded(true)
                void summary.run(async () => (await summarizeChat(state.words, turnsOf(state.messages))).data)
              }}
            >
              Kết thúc và xem nhận xét
            </Button>
          )}
        </Card>
      )}

      {ended && (
        <Card>
          <SectionTitle>Nhận xét buổi luyện</SectionTitle>
          {summary.busy && <p className="text-sm text-muted">AI đang nhận xét…</p>}
          <AiErrorText message={summary.error} />
          {summary.result && <p className="text-sm leading-relaxed">{summary.result.summaryVi}</p>}
          <ul className="mt-3 flex flex-col gap-2">
            {state.words.map((w) => {
              const ai = summary.result?.words.find((x) => x.word === w)
              const s = ai?.status ?? (status(w) === 'ok' ? 'ok' : status(w) === 'wrong' ? 'wrong' : 'unused')
              return (
                <li key={w} className="rounded-2xl bg-surface-2 px-3 py-2 text-sm leading-snug">
                  <p className="font-semibold">
                    {w}{' '}
                    <span className={s === 'ok' ? 'text-accent' : s === 'wrong' ? 'text-warning' : 'text-muted'}>
                      · {s === 'ok' ? 'đã dùng đúng' : s === 'wrong' ? 'dùng chưa đúng' : 'chưa dùng'}
                    </span>
                  </p>
                  {ai?.noteVi && <p className="text-muted">{ai.noteVi}</p>}
                </li>
              )
            })}
          </ul>
          {summary.result && summary.result.tipsVi.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm leading-relaxed">
              {summary.result.tipsVi.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          <AiNote>Nhận xét do AI soạn, có thể chưa chuẩn.</AiNote>
          <Button variant="primary" icon={RotateCcw} className="mt-3 w-full" onClick={() => setState(null)}>
            Luyện buổi mới
          </Button>
        </Card>
      )}
    </>
  )
}
