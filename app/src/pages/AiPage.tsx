import { Bot, LoaderCircle, Search, Sparkles, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { HelpButton } from '../components/Guide'
import { BackButton, Chip } from '../components/kit'
import { Button, Card, Page, SectionTitle, Switch } from '../components/ui'
import { AI_MODELS, DAILY_LIMITS, FREE_NEURONS_PER_DAY, type WordInfo } from '../core/ai'
import { POS_LABEL } from '../core/pos'
import { showToast } from '../lib/toast'
import { AI_ERROR_TEXT, AiError, clearAiCache, setAiSettings, useAiCacheCount, useAiUsage } from '../services/ai'
import { suggestWordInfo } from '../services/aiTasks'
import { useAuth } from '../services/auth'
import { useProfile } from '../services/profile'

const num = new Intl.NumberFormat('vi-VN')

/** Trợ lý AI (R8.8): bật/tắt, chọn model, giới hạn lượt mỗi ngày, xem lượt đã dùng, thử hỏi một từ. */
export function AiPage() {
  const profile = useProfile()
  const usage = useAiUsage()
  const cached = useAiCacheCount()
  const auth = useAuth()
  if (!profile || !usage) return null
  const ai = profile.ai
  const set = (patch: Partial<typeof ai>) => void setAiSettings(patch)
  const share = Math.min(1, usage.todayNeurons / FREE_NEURONS_PER_DAY)

  return (
    <Page title="Trợ lý AI" subtitle="Miễn phí qua Cloudflare Workers AI" back={<BackButton fallback="/me" />} action={<HelpButton topic="ai" />}>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.9375rem] font-semibold">Bật trợ lý AI</p>
            <p className="text-[0.8125rem] leading-snug text-muted">Gợi ý nghĩa, câu ví dụ, mẹo nhớ, kết hợp từ, giải thích từ trong câu và sửa câu bạn viết.</p>
          </div>
          <Switch label="Bật trợ lý AI" checked={ai.enabled} onChange={(v) => set({ enabled: v })} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-subtle">
          Dùng gói miễn phí của Cloudflare Workers AI nên không tốn tiền: hết hạn mức trong ngày thì AI tạm ngừng tới 7:00 sáng hôm sau, không bị tính phí. Cần đăng nhập và có mạng. Từ hoặc câu bạn hỏi được gửi tới Cloudflare để xử lý.
        </p>
        {auth.status !== 'signed_in' && <p className="mt-2 text-xs text-warning">Bạn chưa đăng nhập: cần đăng nhập để dùng trợ lý AI.</p>}
      </Card>

      <Card>
        <SectionTitle className="mb-1">Model</SectionTitle>
        <p className="mb-3 text-xs text-subtle">Đổi model thì các câu hỏi cũ sẽ được hỏi lại bằng model mới.</p>
        <div className="flex flex-col gap-2">
          {AI_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={ai.model === m.id}
              onClick={() => set({ model: m.id })}
              className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${ai.model === m.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
            >
              <span className="block text-[0.9375rem] font-semibold">
                {m.label}
                {m.id === AI_MODELS[0].id && <span className="ml-2 text-xs font-semibold text-accent">Đề xuất</span>}
              </span>
              <span className="block text-[0.8125rem] leading-snug text-muted">{m.note}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-3">Giới hạn và lượt đã dùng</SectionTitle>
        <p className="mb-2 text-sm font-medium">Tối đa mỗi ngày trên máy này</p>
        <div className="flex flex-wrap gap-2">
          {DAILY_LIMITS.map((n) => (
            <Chip key={n} active={ai.dailyLimit === n} onClick={() => set({ dailyLimit: n })}>
              {n} lượt
            </Chip>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Hôm nay</dt>
          <dd className="text-right font-medium tabular-nums">
            {usage.todayRequests}/{ai.dailyLimit} lượt
          </dd>
          <dt className="text-muted">Hạn mức miễn phí hôm nay</dt>
          <dd className="text-right font-medium tabular-nums">
            {num.format(usage.todayNeurons)}/{num.format(FREE_NEURONS_PER_DAY)} neuron
          </dd>
          <dt className="text-muted">30 ngày qua</dt>
          <dd className="text-right font-medium tabular-nums">
            {usage.monthRequests} lượt · {num.format(usage.monthNeurons)} neuron
          </dd>
          <dt className="text-muted">Lấy lại kết quả đã lưu</dt>
          <dd className="text-right font-medium tabular-nums">{usage.monthCached} lượt</dd>
        </dl>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className={`h-full rounded-full ${share > 0.8 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${share * 100}%` }} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          Số neuron chỉ đếm lượt hỏi từ máy này; hạn mức 10.000 neuron/ngày là chung cho cả tài khoản Cloudflare, đặt lại lúc 7:00 sáng. Mỗi lượt gợi ý một từ tốn khoảng 20–60 neuron.
        </p>
        <Button
          icon={Trash2}
          className="mt-3 h-11 w-full px-2! text-sm disabled:opacity-60"
          disabled={!cached}
          onClick={async () => {
            await clearAiCache()
            showToast('Đã xóa kết quả AI đã lưu')
          }}
        >
          Xóa kết quả đã lưu{cached ? ` (${cached})` : ''}
        </Button>
      </Card>

      <TryCard />
    </Page>
  )
}

/** Thử hỏi một từ (bản xem trước của tính năng gợi ý thông tin từ, R8.1); kết quả không lưu vào sổ tay. */
function TryCard() {
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ info: WordInfo; cached: boolean; neurons: number; ms: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(e: FormEvent) {
    e.preventDefault()
    const q = term.trim()
    if (!q || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await suggestWordInfo(q)
      setResult({ info: res.data, cached: res.cached, neurons: res.neurons, ms: res.ms })
    } catch (err) {
      setError(err instanceof AiError ? AI_ERROR_TEXT[err.code] : AI_ERROR_TEXT.unavailable)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle className="mb-1 flex items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 text-accent" /> Thử trợ lý
      </SectionTitle>
      <p className="mb-3 text-xs text-subtle">Gõ một từ tiếng Anh để xem AI gợi ý nghĩa, ví dụ và mẹo nhớ. Chỉ để xem thử, không lưu vào sổ tay.</p>
      <form onSubmit={(e) => void ask(e)} className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-subtle" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="resilient, take off…"
            aria-label="Từ muốn hỏi AI"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
        </label>
        <Button type="submit" variant="primary" icon={busy ? LoaderCircle : Bot} className="h-12 shrink-0 px-4! disabled:opacity-60" disabled={busy || !term.trim()}>
          Hỏi
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-warning">{error}</p>}
      {result && (
        <div className="mt-4 flex flex-col gap-3">
          {result.info.senses.map((s, i) => (
            <div key={i} className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-[0.9375rem]">
                <span className="text-xs font-semibold text-muted">{POS_LABEL[s.pos]}</span> <b>{s.meaningVi}</b>
              </p>
              {s.exampleEn && <p className="mt-1 text-sm">{s.exampleEn}</p>}
              {s.exampleVi && <p className="text-sm text-muted italic">{s.exampleVi}</p>}
            </div>
          ))}
          {result.info.mnemonicVi && (
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">Mẹo nhớ:</span> {result.info.mnemonicVi}
            </p>
          )}
          <p className="text-xs text-subtle">{result.cached ? 'Lấy từ kết quả đã lưu, không tốn neuron.' : `Khoảng ${Math.round(result.neurons)} neuron · ${(result.ms / 1000).toFixed(1)} giây`}</p>
        </div>
      )}
    </Card>
  )
}
