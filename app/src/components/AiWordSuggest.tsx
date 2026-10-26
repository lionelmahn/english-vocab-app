import type { WordInfo, WordSense } from '../core/ai'
import { POS_LABEL } from '../core/pos'
import { suggestWordInfo } from '../services/aiTasks'
import { useAiRun } from '../lib/useAi'
import { AiErrorText, AiLink, AiNote } from './AiAssist'

/**
 * Gợi ý thông tin từ bằng AI trong form thêm/sửa từ (R8.1): nghĩa tiếng Việt, loại từ, câu ví dụ và mẹo nhớ.
 * Không tự điền gì: người học chạm "Dùng" ở nghĩa muốn học.
 */
export function AiWordSuggest({ term, onUseSense, onUseMnemonic }: { term: string; onUseSense: (s: WordSense) => void; onUseMnemonic: (text: string) => void }) {
  const { busy, result, error, run } = useAiRun<WordInfo>()
  const q = term.trim()

  return (
    <div className="-mt-1 flex flex-col gap-2">
      <div>
        <AiLink busy={busy} disabled={!q} onClick={() => void run(async () => (await suggestWordInfo(q)).data)}>
          Gợi ý nghĩa và ví dụ bằng AI
        </AiLink>
      </div>
      <AiErrorText message={error} />
      {result && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          <p className="text-xs text-muted">AI gợi ý cho “{result.term}”. Chạm “Dùng” để điền loại từ, nghĩa và câu ví dụ vào form.</p>
          {result.senses.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1 text-sm leading-snug">
                <p>
                  <span className="text-xs font-semibold text-muted">{POS_LABEL[s.pos]}</span> <b>{s.meaningVi}</b>
                </p>
                {s.exampleEn && <p className="mt-1">{s.exampleEn}</p>}
                {s.exampleVi && <p className="text-muted italic">{s.exampleVi}</p>}
              </div>
              <UseButton onClick={() => onUseSense(s)} />
            </div>
          ))}
          {result.mnemonicVi && (
            <div className="flex items-start gap-3 rounded-xl bg-surface px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <span className="text-xs font-semibold text-muted">Mẹo nhớ</span> {result.mnemonicVi}
              </p>
              <UseButton onClick={() => onUseMnemonic(result.mnemonicVi)} />
            </div>
          )}
          <AiNote />
        </div>
      )}
    </div>
  )
}

export function UseButton({ onClick, label = 'Dùng', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-on-accent disabled:bg-surface-2 disabled:text-subtle">
      {label}
    </button>
  )
}
