import { Check, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { cefrOf, CORRECTION_TYPE_LABEL, usesTerm, wordDiff, type Correction } from '../core/ai'
import { MAX_EXAMPLES, repo } from '../db/repo'
import type { VocabItem } from '../db/types'
import { showToast } from '../lib/toast'
import { useAiOn, useAiRun } from '../lib/useAi'
import { correctSentence, wordRefOf } from '../services/aiTasks'
import { useProfile } from '../services/profile'
import { AiErrorText, AiLink, AiNote } from './AiAssist'
import { UseButton } from './AiWordSuggest'
import { TextArea } from './kit'
import { Card, SectionTitle } from './ui'

const MAX_SENTENCE = 300
/** Có dấu cách trước đoạn này không (dấu câu dính vào chữ trước). */
const gap = (i: number, text: string) => (i > 0 && !/^[^\p{L}\p{N}("“]/u.test(text) ? ' ' : '')
const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase()

/** Luyện viết câu (R8.6): người học viết một câu có từ đang học, AI chấm lỗi, đưa câu sửa và nhận xét cách dùng từ. */
export function WritingCard({ item }: { item: VocabItem }) {
  const aiOn = useAiOn()
  const profile = useProfile()
  const [text, setText] = useState('')
  const ai = useAiRun<{ sentence: string; result: Correction }>()
  if (!aiOn) return null
  const sentence = text.trim()
  const check = () => void ai.run(async () => ({ sentence, result: (await correctSentence(wordRefOf(item), sentence, cefrOf(profile?.selfLevel))).data }))

  return (
    <Card>
      <SectionTitle>Luyện viết câu</SectionTitle>
      <div className="flex flex-col gap-2">
        <TextArea
          label={`Viết một câu có “${item.term}”, AI sẽ sửa ngữ pháp, chính tả và cách dùng từ`}
          value={text}
          maxLength={MAX_SENTENCE}
          autoCapitalize="sentences"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
        {sentence && !usesTerm(sentence, item.term) && <p className="text-xs text-warning">Câu chưa có từ “{item.term}”.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AiLink busy={ai.busy} disabled={!sentence} onClick={check}>
            Nhờ AI sửa câu
          </AiLink>
          <Link to="/chat" state={{ terms: [item.term] }} className="text-sm font-semibold text-accent">
            Luyện trong hội thoại
          </Link>
        </div>
        <AiErrorText message={ai.error} />
        {ai.result && (
          <CorrectionView
            item={item}
            sentence={ai.result.sentence}
            result={ai.result.result}
            onReset={() => {
              setText('')
              ai.reset()
            }}
          />
        )}
      </div>
    </Card>
  )
}

function CorrectionView({ item, sentence, result, onReset }: { item: VocabItem; sentence: string; result: Correction; onReset: () => void }) {
  const [added, setAdded] = useState(false)
  const diff = wordDiff(sentence, result.corrected)
  const mine = diff.filter((d) => d.type !== 'add')
  const fixed = diff.filter((d) => d.type !== 'del')
  // Câu đã sửa dùng đúng từ (kể cả khi câu gốc dùng sai) thì lưu được làm câu ví dụ.
  const canAdd = usesTerm(result.corrected, item.term) && (added || item.examples.length < MAX_EXAMPLES)

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed">
      <p className={`flex items-center gap-1.5 font-semibold ${result.correct ? 'text-accent' : 'text-warning'}`}>
        {result.correct ? <Check aria-hidden className="h-4 w-4" /> : <TriangleAlert aria-hidden className="h-4 w-4" />}
        {result.correct ? 'Câu đúng rồi!' : result.issues.length > 0 ? `Có ${result.issues.length} chỗ cần sửa` : 'Câu cần sửa một chút'}
      </p>
      {result.correct ? (
        <p className="text-[0.9375rem]">{sentence}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs font-semibold text-muted">Câu của bạn</p>
            <p className="text-[0.9375rem]">
              {mine.map((d, i) => (
                <span key={i}>
                  {gap(i, d.text)}
                  <span className={d.type === 'del' ? 'text-danger line-through' : ''}>{d.text}</span>
                </span>
              ))}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">Câu đã sửa</p>
            <p className="text-[0.9375rem]">
              {fixed.map((d, i) => (
                <span key={i}>
                  {gap(i, d.text)}
                  <span className={d.type === 'add' ? 'rounded bg-accent-soft px-0.5 font-semibold text-accent' : ''}>{d.text}</span>
                </span>
              ))}
            </p>
          </div>
        </div>
      )}
      {result.translationVi && <p className="text-muted italic">{result.translationVi}</p>}
      {result.issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {result.issues.map((x, i) => (
            <li key={i} className="rounded-xl bg-surface px-3 py-2">
              <p>
                <span className="text-xs font-semibold text-accent">{CORRECTION_TYPE_LABEL[x.type]}</span>{' '}
                {x.original && <span className="text-danger line-through">{x.original}</span>}
                {x.original && x.fix && ' → '}
                {x.fix && <b className="font-semibold">{x.fix}</b>}
              </p>
              <p className="text-muted">{x.explainVi}</p>
            </li>
          ))}
        </ul>
      )}
      {result.targetNoteVi && <p className={result.targetOk ? '' : 'text-warning'}>{result.targetNoteVi}</p>}
      {result.natural && !same(result.natural, result.corrected) && (
        <p>
          <span className="block text-xs font-semibold text-muted">Cách nói tự nhiên hơn</span>
          {result.natural}
        </p>
      )}
      {result.praiseVi && <p className="text-accent">{result.praiseVi}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {canAdd && (
          <UseButton
            label={added ? 'Đã thêm' : 'Thêm vào câu ví dụ'}
            disabled={added}
            onClick={async () => {
              if ((await repo.addExamples(item.id, [{ en: result.corrected, vi: result.translationVi }])) > 0) {
                setAdded(true)
                showToast('Đã thêm câu ví dụ')
              }
            }}
          />
        )}
        <button type="button" onClick={onReset} className="text-sm font-semibold text-accent">
          Viết câu khác
        </button>
      </div>
      <AiNote>AI chấm có thể sai; hãy xem lời giải thích như gợi ý.</AiNote>
    </div>
  )
}
