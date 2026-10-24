import { BookOpen, ChartColumn, House, Search, UserRound, type LucideIcon } from 'lucide-react'

export interface TabDef {
  path: string
  label: string
  icon: LucideIcon
}

export const TABS: readonly TabDef[] = [
  { path: '/', label: 'Hôm nay', icon: House },
  { path: '/notebook', label: 'Sổ tay', icon: BookOpen },
  { path: '/lookup', label: 'Tra từ', icon: Search },
  { path: '/stats', label: 'Thống kê', icon: ChartColumn },
  { path: '/me', label: 'Cá nhân', icon: UserRound },
]

/** Màn hình không nằm trên thanh tab nhưng thuộc về một tab. */
const BELONGS_TO: [prefix: string, tab: string][] = [
  ['/words', '/notebook'],
  ['/decks', '/notebook'],
  ['/import', '/notebook'],
  ['/backup', '/me'],
  ['/help', '/me'],
  ['/login', '/me'],
  ['/reset-password', '/me'],
  ['/welcome', '/'],
  ['/learn', '/'],
  ['/review', '/'],
  ['/study', '/'],
]

export function tabIndexOf(pathname: string): number {
  const alias = BELONGS_TO.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const path = alias ? alias[1] : pathname
  const i = TABS.findIndex((t) => (t.path === '/' ? path === '/' : path === t.path || path.startsWith(`${t.path}/`)))
  return i === -1 ? 0 : i
}

/** Màn hình học/ôn và thiết lập lần đầu: ẩn thanh tab để tập trung. */
export function isFocusMode(pathname: string): boolean {
  return /^\/(learn|review|study|welcome)(\/|$)/.test(pathname)
}
