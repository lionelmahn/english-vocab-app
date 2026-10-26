import { useEffect, useState } from 'react'
import { groupsWith, type ConfusableGroup, type LevelExample, type WordReference } from '../core/reference'
import { termKey } from '../core/vocab'
import { loadConfusables, loadLevelExamples, loadWordReference } from '../data/reference'

/** Đọc một gói nội dung soạn sẵn theo khóa: undefined khi đang tải (hoặc tải hỏng), giá trị khi xong. */
function useLoaded<T>(key: string | null, load: (() => Promise<T>) | null): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | null>(null)
  useEffect(() => {
    if (key === null || !load) return
    let cancelled = false
    load().then(
      (value) => !cancelled && setState({ key, value }),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [key, load])
  return state && state.key === key ? state.value : undefined
}

/** Kết hợp từ và mẹo nhớ soạn sẵn của từ: null nếu từ không có trong bộ soạn sẵn. */
export function useWordReference(term: string | undefined): WordReference | null | undefined {
  const key = term ? termKey(term) : null
  const map = useLoaded(key, key ? loadWordReference : null)
  return map && key ? (map.get(key) ?? null) : undefined
}

/** Câu ví dụ theo trình độ soạn sẵn (chỉ tải khi `enabled`). */
export function useLevelExamples(term: string | undefined, enabled: boolean): LevelExample[] | null | undefined {
  const key = term && enabled ? termKey(term) : null
  const map = useLoaded(key, key ? loadLevelExamples : null)
  return map && key ? (map.get(key) ?? null) : undefined
}

/** Mọi nhóm từ dễ nhầm (trang Từ dễ nhầm). */
export function useConfusables(): ConfusableGroup[] | undefined {
  return useLoaded('all', loadConfusables)
}

/** Các nhóm từ dễ nhầm có chứa từ này. */
export function useConfusablesOf(term: string | undefined): ConfusableGroup[] | undefined {
  const all = useLoaded(term ? 'all' : null, term ? loadConfusables : null)
  return all && term ? groupsWith(all, term) : undefined
}
