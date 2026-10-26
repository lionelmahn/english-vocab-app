import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { cefrOf, defaultTopic, EXAMPLE_TOPICS, MNEMONIC_KIND_LABEL, type ExampleTopic, type Mnemonic } from '../core/ai'
import { SELF_LEVELS } from '../core/profile'
import { MAX_EXAMPLES, repo } from '../db/repo'
import type { VocabItem } from '../db/types'
import { showToast } from '../lib/toast'
import { useAiRun } from '../lib/useAi'
import { suggestExamples, suggestMnemonics, type WordRef } from '../services/aiTasks'
import { useProfile } from '../services/profile'
import { AiErrorText, AiLink, AiNote } from './AiAssist'
import { UseButton } from './AiWordSuggest'
import { Chip, Sheet } from './kit'

const refOf = (item: VocabItem): WordRef => ({ term: item.term, partOfSpeech: item.partOfSpeech, meaningVi: item.meaningVi, meaningEn: item.meaningEn, ipa: item.ipaUs ?? item.ipaUk })

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
    void ai.run(async () => (await suggestMnemonics(refOf(item), n)).data)
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
 * Câu ví dụ do AI soạn (R8.3) theo trình độ, mục đích học trong hồ sơ và chủ đề bạn chọn. "Thêm" để đưa câu vào
 * câu ví dụ của từ (tối đa 5 câu).
 */
export function AiExamplesSheet({ item, open, onClose }: { item: VocabItem; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={`Câu ví dụ cho “${item.term}”`}>
      {open && <ExamplesBody item={item} />}
    </Sheet>
  )
}

function ExamplesBody({ item }: { item: VocabItem }) {
  const profile = useProfile()
  const [topic, setTopic] = useState<ExampleTopic>(() => defaultTopic(profile?.learningPurpose))
  const [attempt, setAttempt] = useState(1)
  const [added, setAdded] = useState<string[]>([])
  const ai = useAiRun<{ en: string; vi: string }[]>()
  const cefr = cefrOf(profile?.selfLevel)
  const levelLabel = SELF_LEVELS.find((l) => l.value === profile?.selfLevel)?.label
  const full = item.examples.length >= MAX_EXAMPLES
  const ask = (n: number, t = topic) => {
    setAttempt(n)
    void ai.run(async () => (await suggestExamples(refOf(item), { level: cefr, topic: t, purpose: profile?.learningPurpose, attempt: n })).data)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-muted">
        Trình độ: <b className="text-text">{cefr}</b>
        {levelLabel ? ` (${levelLabel})` : ' (chưa chọn trình độ, dùng mức trung cấp)'}. Đổi trình độ ở Cá nhân, chạm vào tên của bạn.
      </p>
      <div>
        <p className="mb-2 text-sm font-medium">Chủ đề</p>
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
      {ai.result?.map((e) => {
        const isAdded = added.includes(e.en) || item.examples.some((x) => x.en.trim().toLowerCase() === e.en.toLowerCase())
        return (
          <div key={e.en} className="flex items-start gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p>{e.en}</p>
              <p className="text-muted italic">{e.vi}</p>
            </div>
            <UseButton
              label={isAdded ? 'Đã thêm' : 'Thêm'}
              disabled={isAdded || full}
              onClick={async () => {
                if ((await repo.addExamples(item.id, [e])) > 0) {
                  setAdded((a) => [...a, e.en])
                  showToast('Đã thêm câu ví dụ')
                }
              }}
            />
          </div>
        )
      })}
      {ai.result && (
        <div className="flex flex-col gap-1">
          {full && <AiNote>Từ này đã đủ {MAX_EXAMPLES} câu ví dụ. Xóa bớt ở trang sửa từ nếu muốn thêm câu mới.</AiNote>}
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
  )
}
