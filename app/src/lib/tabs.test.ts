import { describe, expect, it } from 'vitest'
import { TABS, tabIndexOf } from './tabs'

describe('tab đang chọn theo đường dẫn', () => {
  it('trang con thuộc đúng tab', () => {
    const tab = (path: string) => TABS[tabIndexOf(path)].label
    expect(tab('/')).toBe('Hôm nay')
    expect(tab('/practice')).toBe('Hôm nay')
    expect(tab('/words/abc')).toBe('Sổ tay')
    expect(tab('/stats')).toBe('Thống kê')
    expect(tab('/test')).toBe('Thống kê')
    expect(tab('/history/abc')).toBe('Thống kê')
    expect(tab('/insights')).toBe('Thống kê')
    expect(tab('/achievements')).toBe('Thống kê')
    expect(tab('/me/memory')).toBe('Cá nhân')
  })
})
