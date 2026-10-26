import { useCallback, useRef, useState } from 'react'
import { AI_ERROR_TEXT, AiError } from '../services/ai'
import { useProfile } from '../services/profile'

/** Trợ lý AI đang bật (Cá nhân → Trợ lý AI). Tắt thì các nút AI ẩn đi. */
export function useAiOn(): boolean {
  return useProfile()?.ai.enabled ?? false
}

/**
 * Chạy một lần hỏi AI: trạng thái chờ, kết quả, lỗi (đã đổi sang câu tiếng Việt). Bấm lại khi đang chờ thì bỏ qua;
 * kết quả của lần hỏi cũ về muộn thì không đè kết quả mới.
 */
export function useAiRun<T>() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const run = useCallback(async (task: () => Promise<T>) => {
    const id = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const value = await task()
      if (id === seq.current) setResult(value)
      return value
    } catch (e) {
      if (id === seq.current) setError(e instanceof AiError ? AI_ERROR_TEXT[e.code] : AI_ERROR_TEXT.unavailable)
      return null
    } finally {
      if (id === seq.current) setBusy(false)
    }
  }, [])
  const reset = useCallback(() => {
    seq.current++
    setBusy(false)
    setResult(null)
    setError(null)
  }, [])
  return { busy, result, error, run, reset }
}
