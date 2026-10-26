import { LoaderCircle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

/** Nút gọi AI dạng liên kết nhỏ, có biểu tượng lấp lánh; đang chờ thì quay và ghi "AI đang soạn…". */
export function AiLink({ children, busy, disabled, onClick }: { children: ReactNode; busy?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={busy || disabled} onClick={onClick} className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-accent disabled:text-subtle">
      {busy ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
      {busy ? 'AI đang soạn… (khoảng 10 giây)' : children}
    </button>
  )
}

export function AiErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-sm leading-snug text-warning">{message}</p>
}

/** Dòng nhắc chung dưới kết quả AI. */
export function AiNote({ children = 'AI có thể sai: xem lại trước khi lưu.' }: { children?: ReactNode }) {
  return <p className="text-xs leading-relaxed text-subtle">{children}</p>
}
