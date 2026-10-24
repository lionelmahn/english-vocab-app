/**
 * Gộp hai phiên bản của cùng một bản ghi khi đồng bộ nhiều thiết bị (R11.7, kế hoạch mục 3.5).
 *
 * Gộp ba chiều theo từng trường, so với "bản gốc" là bản đã đồng bộ lần trước:
 * trường chỉ đổi ở một phía thì lấy phía đó; đổi ở cả hai phía thì bản sửa mới hơn (`updatedAt`) thắng.
 * Nhờ vậy sửa nghĩa trên máy tính và đánh dấu yêu thích trên điện thoại đều được giữ.
 */

export interface Versioned {
  id: string
  updatedAt: number
}

/** So sánh giá trị theo nội dung; thiếu trường và `undefined` coi như nhau. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined || a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return Number.isNaN(a) && Number.isNaN(b)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((v, i) => sameValue(v, bb[i]))
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)])
  for (const k of keys) if (!sameValue(ao[k], bo[k])) return false
  return true
}

/** So sánh hai bản ghi, bỏ qua `updatedAt` (chỉ là dấu thời gian, không phải nội dung). */
export function sameContent(a: object, b: object): boolean {
  return sameValue({ ...a, updatedAt: undefined }, { ...b, updatedAt: undefined })
}

/** Thứ tự cố định khi hai bản sửa cùng thời điểm, để mọi thiết bị chọn giống nhau. */
function stableKey(v: unknown): string {
  return JSON.stringify(v) ?? ''
}

export interface MergeResult<T> {
  row: T
  /** Tên trường (hoặc nhóm trường) bị sửa ở cả hai phía. */
  conflicts: string[]
}

/**
 * Gộp bản trên thiết bị (`local`) với bản từ máy chủ (`remote`).
 * `base` là bản đã đồng bộ lần trước; không có thì mọi khác biệt được xem là sửa ở cả hai phía.
 * `groups` gom các trường phải đi cùng nhau (ví dụ các số của lịch ôn FSRS) thành một đơn vị.
 */
export function mergeRows<T extends Versioned>(local: T, remote: T, base: T | undefined, groups: Record<string, readonly (keyof T)[]> = {}): MergeResult<T> {
  const l = local as Record<string, unknown>
  const r = remote as Record<string, unknown>
  const b = base as Record<string, unknown> | undefined
  const remoteNewer = remote.updatedAt > local.updatedAt
  const tie = remote.updatedAt === local.updatedAt

  const grouped = new Set<string>(Object.values(groups).flat() as string[])
  const units: [string, string[]][] = Object.entries(groups).map(([name, fields]) => [name, fields as string[]])
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    if (k !== 'id' && k !== 'updatedAt' && !grouped.has(k)) units.push([k, [k]])
  }

  const out: Record<string, unknown> = { ...l }
  const conflicts: string[] = []
  const pick = (fields: string[], from: Record<string, unknown>) => {
    for (const f of fields) out[f] = from[f]
  }
  for (const [name, fields] of units) {
    const lv = fields.map((f) => l[f])
    const rv = fields.map((f) => r[f])
    if (sameValue(lv, rv)) continue
    if (b && sameValue(lv, fields.map((f) => b[f]))) {
      pick(fields, r)
      continue
    }
    if (b && sameValue(rv, fields.map((f) => b[f]))) continue
    conflicts.push(name)
    if (remoteNewer || (tie && stableKey(rv) > stableKey(lv))) pick(fields, r)
  }
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt)
  return { row: out as T, conflicts }
}
