import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'

// Xin trình duyệt giữ dữ liệu lâu dài (giảm rủi ro iOS tự xóa dữ liệu của web app).
void navigator.storage?.persist?.().catch(() => false)

// iPhone chỉ tìm bản mới khi mở lại app từ đầu: kiểm tra thêm mỗi lần quay lại app,
// để bản mới được tải sẵn và dùng ngay ở lần mở sau.
if ('serviceWorker' in navigator) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void navigator.serviceWorker
      .getRegistration()
      .then((r) => r?.update())
      .catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
