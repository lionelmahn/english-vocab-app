import { parseConfusables, parseLevelExamples, parseWordReference, type ConfusableGroup, type LevelExample, type WordReference } from '../../core/reference'

/**
 * Nội dung soạn sẵn cho bộ 1.000 từ khởi đầu (xem core/reference.ts). Mỗi file là một gói riêng, chỉ tải khi cần
 * (lần đầu mở trang của một từ, bảng câu ví dụ, trang Từ dễ nhầm). Tải hỏng (mất mạng) thì lần sau tải lại.
 */

export const REFERENCE_ATTRIBUTION = 'Kết hợp từ, mẹo nhớ, câu ví dụ theo trình độ và nhóm từ dễ nhầm do app soạn, giấy phép CC BY-SA 4.0 như bộ từ khởi đầu.'

function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined
  return () =>
    (p ??= load().catch((e: unknown) => {
      p = undefined
      throw e
    }))
}

export const loadWordReference: () => Promise<Map<string, WordReference>> = lazy(async () => parseWordReference((await import('./words.txt?raw')).default))
export const loadLevelExamples: () => Promise<Map<string, LevelExample[]>> = lazy(async () => parseLevelExamples((await import('./levels.txt?raw')).default))
export const loadConfusables: () => Promise<ConfusableGroup[]> = lazy(async () => parseConfusables((await import('./confusables.txt?raw')).default))
