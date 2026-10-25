import { useEffect, useRef, useState } from 'react'

/**
 * Ghi âm từ micro (R7.2, R7.8): xin quyền, ghi tối đa `maxSeconds` giây, trả về file khi dừng.
 * Rời trang hoặc đóng bảng giữa chừng thì tắt micro và bỏ bản đang ghi.
 */

/** Loại file ghi âm: iPhone ghi được m4a (phát được ở mọi máy), máy khác thường là webm. */
export function recorderType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported?.(t))
}

export function micError(e: unknown, fallback = 'Không mở được micro. Thử lại sau.'): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'App chưa được dùng micro. Trên iPhone: Cài đặt → Safari → Micro → Hỏi hoặc Cho phép, rồi thử lại.'
  if (name === 'NotFoundError') return 'Không tìm thấy micro trên máy này.'
  return fallback
}

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export function useRecorder(maxSeconds: number, onRecorded: (blob: Blob) => void, fallbackError?: string) {
  const [phase, setPhase] = useState<'idle' | 'asking' | 'recording'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const cleanup = useRef<() => void>(() => undefined)
  const handler = useRef(onRecorded)
  useEffect(() => {
    handler.current = onRecorded
  })

  useEffect(() => () => cleanup.current(), [])

  async function start() {
    setError(null)
    setPhase('asking')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (e) {
      setPhase('idle')
      setError(micError(e, fallbackError))
      return
    }
    const type = recorderType()
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []
    const startedAt = Date.now()
    let keep = true
    const tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000
      setElapsed(s)
      if (s >= maxSeconds && rec.state === 'recording') rec.stop()
    }, 200)
    cleanup.current = () => {
      keep = false
      clearInterval(tick)
      if (rec.state !== 'inactive') rec.stop()
      stream.getTracks().forEach((t) => t.stop())
    }
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      clearInterval(tick)
      stream.getTracks().forEach((t) => t.stop())
      setPhase('idle')
      const blob = new Blob(chunks, { type: rec.mimeType || type || 'audio/mp4' })
      if (keep && blob.size > 0) handler.current(blob)
    }
    recorder.current = rec
    setElapsed(0)
    rec.start()
    setPhase('recording')
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  return { phase, error, elapsed, start, stop }
}
