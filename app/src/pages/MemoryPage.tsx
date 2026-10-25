import { Brain, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { HelpButton } from '../components/Guide'
import { BackButton, Chip } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import { canOptimize, MIN_EACH_OUTCOME, MIN_REVIEWS, type OptimizeResult } from '../core/fsrsOptimizer'
import { RETENTION_OPTIONS } from '../core/profile'
import { intervalRatio } from '../core/scheduler'
import { formatDate } from '../lib/format'
import { showToast } from '../lib/toast'
import { resetToDefaultWeights, runOptimization, setRetention, useMemoryData } from '../services/memory'
import { useProfile } from '../services/profile'

const pct = (x: number) => `${Math.round(x * 100)}%`
const ratioText = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/** Mục tiêu ghi nhớ và tối ưu tham số lịch ôn theo lịch sử của người học (R5.13). */
export function MemoryPage() {
  const profile = useProfile()
  const data = useMemoryData()
  const [running, setRunning] = useState<number | null>(null)
  const [result, setResult] = useState<OptimizeResult | null | undefined>(undefined)
  if (!profile || !data) return null
  const { fsrs } = profile
  const ratio = intervalRatio(fsrs.retention, fsrs.weights ?? undefined)
  const ready = canOptimize(data.stats)

  async function optimize() {
    if (running !== null) return
    setRunning(0)
    setResult(undefined)
    try {
      const res = await runOptimization((p) => setRunning(p))
      setResult(res)
      if (res?.better) showToast('Đã dùng tham số mới cho lịch ôn')
    } finally {
      setRunning(null)
    }
  }

  return (
    <Page title="Mục tiêu ghi nhớ" subtitle="Lịch ôn theo trí nhớ của bạn" back={<BackButton fallback="/me" />} action={<HelpButton topic="schedule" />}>
      <Card>
        <SectionTitle className="mb-1">Mục tiêu ghi nhớ</SectionTitle>
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-muted">
          Khi một từ đến hạn ôn, app muốn bạn vẫn còn nhớ nó với xác suất này. Cao hơn thì ôn dày hơn và ít quên; thấp hơn thì ôn thưa hơn nhưng quên nhiều hơn.
        </p>
        <div className="flex flex-wrap gap-2">
          {RETENTION_OPTIONS.map((r) => (
            <Chip key={r} active={fsrs.retention === r} onClick={() => void setRetention(r)}>
              {pct(r)}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {fsrs.retention === 0.9
            ? 'Mặc định 90%: cân bằng giữa số lần ôn và số lần quên.'
            : ratio >= 1
              ? `Khoảng cách giữa các lần ôn dài gấp khoảng ${ratioText(ratio)} lần so với mức 90%.`
              : `Khoảng cách giữa các lần ôn chỉ còn khoảng ${ratioText(ratio)} lần so với mức 90%, nên số lượt ôn mỗi ngày tăng lên.`}{' '}
          Áp dụng từ lần ôn tiếp theo của mỗi từ; lịch đã hẹn giữ nguyên.
        </p>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Trí nhớ thực tế</SectionTitle>
        {data.rates ? (
          <p className="text-sm leading-relaxed">
            Ở các lượt ôn cách lần trước từ một ngày trở lên, bạn nhớ <b>{pct(data.rates.actual)}</b> ({data.rates.count} lượt). Theo tham số đang dùng, app dự đoán{' '}
            <b>{pct(data.rates.predicted)}</b>.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted">Chưa có lượt ôn nào cách lần trước từ một ngày trở lên.</p>
        )}
      </Card>

      <Card>
        <SectionTitle className="mb-1">Tối ưu theo lịch sử của bạn</SectionTitle>
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-muted">
          Thuật toán ôn tập có 21 tham số; mặc định là con số chung tính từ lịch sử ôn của rất nhiều người. Khi đủ lịch sử, app tính lại tham số cho riêng bạn ngay trên máy này, rồi chỉ dùng nếu dự đoán sát hơn mặc định.
        </p>
        <p className="flex items-start gap-2 text-sm leading-snug">
          <Brain aria-hidden className="mt-px h-4 w-4 shrink-0 text-accent" />
          <span>
            {fsrs.weights
              ? `Đang dùng tham số riêng: tối ưu ngày ${fsrs.optimizedAt ? formatDate(fsrs.optimizedAt) : '?'} từ ${fsrs.optimizedReviews} lượt ôn${fsrs.improvement !== null ? `, dự đoán sát hơn mặc định ${pct(fsrs.improvement)}` : ''}.`
              : 'Đang dùng tham số mặc định.'}
          </span>
        </p>
        {!ready && (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-muted">
              Cần ít nhất {MIN_REVIEWS} lượt ôn cách lần trước từ một ngày trở lên (hiện có {data.stats.reviews}), trong đó có ít nhất {MIN_EACH_OUTCOME} lần nhớ và{' '}
              {MIN_EACH_OUTCOME} lần quên.
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(1, data.stats.reviews / MIN_REVIEWS) * 100}%` }} />
            </div>
          </div>
        )}
        {result === null && <p className="mt-3 text-sm text-warning">Chưa đủ dữ liệu để tối ưu.</p>}
        {result && (
          <p className={`mt-3 text-sm leading-relaxed ${result.better ? 'text-accent-strong' : 'text-muted'}`}>
            {result.better
              ? `Tham số mới dự đoán sát hơn mặc định ${pct(result.improvement)} trên phần lịch sử để riêng kiểm tra, và đã được dùng cho lịch ôn.`
              : 'Tham số mới không dự đoán tốt hơn mặc định, nên app giữ nguyên tham số đang dùng. Thử lại khi có thêm lịch sử ôn.'}
          </p>
        )}
        <Button variant="primary" icon={Sparkles} className="mt-4 w-full disabled:opacity-60" disabled={!ready || running !== null} onClick={() => void optimize()}>
          {running !== null ? `Đang tính… ${Math.round(running * 100)}%` : 'Tối ưu tham số'}
        </Button>
        {fsrs.weights && (
          <Button
            icon={RotateCcw}
            className="mt-2 w-full"
            disabled={running !== null}
            onClick={async () => {
              await resetToDefaultWeights()
              setResult(undefined)
              showToast('Đã dùng lại tham số mặc định')
            }}
          >
            Dùng lại tham số mặc định
          </Button>
        )}
      </Card>
    </Page>
  )
}
