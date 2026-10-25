import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router'
import { spring } from '../lib/motion'
import { TABS, tabIndexOf } from '../lib/tabs'

export function TabBar() {
  // Tính tab đang chọn theo cả các màn hình con (ví dụ /login thuộc tab Cá nhân).
  const activeIndex = tabIndexOf(useLocation().pathname)

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg px-1">
        {TABS.map((tab, i) => {
          const isActive = i === activeIndex
          return (
            <li key={tab.path} className="flex-1">
              <Link
                to={tab.path}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center gap-0.5 pt-2 pb-1.5 outline-none"
              >
                <motion.span whileTap={{ scale: 0.86 }} className="relative flex h-8 w-14 items-center justify-center">
                  {isActive && <motion.span layoutId="tab-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-accent-soft" />}
                  <tab.icon
                    aria-hidden
                    className={`relative h-[22px] w-[22px] transition-colors ${isActive ? 'text-accent' : 'text-muted'}`}
                    strokeWidth={isActive ? 2.3 : 1.9}
                  />
                </motion.span>
                <span className={`text-[0.6875rem] transition-colors ${isActive ? 'font-semibold text-accent' : 'text-muted'}`}>{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
