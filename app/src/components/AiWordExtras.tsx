import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cefrOf, defaultTopic, EXAMPLE_TOPICS, MNEMONIC_KIND_LABEL, type ExampleTopic, type Mnemonic } from '../core/ai'
import { SELF_LEVELS } from '../core/profile'
import { levelOrder } from '../core/reference'
import { MAX_EXAMPLES, repo } from '../db/repo'
import type { VocabItem } from '../db/types'
import { showToast } from '../lib/toast'
import { useAiOn, useAiRun } from '../lib/useAi'
import { useLevelExamples } from '../lib/useReference'
import { suggestExamples, suggestMnemonics, wordRefOf } from '../services/aiTasks'
import { useProfile } from '../services/profile'
import { AiErrorText, AiLink, AiNote } from './AiAssist'
import { UseButton } from './AiWordSuggest'
import { Chip, Sheet } from './kit'

/** Mẹo nhớ do AI gợi ý (R8.4): ba kiểu để chọn, "Dùng mẹo này" thì lưu vào mẹo nhớ của từ (thay mẹo cũ nếu có). */
export function AiMnemonicSheet({ item, open, onClose }: { item: VocabItem; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Mẹo nhớ cho “${item.term}”`}>
      {open && <MnemonicBody item={item} onDone={onClose} />}
    </Sheet>
  )
}

function MnemonicBody({ item, onDone }: { item: VocabItem; onDone: () => void }) {
  const ai = useAiRun<Mnemonic[]>()
  const [attempt, setAttempt] = useState(1)
  const ask = (n: number) => {
    setAttempt(n)
    void ai.run(async () => (await suggestMnemonics(wordRefOf(item), n)).data)
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted">
        AI đưa ra ba kiểu mẹo: theo âm đọc, bằng hình ảnh, và tách từ thành phần quen thuộc. Mẹo AI có lúc gượng, hãy chọn mẹo bạn thấy dễ nhớ, sau đó có thể sửa ở trang sửa từ.
      </p>
      {!ai.result && (
        <div>
          <AiLink busy={ai.busy} onClick={() => ask(1)}>
            Gợi ý mẹo nhớ
          </AiLink>
        </div>
      )}
      <AiErrorText message={ai.error} />
      {ai.result?.map((m, i) => (
        <div key={i} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="text-xs font-semibold text-accent">{MNEMONIC_KIND_LABEL[m.kind]}</span> {m.text}
          </p>
          <UseButton
            label="Dùng mẹo này"
            onClick={async () => {
              await repo.setMnemonic(item.id, m.text)
              showToast('Đã lưu mẹo nhớ')
              onDone()
            }}
          />
        </div>
      ))}
      {ai.result && (
        <div className="flex flex-col gap-1">
          <AiNote>Mẹo nhớ do AI gợi ý, có thể chưa chuẩn: chọn mẹo hợp với bạn.</AiNote>
          <div>
            <AiLink busy={ai.busy} onClick={() => ask(attempt + 1)}>
              Gợi ý mẹo khác
            </AiLink>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Thêm câu ví dụ (R8.3): câu soạn sẵn theo ba trình độ cho từ trong bộ 1.000 từ (`ready`), và câu AI soạn theo
 * trình độ, mục đích học trong hồ sơ và chủ đề bạn chọn (nếu bật trợ lý). "Thêm" để đưa câu vào câu ví dụ của từ
 * (tối đa 5 câu).
 */
export function ExamplesSheet({ item, open, onClose, ready }: { item: VocabItem; open: boolean; onClose: () => void; ready: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Câu ví dụ cho “${item.term}”`}>
      {open && <ExamplesBody item={item} ready={ready} />}
    </Sheet>
  )
}

function ExampleRow({ item, example, level, added, onAdded }: { item: VocabItem; example: { en: string; vi: string }; level?: string; added: boolean; onAdded: () => void }) {
  const isAdded = added || item.examples.some((x) => x.en.trim().toLowerCase() === example.en.trim().toLowerCase())
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <p>
          {level && <span className="mr-1.5 text-xs font-semibold text-accent">{level}</span>}
          {example.en}
        </p>
        <p className="text-muted italic">{example.vi}</p>
      </div>
      <UseButton
        label={isAdded ? 'Đã thêm' : 'Thêm'}
        disabled={isAdded || item.examples.length >= MAX_EXAMPLES}
        onClick={async () => {
          if ((await repo.addExamples(item.id, [example])) > 0) {
            onAdded()
            showToast('Đã thêm câu ví dụ')
          }
        }}
      />
    </div>
  )
}

function ExamplesBody({ item, ready }: { item: VocabItem; ready: boolean }) {
  const profile = useProfile()
  const aiOn = useAiOn()
  const [topic, setTopic] = useState<ExampleTopic>(() => defaultTopic(profile?.learningPurpose))
  const [attempt, setAttempt] = useState(1)
  const [added, setAdded] = useState<string[]>([])
  const ai = useAiRun<{ en: string; vi: string }[]>()
  const levels = useLevelExamples(item.term, ready)
  const cefr = cefrOf(profile?.selfLevel)
  const levelLabel = SELF_LEVELS.find((l) => l.value === profile?.selfLevel)?.label
  const full = item.examples.length >= MAX_EXAMPLES
  const ask = (n: number, t = topic) => {
    setAttempt(n)
    void ai.run(async () => (await suggestExamples(wordRefOf(item), { level: cefr, topic: t, purpose: profile?.learningPurpose, attempt: n })).data)
  }
  const order = levelOrder(cefr)
  const sorted = levels ? [...levels].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level)) : []
  const row = (e: { en: string; vi: string }, level?: string) => <ExampleRow key={e.en} item={item} example={e} level={level} added={added.includes(e.en)} onAdded={() => setAdded((a) => [...a, e.en])} />

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted">
        Trình độ: <b className="text-text">{cefr}</b>
        {levelLabel ? ` (${levelLabel})` : ' (chưa chọn trình độ, dùng mức trung cấp)'}. Đổi trình độ ở Cá nhân, chạm vào tên của bạn.
      </p>
      {full && <AiNote>Từ này đã đủ {MAX_EXAMPLES} câu ví dụ. Xóa bớt ở trang sửa từ nếu muốn thêm câu mới.</AiNote>}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Câu soạn sẵn</p>
          {sorted.map((e) => row(e, e.level))}
        </div>
      )}
      {aiOn && (
        <div className="flex flex-col gap-3">
          {ready && <p className="-mb-1 text-sm font-medium">Soạn bằng AI</p>}
          <div>
            <p className="mb-2 text-sm text-muted">Chủ đề</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_TOPICS.map((t) => (
                <Chip
                  key={t}
                  active={topic === t}
                  onClick={() => {
                    setTopic(t)
                    if (ai.result) ask(1, t)
                  }}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          {!ai.result && (
            <div>
              <AiLink busy={ai.busy} onClick={() => ask(1)}>
                Soạn 3 câu ví dụ
              </AiLink>
            </div>
          )}
          <AiErrorText message={ai.error} />
          {ai.result?.map((e) => row(e))}
          {ai.result && (
            <div className="flex flex-col gap-1">
              <AiNote />
              <div>
                <AiLink busy={ai.busy} onClick={() => ask(attempt + 1)}>
                  <span className="inline-flex items-center gap-1">
                    Soạn câu khác <RefreshCw aria-hidden className="h-3.5 w-3.5" />
                  </span>
                </AiLink>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
