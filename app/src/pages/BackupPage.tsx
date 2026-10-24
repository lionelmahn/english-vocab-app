import { useLiveQuery } from 'dexie-react-hooks'
import { ArchiveRestore, CloudDownload, Combine, DatabaseBackup, FileJson, LogIn, RotateCcw, Share } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackButton, Badge, Segmented, Sheet } from '../components/kit'
import { Button, Card, FormMessage, Page, SectionTitle } from '../components/ui'
import { duplicateGroups } from '../core/vocab'
import { backupFileName, createBackup, previewRestore, readBackup, restoreBackup, type BackupFile, type RestorePreview, type RestoreResult } from '../db/backup'
import { db, notifyChange } from '../db/db'
import { appScheduler, repo } from '../db/repo'
import { formatDate } from '../lib/format'
import { useLibrary } from '../lib/hooks'
import { applyPortableSettings, portableSettings } from '../lib/settings'
import { APP_VERSION } from '../lib/version'
import { useAuth } from '../services/auth'
import { isAppleMobile } from '../services/speech'
import { resyncAll, useSyncStatus } from '../services/sync'

type Message = { tone: 'error' | 'success'; text: string } | null

const num = new Intl.NumberFormat('vi-VN')

function isPhone(): boolean {
  return isAppleMobile() || /Android/i.test(navigator.userAgent)
}

/** Điện thoại: mở bảng chia sẻ (iPhone chọn "Lưu vào Tệp"). Máy tính: tải file xuống. */
async function saveFile(name: string, text: string): Promise<'saved' | 'cancelled'> {
  const file = new File([text], name, { type: 'application/json' })
  if (isPhone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'saved'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      // Không chia sẻ được: tải xuống như máy tính.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}

function restoreSummary(r: RestoreResult, settings: boolean): string {
  const parts = [
    r.added && `thêm ${num.format(r.added)} từ`,
    r.restored && `lấy lại ${num.format(r.restored)} từ đã xóa`,
    r.updated && `cập nhật ${num.format(r.updated)} từ`,
    r.removed && `xóa ${num.format(r.removed)} từ không có trong bản sao lưu`,
    r.skipped && `bỏ qua ${num.format(r.skipped)} từ trùng`,
    r.logs && `${num.format(r.logs)} lượt học`,
    settings && 'cài đặt học',
  ].filter(Boolean)
  return parts.length > 0 ? `Đã khôi phục: ${parts.join(', ')}.` : 'Dữ liệu trên thiết bị đã có đủ nội dung của bản sao lưu, không có gì thay đổi.'
}

/** Sao lưu ra file có tiến độ (R11.3) và khôi phục từ file (R11.4); tải lại từ máy chủ (R11.5). */
export function BackupPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const sync = useSyncStatus()
  const lib = useLibrary()
  const logCount = useLiveQuery(() => db.reviewLogs.count(), [], 0)

  // ---- Sao lưu
  const [prepared, setPrepared] = useState<{ name: string; text: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [exportMsg, setExportMsg] = useState<Message>(null)

  async function prepare() {
    setPreparing(true)
    setExportMsg(null)
    try {
      const file = await createBackup(db, { appVersion: APP_VERSION, settings: portableSettings() })
      setPrepared({ name: backupFileName(), text: JSON.stringify(file) })
    } catch (e) {
      setExportMsg({ tone: 'error', text: `Không tạo được bản sao lưu: ${(e as Error).message}` })
    } finally {
      setPreparing(false)
    }
  }

  async function save() {
    if (!prepared) return
    // Bảng chia sẻ cần mở ngay khi chạm, nên file đã được tạo sẵn ở bước trước.
    const res = await saveFile(prepared.name, prepared.text)
    if (res === 'saved') setExportMsg({ tone: 'success', text: `Đã xuất ${prepared.name}. Hãy cất file ở nơi an toàn (iCloud Drive, Google Drive…).` })
  }

  // ---- Khôi phục
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState<{ name: string; backup: BackupFile; invalid: number; preview: RestorePreview } | null>(null)
  const [reading, setReading] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<Message>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [keepDuplicates, setKeepDuplicates] = useState(false)
  const [withSettings, setWithSettings] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setReading(true)
    setRestoreMsg(null)
    try {
      const read = readBackup(await file.text())
      if (!read.ok) {
        setRestoreMsg({ tone: 'error', text: read.error })
        setLoaded(null)
        return
      }
      setLoaded({ name: file.name, backup: read.backup, invalid: read.invalid, preview: await previewRestore(db, read.backup) })
      setMode('merge')
      setKeepDuplicates(false)
      setWithSettings(false)
    } catch (e) {
      setRestoreMsg({ tone: 'error', text: `Không đọc được file: ${(e as Error).message}` })
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function doRestore() {
    if (!loaded || restoring) return
    setConfirming(false)
    setRestoring(true)
    try {
      const res = await restoreBackup(db, loaded.backup, { mode, duplicates: keepDuplicates ? 'keep' : 'skip' }, appScheduler)
      const settings = withSettings && !!loaded.backup.settings && applyPortableSettings(loaded.backup.settings) > 0
      notifyChange()
      setRestoreMsg({ tone: 'success', text: restoreSummary(res, settings) })
      setLoaded(null)
    } catch (e) {
      setRestoreMsg({ tone: 'error', text: `Khôi phục lỗi: ${(e as Error).message}. Dữ liệu trên thiết bị chưa bị thay đổi.` })
    } finally {
      setRestoring(false)
    }
  }

  // ---- Từ trùng
  const dupGroups = useMemo(() => (lib ? duplicateGroups(lib.items) : []), [lib])
  const extraCopies = dupGroups.reduce((n, g) => n + g.length - 1, 0)
  const [merging, setMerging] = useState(false)
  const [dupMsg, setDupMsg] = useState<Message>(null)

  async function mergeDuplicates() {
    setMerging(true)
    try {
      const res = await repo.mergeDuplicates()
      setDupMsg({ tone: 'success', text: `Đã gộp ${num.format(res.groups)} từ, bỏ ${num.format(res.removed)} mục trùng.` })
    } catch (e) {
      setDupMsg({ tone: 'error', text: `Không gộp được: ${(e as Error).message}` })
    } finally {
      setMerging(false)
    }
  }

  const p = loaded?.preview
  const data = loaded?.backup.data
  const exportedAt = loaded && Date.parse(loaded.backup.exportedAt)
  const signedIn = auth.status === 'signed_in'

  return (
    <Page title="Sao lưu và khôi phục" subtitle="Giữ một bản dữ liệu học của bạn ngoài app" back={<BackButton fallback="/me" />}>
      <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />

      <Card>
        <SectionTitle className="mb-1">Sao lưu ra file</SectionTitle>
        <p className="mb-3 text-sm leading-relaxed text-muted">
          File gồm từ vựng, bộ từ, tiến độ ôn, lịch sử học và cài đặt học
          {lib && ` — hiện có ${num.format(lib.items.length)} từ, ${num.format(lib.decks.length)} bộ, ${num.format(logCount)} lượt học`}.
        </p>
        {prepared ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
              <FileJson aria-hidden className="h-5 w-5 shrink-0 text-accent" />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{prepared.name}</p>
              <span className="text-xs text-subtle">{num.format(Math.ceil(prepared.text.length / 1024))} KB</span>
            </div>
            <Button variant="primary" icon={Share} className="w-full" onClick={() => void save()}>
              {isPhone() ? 'Lưu hoặc chia sẻ file' : 'Tải file xuống'}
            </Button>
          </div>
        ) : (
          <Button variant="primary" icon={DatabaseBackup} className="w-full disabled:opacity-70" disabled={preparing || !lib} onClick={() => void prepare()}>
            {preparing ? 'Đang tạo…' : 'Tạo bản sao lưu'}
          </Button>
        )}
        <FormMessage message={exportMsg} />
      </Card>

      <Card>
        <SectionTitle className="mb-1">Khôi phục từ file</SectionTitle>
        {!loaded ? (
          <>
            <p className="mb-3 text-sm leading-relaxed text-muted">Chọn file .json đã sao lưu. App kiểm tra file và cho xem trước trước khi thay đổi dữ liệu.</p>
            <Button icon={ArchiveRestore} className="w-full disabled:opacity-70" disabled={reading} onClick={() => inputRef.current?.click()}>
              {reading ? 'Đang kiểm tra…' : 'Chọn file sao lưu'}
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{loaded.name}</p>
                <p className="text-sm text-muted">
                  {exportedAt ? `Sao lưu lúc ${formatDate(exportedAt)}` : 'Không rõ thời điểm sao lưu'}
                  {loaded.backup.appVersion && ` · bản ${loaded.backup.appVersion}`}
                </p>
              </div>
              <Button icon={RotateCcw} className="h-9 px-3 text-sm" onClick={() => setLoaded(null)}>
                Chọn lại
              </Button>
            </div>
            <p className="text-sm text-muted">
              Trong file: {num.format(data!.vocabItems.length)} từ, {num.format(data!.decks.length)} bộ, {num.format(data!.cardStates.length)} từ đã học,{' '}
              {num.format(data!.reviewLogs.length)} lượt học.
            </p>
            <div className="flex flex-wrap gap-2">
              {!!p!.newItems && <Badge tone="accent">{num.format(p!.newItems)} từ chưa có ở đây</Badge>}
              {!!p!.deletedHere && <Badge tone="accent">{num.format(p!.deletedHere)} từ đã xóa ở đây</Badge>}
              {!!p!.existing && <Badge>{num.format(p!.existing)} từ đang có</Badge>}
              {!!p!.duplicates && <Badge tone="warning">{num.format(p!.duplicates)} từ trùng nội dung</Badge>}
              {!!p!.newLogs && <Badge tone="accent">{num.format(p!.newLogs)} lượt học mới</Badge>}
              {!!loaded.invalid && <Badge tone="danger">{num.format(loaded.invalid)} dòng hỏng — bỏ qua</Badge>}
            </div>

            <Segmented
              value={mode}
              onChange={setMode}
              layoutId="restore-mode"
              options={[
                { value: 'merge', label: 'Gộp' },
                { value: 'replace', label: 'Thay thế' },
              ]}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm leading-relaxed text-muted">
                {mode === 'merge'
                  ? 'Thêm từ còn thiếu, lấy lại từ đã xóa. Từ có ở cả hai nơi thì giữ bản sửa sau cùng. Không xóa gì trên thiết bị.'
                  : `Từ vựng và bộ từ trở về đúng như bản sao lưu${p!.onlyHere ? `: ${num.format(p!.onlyHere)} từ không có trong file sẽ bị xóa` : ''}. Lượt học không bao giờ bị xóa, tiến độ ôn vẫn tính đủ các lượt học sau thời điểm sao lưu.`}
              </motion.p>
            </AnimatePresence>
            {mode === 'merge' && !!p!.duplicates && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={keepDuplicates} onChange={(e) => setKeepDuplicates(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--app-accent)]" />
                <span>
                  Vẫn thêm {num.format(p!.duplicates)} từ trùng nội dung thành mục học riêng
                  <span className="block text-xs text-subtle">Bỏ chọn: giữ từ đang có cùng tiến độ của nó, bỏ qua bản trong file.</span>
                </span>
              </label>
            )}
            {loaded.backup.settings && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--app-accent)]" />
                <span>
                  Dùng cả cài đặt học trong bản sao lưu
                  <span className="block text-xs text-subtle">Số từ mới mỗi ngày, cách ôn, giọng Anh–Mỹ/Anh–Anh… Giọng máy đã chọn trên thiết bị này được giữ.</span>
                </span>
              </label>
            )}
            <Button
              variant={mode === 'replace' ? 'danger' : 'primary'}
              className="w-full disabled:opacity-70"
              disabled={restoring}
              onClick={() => (mode === 'replace' ? setConfirming(true) : void doRestore())}
            >
              {restoring ? 'Đang khôi phục…' : mode === 'replace' ? 'Thay thế bằng bản sao lưu' : 'Khôi phục'}
            </Button>
          </div>
        )}
        <FormMessage message={restoreMsg} />
      </Card>

      {(dupGroups.length > 0 || dupMsg) && (
        <Card>
          <SectionTitle className="mb-1">Từ trùng</SectionTitle>
          {dupGroups.length > 0 && (
            <>
              <p className="mb-3 text-sm leading-relaxed text-muted">
                {num.format(dupGroups.length)} từ đang có nhiều mục cùng nghĩa (
                {dupGroups
                  .slice(0, 3)
                  .map((g) => g[0].term)
                  .join(', ')}
                {dupGroups.length > 3 ? '…' : ''}), thường do cùng nhập một danh sách trên hai thiết bị. Gộp lại sẽ giữ mục có tiến độ cao nhất, chuyển bộ từ sang mục đó và giữ lịch sử học.
              </p>
              <Button icon={Combine} className="w-full disabled:opacity-70" disabled={merging} onClick={() => void mergeDuplicates()}>
                {merging ? 'Đang gộp…' : `Gộp ${num.format(extraCopies)} mục trùng`}
              </Button>
            </>
          )}
          <FormMessage message={dupMsg} />
        </Card>
      )}

      <Card>
        <SectionTitle className="mb-1">Bản trên máy chủ</SectionTitle>
        {signedIn ? (
          <>
            <p className="mb-3 text-sm leading-relaxed text-muted">
              Dữ liệu tự đồng bộ giữa các thiết bị đăng nhập cùng tài khoản. Nếu thiết bị này thiếu dữ liệu, tải lại toàn bộ từ máy chủ và gộp với dữ liệu đang có (không xóa gì).
            </p>
            <Button icon={CloudDownload} className="w-full disabled:opacity-70" disabled={sync.state === 'syncing'} onClick={() => void resyncAll()}>
              {sync.state === 'syncing' ? 'Đang đồng bộ…' : 'Tải lại toàn bộ từ máy chủ'}
            </Button>
            {sync.state === 'error' && <FormMessage message={{ tone: 'error', text: `Đồng bộ lỗi: ${sync.error}` }} />}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm leading-relaxed text-muted">Đăng nhập để dữ liệu tự đồng bộ giữa các thiết bị và luôn có một bản trên máy chủ.</p>
            <Button icon={LogIn} className="w-full" onClick={() => navigate('/login')}>
              Đăng nhập
            </Button>
          </>
        )}
      </Card>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Thay thế bằng bản sao lưu?">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          {p?.onlyHere
            ? `${num.format(p.onlyHere)} từ đang có nhưng không có trong bản sao lưu sẽ bị xóa trên mọi thiết bị đã đồng bộ. `
            : ''}
          Từ đã sửa sau thời điểm sao lưu sẽ trở về nội dung cũ. Lượt học và tiến độ ôn vẫn được giữ.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="danger" className="w-full" onClick={() => void doRestore()}>
            Thay thế
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setConfirming(false)}>
            Hủy
          </Button>
        </div>
      </Sheet>
    </Page>
  )
}
