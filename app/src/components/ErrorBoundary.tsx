import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { submitReport } from '../services/feedback'

/**
 * Trang nào lỗi khi hiển thị thì báo lỗi kèm nút tải lại, thay vì để màn hình trắng.
 * Đặt trong khối trang (dựng lại mỗi lần đổi trang) nên sang trang khác là hết báo lỗi.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+3rem)] text-center">
        <p className="text-[1.25rem] font-bold">Trang này gặp lỗi</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">Dữ liệu của bạn vẫn an toàn. Thử tải lại app; nếu vẫn lỗi, bấm “Gửi báo lỗi này”.</p>
        <p className="mt-3 text-xs break-words text-subtle">{this.state.error.message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-2xl bg-accent font-bold text-on-accent">
            Tải lại
          </button>
          <button type="button" onClick={() => window.location.assign('/')} className="h-12 rounded-2xl font-bold text-accent">
            Về trang Hôm nay
          </button>
          <ReportCrash error={this.state.error} />
        </div>
      </div>
    )
  }
}

/** Gửi báo lỗi kèm thông báo lỗi và vết lỗi (R14.4), một chạm. */
function ReportCrash({ error }: { error: Error }) {
  const [sent, setSent] = useState(false)
  return (
    <button
      type="button"
      disabled={sent}
      onClick={async () => {
        await submitReport('bug', `Trang gặp lỗi: ${error.message}`, { error: error.message, stack: error.stack?.slice(0, 2000) })
        setSent(true)
      }}
      className="h-12 rounded-2xl font-bold text-muted disabled:opacity-70"
    >
      {sent ? 'Đã ghi báo lỗi, cảm ơn bạn' : 'Gửi báo lỗi này'}
    </button>
  )
}
