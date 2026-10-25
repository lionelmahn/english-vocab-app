import { useLiveQuery } from 'dexie-react-hooks'
import { default_w } from 'ts-fsrs'
import { buildSequences, dataStats, optimizeFsrs, recallRates, type DataStats, type OptimizeResult, type ReviewSequence } from '../core/fsrsOptimizer'
import { db } from '../db/db'
import { repo } from '../db/repo'
import { PROFILE_ID } from '../db/types'
import { sanitizeFsrs, type FsrsSettings } from '../core/profile'

/** Mục tiêu ghi nhớ và tối ưu tham số lịch ôn (R5.13): đọc lịch sử ôn trên máy, lưu kết quả vào hồ sơ (đồng bộ). */

async function loadSequences(): Promise<ReviewSequence[]> {
  const [logs, cards] = await Promise.all([db.reviewLogs.toArray(), db.cardStates.toArray()])
  const since = new Map(cards.filter((c) => c.deletedAt === null).map((c) => [c.itemId, c.createdAt]))
  return buildSequences(logs, since)
}

export interface MemoryData {
  stats: DataStats
  /** Tỷ lệ nhớ thật và dự đoán (theo tham số đang dùng) ở các lượt ôn cách lần trước từ 1 ngày. */
  rates: { actual: number; predicted: number; count: number } | null
}

export function useMemoryData(): MemoryData | undefined {
  return useLiveQuery(async () => {
    const [seqs, fsrs] = await Promise.all([loadSequences(), currentFsrs()])
    return { stats: dataStats(seqs), rates: recallRates(fsrs.weights ?? default_w, seqs) }
  }, [])
}

async function currentFsrs(): Promise<FsrsSettings> {
  return sanitizeFsrs((await db.profiles.get(PROFILE_ID))?.fsrs)
}

export async function setRetention(retention: number): Promise<void> {
  await repo.updateProfile({ fsrs: { ...(await currentFsrs()), retention } })
}

/**
 * Tối ưu tham số từ lịch sử ôn. Tham số mới chỉ được lưu (và dùng trên mọi máy) khi dự đoán tốt hơn mặc định.
 * Trả về null nếu chưa đủ dữ liệu.
 */
export async function runOptimization(onProgress?: (done: number) => void): Promise<OptimizeResult | null> {
  const res = await optimizeFsrs(await loadSequences(), { onProgress, yieldEvery: () => new Promise((r) => setTimeout(r, 0)) })
  if (res?.better) {
    await repo.updateProfile({
      fsrs: { ...(await currentFsrs()), weights: res.weights, optimizedAt: Date.now(), optimizedReviews: res.reviews, improvement: res.improvement },
    })
  }
  return res
}

export async function resetToDefaultWeights(): Promise<void> {
  await repo.updateProfile({ fsrs: { ...(await currentFsrs()), weights: null, optimizedAt: null, optimizedReviews: 0, improvement: null } })
}
