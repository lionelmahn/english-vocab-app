import { Download, HardDrive, Square, Trash2, Wifi, WifiOff } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { CloudStatus } from '../components/CloudStatus'
import { HelpButton } from '../components/Guide'
import { BackButton } from '../components/kit'
import { Button, Card, Page, SectionTitle } from '../components/ui'
import type { VocabItem } from '../db/types'
import { useLibrary } from '../lib/hooks'
import { useSettings } from '../lib/settings'
import { showToast } from '../lib/toast'
import { clearDownloadResult, removeAllAudio, removeAudio, startDownload, stopDownload, useDownloadJob, useOfflineSummary, type DownloadJob } from '../services/offlineAudio'
import { clearDictionaryCache, formatBytes, requestPersist, useOnline, useStorageCounts, useStorageEstimate } from '../services/storage'

/** Dùng khi không có mạng (R11.6) và quản lý dữ liệu tải về máy (R11.8). */
export function OfflinePage() {
  const online = useOnline()
  const lib = useLibrary()
  const settings = useSettings()
  const counts = useStorageCounts()
  const estimate = useStorageEstimate(`${counts?.offlineBytes}|${counts?.dictionary}|${counts?.voiceClips}|${counts?.ownAudio}`)
  const accentName = settings.accent === 'uk' ? 'Anh–Anh' : 'Anh–Mỹ'

  const groups = useMemo(() => {
    if (!lib) return []
    const live = lib.items.filter((i) => !i.archived && i.deletedAt === null)
    const decks = lib.decks
      .filter((d) => !d.archived && d.deletedAt === null)
      .map((d) => ({ id: d.id, name: d.name, words: live.filter((i) => lib.members.get(i.id)?.has(d.id)) }))
      .filter((g) => g.words.length > 0)
    return [{ id: 'all', name: 'Mọi từ trong sổ tay', words: live }, ...decks]
  }, [lib])

  return (
    <Page title="Dùng khi không có mạng" subtitle="Học ngoại tuyến, âm thanh tải về và dung lượng" back={<BackButton fallback="/me" />} action={<HelpButton topic="offline" />}>
      <Card>
        <SectionTitle className="mb-2">Học khi không có mạng</SectionTitle>
        <p className={`flex items-center gap-2 text-[15px] font-semibold ${online ? 'text-accent' : 'text-warning'}`}>
          {online ? <Wifi aria-hidden className="h-5 w-5" /> : <WifiOff aria-hidden className="h-5 w-5" />}
          {online ? 'Đang có mạng' : 'Đang ngoại tuyến'}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Từ vựng, lịch ôn và kết quả học đều nằm trên máy này, nên học và ôn được cả khi mất mạng. Có mạng lại, kết quả tự đồng bộ lên máy chủ và sang các máy khác. Những việc cần
          mạng: tra từ chưa tra bao giờ, nghe bản ghi giọng người thật chưa tải về, nhận nhắc nhở.
        </p>
        <div className="mt-4">
          <CloudStatus />
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-1">Âm thanh ngoại tuyến</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-subtle">
          Bản ghi giọng người thật (Wiktionary) phát qua mạng; tải về để nghe cả khi mất mạng. Giọng máy, Giọng iPhone và bản bạn tự ghi âm vốn đã nằm trên máy. App tải bản của giọng{' '}
          {accentName} (giọng đang chọn ở Cá nhân); đổi giọng thì tải lại.
        </p>
        {!online && settings.preferRecordings && <p className="mb-2 text-[13px] text-warning">Cần có mạng để tải âm thanh.</p>}
        {!settings.preferRecordings ? (
          <p className="text-sm leading-relaxed text-muted">Bạn đang tắt “Ưu tiên giọng người thật” nên app đọc từ bằng giọng máy, không cần tải gì.</p>
        ) : !lib ? (
          <p className="text-sm text-muted">Đang tải…</p>
        ) : groups[0].words.length === 0 ? (
          <p className="text-sm text-muted">Sổ tay chưa có từ nào.</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {groups.map((g) => (
              <AudioRow key={g.id} id={g.id} name={g.name} words={g.words} accent={settings.accent} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle className="mb-1">Dung lượng trên máy</SectionTitle>
        {estimate?.usage != null && (
          <p className="mb-3 text-sm text-muted">
            App đang dùng <b className="text-text">{formatBytes(estimate.usage)}</b>
            {estimate.quota ? ` (trình duyệt cho phép tới ${formatBytes(estimate.quota)})` : ''}.
          </p>
        )}
        {counts && (
          <div className="flex flex-col divide-y divide-line">
            <StorageRow label="Sổ tay" value={`${counts.words} từ, cùng lịch ôn và lịch sử học`} />
            <StorageRow
              label="Âm thanh đã tải"
              value={counts.offlineFiles > 0 ? `${counts.offlineFiles} file · ${formatBytes(counts.offlineBytes)}` : 'Chưa có'}
              action={
                counts.offlineFiles > 0 && (
                  <Button
                    icon={Trash2}
                    className="h-9 px-3 text-sm"
                    onClick={async () => {
                      if (!window.confirm(`Xóa ${counts.offlineFiles} file âm thanh đã tải? Có mạng thì vẫn nghe được, tải lại lúc nào cũng được.`)) return
                      await removeAllAudio()
                      showToast('Đã xóa âm thanh đã tải')
                    }}
                  >
                    Xóa hết
                  </Button>
                )
              }
            />
            <StorageRow label="Giọng iPhone" value={counts.voiceClips > 0 ? `${counts.voiceClips} âm thanh` : 'Chưa có'} />
            <StorageRow label="Bản ghi âm của bạn" value={counts.ownAudio > 0 ? `${counts.ownAudio} file` : 'Chưa có'} />
            <StorageRow
              label="Kết quả tra từ đã lưu"
              value={counts.dictionary > 0 ? `${counts.dictionary} từ (xem lại được khi mất mạng)` : 'Chưa có'}
              action={
                counts.dictionary > 0 && (
                  <Button
                    icon={Trash2}
                    className="h-9 px-3 text-sm"
                    onClick={async () => {
                      if (!window.confirm('Xóa kết quả tra từ đã lưu? Lần sau tra lại cần có mạng. Từ đã lưu vào sổ tay không bị ảnh hưởng.')) return
                      await clearDictionaryCache()
                      showToast('Đã xóa kết quả tra từ đã lưu')
                    }}
                  >
                    Xóa
                  </Button>
                )
              }
            />
          </div>
        )}
        {estimate?.persisted === true && (
          <p className="mt-3 flex gap-2 text-[13px] leading-snug text-accent">
            <HardDrive aria-hidden className="mt-px h-4 w-4 shrink-0" />
            Đã bật giữ dữ liệu lâu dài: trình duyệt không tự xóa dữ liệu của app khi máy đầy bộ nhớ.
          </p>
        )}
        {estimate?.persisted === false && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[13px] leading-snug text-muted">Khi máy hết bộ nhớ, trình duyệt có thể tự xóa dữ liệu của trang web. Bật giữ lâu dài để tránh việc này.</p>
            <Button
              icon={HardDrive}
              className="w-full"
              onClick={async () => {
                const ok = await requestPersist()
                showToast(ok ? 'Đã bật giữ dữ liệu lâu dài' : 'Trình duyệt chưa cho phép. Cài app lên màn hình chính rồi thử lại.')
              }}
            >
              Giữ dữ liệu lâu dài
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-subtle">Đăng nhập để đồng bộ hoặc tạo bản sao lưu thường xuyên, để không mất sổ tay nếu máy hỏng hay bị xóa dữ liệu.</p>
      </Card>
    </Page>
  )
}

function StorageRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-[13px] leading-snug text-muted">{value}</p>
      </div>
      {action}
    </div>
  )
}

function AudioRow({ id, name, words, accent }: { id: string; name: string; words: VocabItem[]; accent: 'us' | 'uk' }) {
  const summary = useOfflineSummary(words, accent, true)
  const online = useOnline()
  const job = useDownloadJob()
  const mine = job?.id === id ? job : null
  const busy = !!job && !job.result

  const details = summary
    ? [
        `${summary.ready}/${summary.total} từ nghe được giọng thật khi mất mạng`,
        summary.pending > 0 && `${summary.pending} từ chưa tải`,
        summary.voice > 0 && `${summary.voice} từ đọc bằng giọng máy`,
      ].filter(Boolean)
    : ['Đang kiểm tra…']

  const canDownload = !!summary && summary.pending > 0
  const canRemove = !!summary && summary.saved > 0

  return (
    <div className="py-3">
      <p className="text-[15px] font-semibold">{name}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-muted">{details.join(' · ')}</p>
      {(canDownload || canRemove || (mine && !mine.result)) && (
        <div className="mt-2 flex gap-2">
          {mine && !mine.result ? (
            <Button icon={Square} className="h-9 px-3 text-sm" onClick={stopDownload}>
              Dừng
            </Button>
          ) : (
            <>
              {canDownload && (
                <Button
                  icon={Download}
                  variant="primary"
                  className="h-9 px-3 text-sm"
                  disabled={busy || !online}
                  onClick={() => {
                    clearDownloadResult()
                    startDownload(id, words, accent, true)
                  }}
                >
                  Tải
                </Button>
              )}
              {canRemove && (
                <Button
                  icon={Trash2}
                  className="h-9 px-3 text-sm"
                  aria-label={`Xóa âm thanh đã tải của ${name}`}
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`Xóa âm thanh đã tải của “${name}”? Có mạng thì vẫn nghe được.`)) return
                    const n = await removeAudio(words)
                    showToast(`Đã xóa ${n} file âm thanh`)
                  }}
                >
                  Xóa
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {mine && <JobProgress job={mine} />}
    </div>
  )
}

function JobProgress({ job }: { job: DownloadJob }) {
  const { phase, done, total, failed } = job.progress
  if (job.result) {
    const { saved, failed: errors, stopped } = job.result
    const text = stopped ? `Đã dừng, tải được ${saved} file.` : saved === 0 && errors === 0 ? 'Không có file nào cần tải thêm.' : `Đã tải ${saved} file.`
    return (
      <p className={`mt-2 text-[13px] ${errors > 0 ? 'text-warning' : 'text-accent'}`}>
        {text}
        {errors > 0 && ` ${errors} file chưa tải được (mạng chập chờn?), bấm Tải để thử lại.`}
      </p>
    )
  }
  const ratio = phase === 'looking' || total === 0 ? 0 : done / total
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${phase === 'looking' ? 8 : Math.max(4, ratio * 100)}%` }} />
      </div>
      <p className="mt-1 text-[12px] text-subtle">
        {phase === 'looking' ? `Đang tìm bản ghi cho ${total} từ…` : `Đang tải ${done}/${total} file${failed > 0 ? ` (${failed} lỗi)` : ''}…`}
      </p>
    </div>
  )
}
