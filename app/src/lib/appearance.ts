import { TEXT_SCALE, type TextSize, type ThemeChoice } from './settings'

/** Màu thanh trạng thái theo giao diện (khớp --app-bg trong index.css). */
const BAR_COLOR = { light: '#f5f6f2', dark: '#0e1311' } as const

/**
 * Áp giao diện sáng/tối và cỡ chữ lên trang (R14.1). "Theo máy" thì bỏ thuộc tính data-theme để CSS theo hệ điều hành.
 * index.html làm việc tương tự trước khi app chạy, đọc từ cùng chỗ lưu cài đặt.
 */
export function applyAppearance(theme: ThemeChoice, textSize: TextSize): void {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  root.style.fontSize = TEXT_SCALE[textSize] ?? '100%'
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = BAR_COLOR[theme === 'system' ? own : theme]
  }
}
