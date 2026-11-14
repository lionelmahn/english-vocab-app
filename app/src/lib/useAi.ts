import { useCallback, useEffect, useRef, useState } from 'react'
import { aiErrorText } from '../services/ai'
import { play, type Sfx } from './sfx'
import { useProfile } from '../services/profile'

/** Trợ lý AI đang bật (Cá nhân → Trợ lý AI). Tắt thì các nút AI ẩn đi. */
export function useAiOn(): boolean {
  return useProfile()?.ai.enabled ?? false
}

/**
 * Chạy một lần hỏi AI: trạng thái chờ, kết quả, lỗi (đã đổi sang câu tiếng Việt). Bấm lại khi đang chờ thì bỏ qua;
 * kết quả của lần hỏi cũ về muộn thì không đè kết quả mới. Có kết quả thì phát `doneSound` (mặc định tiếng "AI trả lời
 * xong"), lỗi thì phát tiếng lỗi.
 */
export function useAiRun<T>(doneSound: (value: T) => Sfx | null = () => 'ready') {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const sound = useRef(doneSound)
  useEffect(() => {
    sound.current = doneSound
  })
  const run = useCallback(async (task: () => Promise<T>) => {
    const id = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const value = await task()
      if (id === seq.current) {
        setResult(value)
        const s = sound.current(value)
        if (s) play(s)
      }
      return value
    } catch (e) {
      if (id === seq.current) {
        setError(aiErrorText(e))
        play('error')
      }
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
