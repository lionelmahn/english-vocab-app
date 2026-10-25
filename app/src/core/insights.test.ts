import { describe, expect, it } from 'vitest'
import type { ExerciseKind, SessionMode } from './grading'
import { exerciseStats, firstAttempts, progressDelta, troubleWords, weakExercises, weeklyAccuracy, type InsightLog } from './insights'
import { badgeStates, milestones, sumXp, XP_RULES, xpOf, xpTotals, type XpLog } from './achievements'

const TZ = 'Asia/Ho_Chi_Minh'
const DAY = 86_400_000
// 10:00 sáng thứ Hai 19/10/2026 giờ Việt Nam.
const T0 = Date.parse('2026-10-19T03:00:00Z')

let seq = 0
function log(itemId: string, at: number, correct: boolean | null, extra: Partial<XpLog> = {}): XpLog {
  return { itemId, sessionId: extra.sessionId ?? `s${Math.floor(at / DAY)}`, reviewedAt: at + seq++, mode: 'review' as SessionMode, exercise: 'recall_typing' as ExerciseKind, correct, hintLevel: 0, affectsSchedule: true, ...extra }
}

describe('điểm yếu (R10.3)', () => {
  it('chỉ tính lượt đầu của mỗi từ trong mỗi buổi', () => {
    const logs = [log('a', T0, false, { sessionId: 'x' }), log('a', T0 + 60_000, true, { sessionId: 'x' }), log('a', T0 + DAY, true, { sessionId: 'y' }), log('b', T0, null, { sessionId: 'x' })]
    expect(firstAttempts(logs).map((l) => [l.itemId, l.sessionId, l.correct])).toEqual([
      ['a', 'x', false],
      ['a', 'y', true],
    ])
  })

  it('từ hay sai: sai từ 2 lần và chiếm 1/4, hoặc sai một nửa số lần; bỏ lượt trước mốc thời gian', () => {
    const logs: InsightLog[] = [
      // a: sai 3/4
      log('a', T0, false),
      log('a', T0 + DAY, false),
      log('a', T0 + 2 * DAY, true),
      log('a', T0 + 3 * DAY, false),
      // b: sai 1/2
      log('b', T0, true),
      log('b', T0 + DAY, false),
      // c: sai 1/3 — không tính
      log('c', T0, false),
      log('c', T0 + DAY, true),
      log('c', T0 + 2 * DAY, true),
      // d: sai trước mốc
      log('d', T0 - 10 * DAY, false),
      log('d', T0 - 9 * DAY, false),
      // e: sai 2/9 — dưới 1/4, không tính
      ...Array.from({ length: 9 }, (_, i) => log('e', T0 + i * DAY, i >= 2)),
    ]
    expect(troubleWords(logs, T0 - DAY).map((w) => [w.itemId, w.wrong, w.total])).toEqual([
      ['a', 3, 4],
      ['b', 1, 2],
    ])
    expect(troubleWords(logs, T0 - DAY, 1)).toHaveLength(1)
  })

  it('dạng bài còn yếu: đủ lượt và dưới 70% hoặc thấp hơn tỷ lệ chung 10 điểm', () => {
    const logs: InsightLog[] = []
    const add = (exercise: ExerciseKind, right: number, wrong: number) => {
      for (let i = 0; i < right + wrong; i++) logs.push(log(`${exercise}${i}`, T0 + i * 1000, i < right, { exercise }))
    }
    add('mcq_meaning', 19, 1) // 95%
    add('recall_typing', 13, 7) // 65% → yếu
    add('dictation', 2, 2) // ít lượt
    const stats = exerciseStats(logs, 0)
    expect(stats.map((s) => s.exercise)).toEqual(['dictation', 'recall_typing', 'mcq_meaning'])
    expect(weakExercises(stats).map((s) => s.exercise)).toEqual(['recall_typing'])
  })

  it('tỷ lệ đúng theo tuần và mức tiến bộ', () => {
    const today = '2026-10-25'
    const logs = [
      log('a', T0 - 21 * DAY, false),
      log('b', T0 - 21 * DAY, true),
      log('a', T0, true),
      log('b', T0, true),
      log('c', T0, false),
    ]
    const weeks = weeklyAccuracy(logs, today, TZ, 4)
    expect(weeks.map((w) => w.week)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'])
    expect(weeks.map((w) => w.accuracy)).toEqual([0.5, null, null, 2 / 3])
    const p = progressDelta(weeks)
    expect(p.before).toBe(0.5)
    expect(p.change).toBeCloseTo(2 / 3 - 0.5, 6)
    expect(progressDelta(weeklyAccuracy([], today, TZ, 4)).change).toBeNull()
  })
})

describe('điểm kinh nghiệm và huy hiệu (R10.6)', () => {
  it('cộng điểm theo kết quả, gợi ý và từ mới', () => {
    expect(xpOf(log('a', T0, true))).toBe(XP_RULES.correct)
    expect(xpOf(log('a', T0, true, { hintLevel: 2 }))).toBe(XP_RULES.hinted)
    expect(xpOf(log('a', T0, false))).toBe(XP_RULES.wrong)
    expect(xpOf(log('a', T0, null))).toBe(0)
    expect(xpOf(log('a', T0, true, { mode: 'learn' }))).toBe(XP_RULES.correct + XP_RULES.newWord)
    expect(xpOf(log('a', T0, true, { mode: 'learn', affectsSchedule: false }))).toBe(XP_RULES.correct)
    const t = xpTotals([log('a', T0 - 2 * DAY, true), log('a', T0 - 8 * DAY, true), log('b', T0 + 3600_000, false)], T0 + 7200_000, TZ)
    expect(t).toEqual({ total: 22, today: 2, week: 2 })
  })

  it('huy hiệu theo mốc, kèm thời điểm đạt; chuỗi ngày dài nhất được giữ dù đã đứt', () => {
    const logs: XpLog[] = []
    // 8 ngày học liên tục, mỗi ngày 2 từ mới học đúng (mỗi ngày một buổi), rồi nghỉ, rồi học 1 ngày nữa.
    for (let d = 0; d < 8; d++) for (let k = 0; k < 2; k++) logs.push(log(`w${d}-${k}`, T0 + d * DAY + k * 1000, true, { mode: 'learn' }))
    logs.push(log('late', T0 + 20 * DAY, true))
    const states = badgeStates(logs, TZ)
    const get = (g: string) => states.find((s) => s.def.group === g)!
    expect(get('streak').value).toBe(8)
    expect(get('streak').tiers.map((t) => t.earnedAt !== null)).toEqual([true, true, false, false])
    expect(get('streak').tiers[1].earnedAt).toBe(logs[12].reviewedAt) // lượt đầu của ngày thứ 7
    expect(get('days').value).toBe(9)
    expect(get('words').value).toBe(16)
    expect(get('words').tiers[0].earnedAt).toBe(logs[9].reviewedAt) // từ thứ 10
    expect(get('answers').value).toBe(17)
    expect(get('perfect').value).toBe(0) // buổi chưa đủ 10 từ
    expect(get('xp').value).toBe(sumXp(logs))
    const ms = milestones(states)
    expect(ms[0].earnedAt).toBeGreaterThanOrEqual(ms[ms.length - 1].earnedAt)
    expect(ms.map((m) => m.text)).toContain('Học liên tục 7 ngày')
  })

  it('buổi hoàn hảo và bài kiểm tra xuất sắc', () => {
    const logs: XpLog[] = []
    for (let i = 0; i < 10; i++) logs.push(log(`p${i}`, T0 + i * 1000, true, { sessionId: 'perfect' }))
    // Luyện lại sau lượt đầu sai không cứu được buổi.
    for (let i = 0; i < 10; i++) logs.push(log(`q${i}`, T0 + DAY + i * 1000, i > 0, { sessionId: 'almost' }))
    logs.push(log('q0', T0 + DAY + 20_000, true, { sessionId: 'almost' }))
    for (let i = 0; i < 20; i++) logs.push(log(`t${i}`, T0 + 2 * DAY + i * 1000, i !== 0, { sessionId: 'test', mode: 'test', affectsSchedule: false }))
    const states = badgeStates(logs, TZ)
    expect(states.find((s) => s.def.group === 'perfect')!.value).toBe(1)
    expect(states.find((s) => s.def.group === 'test')!.value).toBe(1)
  })
})
