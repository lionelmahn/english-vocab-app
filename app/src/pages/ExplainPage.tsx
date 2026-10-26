import { BookmarkPlus, Pencil, Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AiErrorText, AiLink, AiNote } from '../components/AiAssist'
import { BackButton, TextArea } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { MarkedSentence } from '../components/WordReference'
import type { ContextExplanation } from '../core/ai'
import { MAX_PASSAGE, parsePassage, selectionOf, tapToken } from '../core/passage'
import { POS_LABEL } from '../core/pos'
import { markWord } from '../core/reference'
import { termKey } from '../core/vocab'
import { useLibrary } from '../lib/hooks'
import { riseIn } from '../lib/motion'
import { useAiOn, useAiRun } from '../lib/useAi'
import { explainInContext } from '../services/aiTasks'
import type { WordPrefill } from './WordFormPage'

/** Đoạn văn đang đọc, giữ trong phiên để quay lại trang vẫn còn. */
const DRAFT = 'explain-text'
function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT) ?? ''
  } catch {
    return ''
  }
}
function saveDraft(text: string) {
  try {
    sessionStorage.setItem(DRAFT, text)
  } catch {
    // Không lưu được (chế độ riêng tư): bỏ qua.
  }
}

/** Giải thích từ theo ngữ cảnh (R8.2): dán câu hoặc đoạn văn, chạm từ (hoặc cụm) chưa hiểu, AI giải thích đúng nghĩa trong câu đó. */
export function ExplainPage() {
  const aiOn = useAiOn()
  const incoming = (useLocation().state as { text?: string } | null)?.text
  const [text, setText] = useState(() => incoming ?? readDraft())
  const [editing, setEditing] = useState(() => !(incoming ?? readDraft()).trim())
  const [sel, setSel] = useState<{ from: number; to: number } | null>(null)
  const passage = useMemo(() => parsePassage(text), [text])
  const ai = useAiRun<{ key: string; data: ContextExplanation }>()
  const picked = sel ? selectionOf(text, passage, sel.from, sel.to) : null
  const key = picked ? `${picked.sentence}|${picked.selection}` : ''
  const result = ai.result && ai.result.key === key ? ai.result.data : null

  return (
    <Page title="Giải thích từ trong câu" subtitle="Dán câu hoặc đoạn văn tiếng Anh, chạm vào từ chưa hiểu để xem nghĩa đúng trong câu đó" back={<BackButton fallback="/lookup" />}>
      {!aiOn && (
        <Card>
          <p className="text-sm leading-relaxed text-muted">Chức năng này dùng trợ lý AI. Bật ở Cá nhân → Trợ lý AI rồi quay lại.</p>
          <Link to="/me/ai" className="mt-2 inline-block text-sm font-semibold text-accent">
            Mở Trợ lý AI
          </Link>
        </Card>
      )}
      {aiOn && editing && (
        <motion.div variants={riseIn} className="flex flex-col gap-3">
          <TextArea
            label="Câu hoặc đoạn văn tiếng Anh"
            rows={6}
            value={text}
            maxLength={MAX_PASSAGE}
            placeholder="Ví dụ: We need to make up for lost time this week."
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="-mt-1 text-right text-xs text-subtle">
            {text.length}/{MAX_PASSAGE}
          </p>
          <Button
            variant="primary"
            disabled={!passage.tokens.some((t) => t.word)}
            onClick={() => {
              saveDraft(text)
              setSel(null)
              setEditing(false)
            }}
          >
            Chọn từ cần giải thích
          </Button>
        </motion.div>
      )}
      {aiOn && !editing && (
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted">Chạm một từ. Muốn chọn cụm (give up, take care of) thì chạm thêm chữ cuối của cụm.</p>
              <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
                <Pencil aria-hidden className="h-4 w-4" /> Sửa đoạn văn
              </button>
            </div>
            <p className="text-[1.0625rem] leading-loose whitespace-pre-wrap">
              {passage.tokens.map((t, i) => {
                const on = !!sel && i >= sel.from && i <= sel.to
                // Khoảng trắng nằm giữa cụm đã chọn cũng được tô để cụm liền một khối.
                if (!t.word) return <span key={i} className={on ? 'bg-accent-soft' : ''}>{t.text}</span>
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSel((s) => tapToken(passage, s, i))}
                    aria-pressed={on}
                    className={`-mx-0.5 rounded-md px-0.5 transition-colors ${on ? 'bg-accent-soft font-semibold text-accent' : 'active:bg-surface-2'}`}
                  >
                    {t.text}
                  </button>
                )
              })}
            </p>
          </Card>
          {picked && (
            <div className="flex flex-col gap-1 px-1">
              <p className="text-sm">
                Đã chọn: <b className="font-semibold">“{picked.selection}”</b>
              </p>
              {!result && (
                <div>
                  <AiLink busy={ai.busy} onClick={() => void ai.run(async () => ({ key, data: (await explainInContext(text, picked.sentence, picked.selection)).data }))}>
                    Giải thích bằng AI
                  </AiLink>
                </div>
              )}
              <AiErrorText message={ai.error} />
            </div>
          )}
          {result && <ExplanationCard result={result} />}
        </>
      )}
    </Page>
  )
}

function ExplanationCard({ result }: { result: ContextExplanation }) {
  const navigate = useNavigate()
  const lib = useLibrary()
  const existing = lib?.items.find((i) => termKey(i.term) === termKey(result.lemma))
  const prefill: WordPrefill = { term: result.lemma, partOfSpeech: result.pos, meaningVi: result.meaningVi, example: { en: result.sentence, vi: result.sentenceVi } }
  return (
    <Card>
      <SectionTitle className="mb-1">
        {result.expression}
        {result.lemma.toLowerCase() !== result.expression.toLowerCase() && <span className="font-normal text-muted"> (dạng gốc: {result.lemma})</span>}
      </SectionTitle>
      <p className="text-[1.125rem] leading-snug font-semibold">
        <span className="mr-1.5 text-xs font-semibold text-muted">{POS_LABEL[result.pos]}</span>
        {result.meaningVi}
      </p>
      {result.explanationVi && <p className="mt-2 text-sm leading-relaxed">{result.explanationVi}</p>}
      <p className="mt-3 text-[0.9375rem] leading-relaxed">
        <MarkedSentence text={markWord(result.sentence, result.expression) ?? result.sentence} />
      </p>
      {result.sentenceVi && <p className="text-sm text-muted italic">{result.sentenceVi}</p>}
      {result.otherMeaningsVi && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold">Nghĩa khác:</span> {result.otherMeaningsVi}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {existing ? (
          <Button icon={BookmarkPlus} onClick={() => navigate(`/words/${existing.id}`)}>
            Đã có trong sổ tay: mở từ
          </Button>
        ) : (
          <Button variant="primary" icon={BookmarkPlus} onClick={() => navigate('/words/new', { state: { prefill } })}>
            Lưu vào sổ tay
          </Button>
        )}
        <Button icon={Search} onClick={() => navigate(`/lookup?q=${encodeURIComponent(result.lemma)}`)}>
          Tra từ điển
        </Button>
      </div>
      <AiNote>AI có thể sai: lưu vào sổ tay thì xem lại nghĩa trước khi lưu.</AiNote>
    </Card>
  )
}
