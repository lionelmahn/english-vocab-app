import { useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../lib/settings'

const COLORS = ['#1d9e75', '#5dcaa5', '#ef9f27', '#d85a30', '#7f77dd', '#378add']

/** Pháo giấy nhẹ bằng canvas, tự tắt khi người dùng giảm hiệu ứng. */
export function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const systemReduce = useReducedMotion()
  const { reduceMotion } = useSettings()

  useEffect(() => {
    const canvas = ref.current
    if (!fire || !canvas || systemReduce || reduceMotion) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    const parts = Array.from({ length: 110 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h * 0.28,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 9 - 4,
      s: Math.random() * 6 + 5,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.35,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
    const start = performance.now()
    let raf = 0
    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.vy += 0.28
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.a += p.va
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.a)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2)
        ctx.restore()
      }
      if (t - start < 2200) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [fire, systemReduce, reduceMotion])

  return createPortal(<canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-30 h-full w-full" />, document.body)
}
