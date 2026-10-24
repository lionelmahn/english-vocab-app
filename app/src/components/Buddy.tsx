import { motion } from 'motion/react'

export type BuddyMood = 'happy' | 'cheer' | 'sad' | 'neutral'

/**
 * Nhân vật của app: một tấm thẻ học nhỏ có mầm lá trên đầu.
 * Vui khi trả lời đúng, buồn khi sai, reo khi hoàn thành.
 */
export function Buddy({ mood = 'happy', size = 72, className = '' }: { mood?: BuddyMood; size?: number; className?: string }) {
  const sad = mood === 'sad'
  return (
    <motion.svg
      viewBox="0 0 80 84"
      width={size}
      height={size * 1.05}
      aria-hidden
      className={className}
      initial={{ y: 14, opacity: 0, rotate: 0 }}
      animate={sad ? { y: 0, opacity: 1, rotate: [0, -6, 5, -3, 0] } : { y: [14, -4, 0], opacity: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
    >
      {/* Thẻ phía sau */}
      <rect x="16" y="20" width="52" height="58" rx="14" fill="var(--app-sun)" transform="rotate(10 42 49)" />
      {/* Mầm lá */}
      <path d="M40 22 C40 14 40 12 40 10" stroke="var(--app-accent)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M40 13 C32 4 22 8 24 14 C30 17 36 16 40 13 Z" fill="var(--app-accent)" />
      <path d="M40 11 C47 2 57 5 56 11 C51 15 45 14 40 11 Z" fill="#5dcaa5" />
      {/* Thẻ chính */}
      <rect x="12" y="20" width="56" height="60" rx="16" fill="var(--app-surface)" stroke="var(--app-accent)" strokeWidth="3.5" />
      {/* Má */}
      <ellipse cx="22" cy="58" rx="6" ry="3.6" fill="#f4a3a3" opacity="0.65" />
      <ellipse cx="58" cy="58" rx="6" ry="3.6" fill="#f4a3a3" opacity="0.65" />
      {/* Mắt */}
      {mood === 'happy' || mood === 'cheer' ? (
        <>
          <path d="M24 46 Q29 39 34 46" stroke="var(--app-text)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path d="M46 46 Q51 39 56 46" stroke="var(--app-text)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="29" cy="45" r="4.2" fill="var(--app-text)" />
          <circle cx="51" cy="45" r="4.2" fill="var(--app-text)" />
          <circle cx="30.4" cy="43.6" r="1.4" fill="var(--app-surface)" />
          <circle cx="52.4" cy="43.6" r="1.4" fill="var(--app-surface)" />
        </>
      )}
      {sad && (
        <>
          <path d="M22 37 L33 40" stroke="var(--app-text)" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M58 37 L47 40" stroke="var(--app-text)" strokeWidth="2.6" strokeLinecap="round" />
          <motion.path
            d="M57 50 C55 54 55 57 57 58 C59 57 59 54 57 50 Z"
            fill="#7cc4f2"
            initial={{ y: -2, opacity: 0 }}
            animate={{ y: [0, 4, 0], opacity: 1 }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </>
      )}
      {/* Miệng */}
      {mood === 'cheer' ? (
        <path d="M31 55 Q40 68 49 55 Z" fill="var(--app-text)" />
      ) : mood === 'happy' ? (
        <path d="M32 56 Q40 64 48 56" stroke="var(--app-text)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      ) : sad ? (
        <path d="M33 61 Q40 55 47 61" stroke="var(--app-text)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M34 59 L46 59" stroke="var(--app-text)" strokeWidth="3.2" strokeLinecap="round" />
      )}
    </motion.svg>
  )
}
