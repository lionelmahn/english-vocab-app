import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useSettings } from '../lib/settings'

/** Số đếm dần tới giá trị mới. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const systemReduce = useReducedMotion()
  const { reduceMotion } = useSettings()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (systemReduce || reduceMotion) {
      el.textContent = String(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v))
      },
    })
    from.current = value
    return () => controls.stop()
  }, [value, systemReduce, reduceMotion])

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
