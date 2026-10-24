import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GUIDE, GUIDE_GROUPS, guideText, searchGuide, uiLabels } from './guide'

/** Nội dung hướng dẫn (R14.3) phải khớp với app: tên nút/mục trong “…” phải có thật trên màn hình. */

const SRC = fileURLToPath(new URL('..', import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/[\\/]data[\\/]guide\.ts$/.test(path) ? [path] : []
  })
}

describe('hướng dẫn sử dụng', () => {
  it('mỗi mục có mặt đúng một lần trong danh sách nhóm', () => {
    const ids = GUIDE.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(GUIDE_GROUPS.flatMap((g) => g.topics).sort()).toEqual([...ids].sort())
    for (const t of GUIDE) expect(t.blocks.length, t.id).toBeGreaterThan(0)
  })

  it('tên nút/mục được nhắc tới đều có trong giao diện', () => {
    const code = sources(SRC)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    const missing = GUIDE.flatMap((t) => uiLabels(t).filter((label) => !code.includes(label)).map((label) => `${t.id}: “${label}”`))
    expect(missing).toEqual([])
  })

  it('tìm không cần gõ dấu', () => {
    expect(searchGuide('cap ghi nho')[0]?.id).toBe('levels')
    expect(searchGuide('ĐỒNG BỘ').map((t) => t.id)).toContain('sync')
    expect(searchGuide('xyz không có')).toEqual([])
    // Có mục chứa nguyên cụm thì không kéo theo mục chỉ chứa lẻ từng chữ.
    expect(searchGuide('tạm thời không nghe được').map((t) => t.id)).toEqual(['review'])
  })

  it('không còn chữ nháp', () => {
    for (const t of GUIDE) expect(guideText(t), t.id).not.toMatch(/TODO|\?\?|lorem/i)
  })
})
