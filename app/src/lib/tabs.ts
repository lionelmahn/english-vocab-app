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
const BELONGS_TO: Record<string, string> = {
  '/login': '/me',
  '/reset-password': '/me',
}

export function tabIndexOf(pathname: string): number {
  const path = BELONGS_TO[pathname] ?? pathname
  const i = TABS.findIndex((t) => (t.path === '/' ? path === '/' : path.startsWith(t.path)))
  return i === -1 ? 0 : i
}
