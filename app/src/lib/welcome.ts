/** Bước thiết lập lần đầu (R1.7): mỗi thiết bị chỉ tự mở một lần. */

const WELCOME_KEY = 'welcome-done'

/** Thiết bị đã qua (hoặc bỏ qua) bước thiết lập lần đầu. */
export function welcomeDone(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return true
  }
}

export function markWelcomeDone() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    // Chế độ riêng tư: lần sau mở app có thể thấy lại màn hình chào.
  }
}
