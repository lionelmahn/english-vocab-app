/** Ảnh đại diện (R1.4); chưa có ảnh thì hiện chữ cái đầu của tên. */
export function Avatar({ src, name, size = 56 }: { src?: string; name: string; size?: number }) {
  const initial = (name.trim().charAt(0) || 'B').toUpperCase()
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initial}
    </div>
  )
}
