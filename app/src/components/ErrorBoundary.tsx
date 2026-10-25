import { Component, type ErrorInfo, type ReactNode } from 'react'

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
        <p className="text-[20px] font-bold">Trang này gặp lỗi</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">Dữ liệu của bạn vẫn an toàn. Thử tải lại app; nếu vẫn lỗi, chụp màn hình trang này gửi để sửa.</p>
        <p className="mt-3 text-xs break-words text-subtle">{this.state.error.message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={() => window.location.reload()} className="h-12 rounded-2xl bg-accent font-bold text-on-accent">
            Tải lại
          </button>
          <button type="button" onClick={() => window.location.assign('/')} className="h-12 rounded-2xl font-bold text-accent">
            Về trang Hôm nay
          </button>
        </div>
      </div>
    )
  }
}
