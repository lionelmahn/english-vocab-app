import { CalendarCheck, CheckCheck, Flame, GraduationCap, Star, Trophy, Zap, type LucideIcon } from 'lucide-react'
import type { BadgeGroup } from '../core/achievements'

/** Biểu tượng của từng nhóm huy hiệu (R10.6). */
export const BADGE_ICON: Record<BadgeGroup, LucideIcon> = {
  streak: Flame,
  days: CalendarCheck,
  words: GraduationCap,
  answers: CheckCheck,
  perfect: Star,
  xp: Zap,
  test: Trophy,
}
