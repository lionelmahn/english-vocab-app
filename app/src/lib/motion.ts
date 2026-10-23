import type { Transition, Variants } from 'motion/react'

/**
 * Cấu hình chuyển động chung cho cả app (kế hoạch mục 3.8).
 * Hiệu ứng trong vòng học giữ ở 150–300 ms để không làm chậm nhịp ôn.
 */

type Bezier = [number, number, number, number]

export const duration = {
  fast: 0.15,
  base: 0.24,
  slow: 0.4,
} as const

export const ease: Record<'out' | 'inOut', Bezier> = {
  out: [0.2, 0.8, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
}

export const spring = {
  /** Phản hồi chạm, chỉ báo tab. */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  /** Thẻ, khối lớn. */
  soft: { type: 'spring', stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>

/** Chuyển màn hình: trượt nhẹ theo hướng tab. `custom` = -1 (sang trái), 0, 1 (sang phải). */
export const pageVariants: Variants = {
  enter: (direction: number) => ({ x: direction * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -28, opacity: 0 }),
}

export const pageTransition: Transition = { duration: duration.base, ease: ease.out }

/** Khối con xuất hiện lần lượt. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
}

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
}

export const tapScale = { scale: 0.96 }
