import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { loadLibrary, type Library } from '../db/library'

/** Toàn bộ sổ tay, tự cập nhật khi dữ liệu thay đổi. `undefined` khi đang tải. */
export function useLibrary(): Library | undefined {
  return useLiveQuery(() => loadLibrary(db), [])
}

/** Thời điểm hiện tại, cập nhật định kỳ (đếm ngược thời điểm ôn, R5.11). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
