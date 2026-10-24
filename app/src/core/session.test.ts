import { describe, expect, it } from 'vitest'
import { Rating } from 'ts-fsrs'
import { buildMeaningChoices, buildTermChoices, chooseExercise, seededRandom } from './exercises'
import { addActiveTime, applyAction, currentStep, isFinished, planLearn, planReview, RETRY_GAP, summarize, type SessionAction, type SessionPlan } from './session'

const right = (exercise: 'mcq_meaning' | 'recall_typing' | 'dictation' = 'mcq_meaning'): SessionAction => ({
  type: 'answer',
  result: { kind: 'answer', exercise, correct: true },
})
const wrong = (exercise: 'mcq_meaning' | 'recall_typing' | 'dictation' = 'mcq_meaning'): SessionAction => ({
  type: 'answer',
  result: { kind: 'answer', exercise, correct: false },
})

function run(plan: SessionPlan, actions: SessionAction[]) {
  const effects = []
  for (const a of actions) {
    const r = applyAction(plan, a)
    plan = r.plan
    effects.push(r.effect)
  }
  return { plan, effects }
}

describe('planLearn — lật thẻ rồi kiểm tra ngay từ đó', () => {
  it('xen kẽ: thẻ A, kiểm tra A, thẻ B, kiểm tra B…', () => {
    const plan = planLearn(['a', 'b', 'c'], () => 'recall_typing', 0)
    expect(plan.steps.map((s) => `${s.kind[0]}:${s.itemId}`)).toEqual(['i:a', 'e:a', 'i:b', 'e:b', 'i:c', 'e:c'])
  })
})

describe('applyAction', () => {
  it('lần trả lời đầu tiên tính lịch; sai thì xếp luyện lại sau vài bước, luyện lại không tính lịch', () => {
    const plan = planReview(['a', 'b', 'c', 'd', 'e'], () => 'recall_typing', 0)
    const r1 = applyAction(plan, wrong('recall_typing'))
    expect(r1.effect).toMatchObject({ log: true, grade: Rating.Again, correct: false, schedule: true, requeued: true })
    expect(r1.plan.steps[1 + RETRY_GAP]).toEqual({ itemId: 'a', kind: 'retry', exercise: 'recall_typing' })

    // b, c, d (3 bước) rồi mới tới lượt luyện lại "a", sau đó là "e".
    const { plan: p2, effects } = run(r1.plan, [right('recall_typing'), right('recall_typing'), right('recall_typing')])
    expect(effects.every((e) => e.schedule)).toBe(true)
    expect(currentStep(p2)).toEqual({ itemId: 'a', kind: 'retry', exercise: 'recall_typing' })
    const r3 = run(p2, [right('recall_typing'), right('recall_typing')])
    expect(r3.effects[0]).toMatchObject({ schedule: false, correct: true })
    expect(r3.effects[1]).toMatchObject({ schedule: true })
    expect(isFinished(r3.plan)).toBe(true)
    expect(r3.plan.outcomes.a.grade).toBe(Rating.Again) // giữ kết quả sai ban đầu
  })

  it('luyện lại tối đa 2 lần cho một từ', () => {
    let plan = planReview(['a'], () => 'recall_typing', 0)
    ;({ plan } = run(plan, [wrong(), wrong(), wrong()]))
    expect(plan.outcomes.a).toMatchObject({ wrong: 3, retries: 2 })
    expect(isFinished(plan)).toBe(true)
  })

  it('"Mình không thuộc từ này" là quên và xếp luyện lại (R5.10)', () => {
    const plan = planReview(['a', 'b'], () => 'mcq_meaning', 0)
    const r = applyAction(plan, { type: 'answer', result: { kind: 'dont_know' } })
    expect(r.effect).toMatchObject({ grade: Rating.Again, schedule: true, requeued: true })
  })

  it('không tiện nghe: đổi bài nghe thành gõ từ, không chấm, không ghi (R6.12)', () => {
    const plan = planReview(['a', 'b', 'c'], (id) => (id === 'b' ? 'mcq_meaning' : 'dictation'), 0)
    const r = applyAction(plan, { type: 'answer', result: { kind: 'cannot_listen' } })
    expect(r.effect.log).toBe(false)
    expect(r.plan.cursor).toBe(0)
    expect(r.plan.steps.map((s) => s.exercise)).toEqual(['recall_typing', 'mcq_meaning', 'recall_typing'])
    expect(r.plan.audioOff).toBe(true)
  })

  it('học mới: "đã biết" + kiểm tra nhanh đúng → lên lịch Dễ và bỏ bài kiểm tra sau (R4.8)', () => {
    const plan = planLearn(['a', 'b'], () => 'mcq_meaning', 0)
    const r1 = applyAction(plan, { type: 'intro_known' })
    expect(currentStep(r1.plan)).toEqual({ itemId: 'a', kind: 'known_check', exercise: 'recall_typing' })
    const r2 = applyAction(r1.plan, right('recall_typing'))
    expect(r2.effect).toMatchObject({ grade: Rating.Easy, schedule: true })
    expect(r2.plan.steps.filter((s) => s.itemId === 'a').map((s) => s.kind)).toEqual(['intro', 'known_check'])
    expect(r2.plan.outcomes.a.known).toBe(true)
  })

  it('học mới: "đã biết" nhưng kiểm tra sai → không tính quên, học tiếp bình thường', () => {
    const plan = planLearn(['a'], () => 'mcq_meaning', 0)
    const r = run(plan, [{ type: 'intro_known' }, wrong('recall_typing')])
    expect(r.effects[1]).toMatchObject({ log: true, grade: null, schedule: false })
    expect(currentStep(r.plan)).toEqual({ itemId: 'a', kind: 'exercise', exercise: 'mcq_meaning' })
  })

  it('luyện tự do không đổi lịch (R5.7)', () => {
    const plan = planReview(['a'], () => 'mcq_meaning', 0, 'practice')
    expect(applyAction(plan, right()).effect).toMatchObject({ log: true, schedule: false })
  })

  it('summarize', () => {
    let plan = planReview(['a', 'b', 'c'], () => 'mcq_meaning', 1000)
    ;({ plan } = run(plan, [right(), wrong(), { type: 'answer', result: { kind: 'self_rating', rating: 'hard' } }]))
    const s = summarize(plan, 61_000)
    expect(s).toMatchObject({ items: 3, correct: 2, wrong: 1, durationMs: 60_000 })
    expect(s.needWork.sort()).toEqual(['b', 'c'])
  })
})

describe('exercises', () => {
  const opts = { audioOff: false, canMultipleChoice: true, style: 'exercises' as const }

  it('từ mới dùng trắc nghiệm, từ nhớ tốt dùng nhớ lại', () => {
    expect(chooseExercise(1, 0, opts)).toBe('mcq_meaning')
    expect(chooseExercise(4, 0, opts)).toBe('recall_typing')
    expect(chooseExercise(4, 1, opts)).toBe('dictation')
  })

  it('tắt âm thanh hoặc thiếu phương án thì đổi dạng bài', () => {
    expect(chooseExercise(4, 1, { ...opts, audioOff: true })).toBe('recall_typing')
    expect(chooseExercise(1, 0, { ...opts, canMultipleChoice: false })).toBe('recall_typing')
    expect(chooseExercise(3, 7, { ...opts, style: 'flashcard' })).toBe('flashcard')
  })

  it('trắc nghiệm: 4 phương án khác nghĩa, ưu tiên cùng loại từ', () => {
    const t = { id: 't', meaningVi: 'kiên cường', partOfSpeech: 'adjective' as const }
    const pool = [
      t,
      { id: '1', meaningVi: 'tỉ mỉ', partOfSpeech: 'adjective' as const },
      { id: '2', meaningVi: 'Kiên cường.', partOfSpeech: 'adjective' as const },
      { id: '3', meaningVi: 'phổ biến', partOfSpeech: 'adjective' as const },
      { id: '4', meaningVi: 'chạy', partOfSpeech: 'verb' as const },
      { id: '5', meaningVi: 'nỗ lực', partOfSpeech: 'noun' as const },
    ]
    const choices = buildMeaningChoices(t, pool, seededRandom(42))!
    expect(choices).toHaveLength(4)
    expect(choices.map((c) => c.id)).toContain('t')
    expect(choices.map((c) => c.id)).not.toContain('2')
    expect(choices.filter((c) => c.partOfSpeech === 'adjective')).toHaveLength(3)
  })

  it('luân phiên có cả bài nghe chọn nghĩa và chọn âm thanh', () => {
    expect(chooseExercise(1, 1, opts)).toBe('listen_choose')
    expect(chooseExercise(2, 1, opts)).toBe('audio_choice')
    expect(chooseExercise(1, 1, { ...opts, audioOff: true })).toBe('mcq_meaning')
    expect(chooseExercise(2, 1, { ...opts, audioOff: true })).toBe('recall_typing')
    expect(chooseExercise(2, 1, { ...opts, canMultipleChoice: false })).toBe('recall_typing')
  })

  it('không tiện nghe: nghe chọn nghĩa đổi thành trắc nghiệm nghĩa', () => {
    const plan = planReview(['a', 'b'], (id) => (id === 'a' ? 'listen_choose' : 'audio_choice'), 0)
    const r = applyAction(plan, { type: 'no_audio' })
    expect(r.plan.steps.map((s) => s.exercise)).toEqual(['mcq_meaning', 'recall_typing'])
  })

  it('phương án âm thanh: khác mặt chữ, ưu tiên cùng loại từ', () => {
    const t = { id: 't', term: 'learn by heart', meaningVi: 'học thuộc lòng', partOfSpeech: 'phrase' as const }
    const pool = [
      t,
      { id: '1', term: 'Learn by heart', meaningVi: 'x', partOfSpeech: 'phrase' as const },
      { id: '2', term: 'give up', meaningVi: 'từ bỏ', partOfSpeech: 'phrase' as const },
      { id: '3', term: 'truant', meaningVi: 'trốn học', partOfSpeech: 'verb' as const },
      { id: '4', term: 'exam', meaningVi: 'kỳ thi', partOfSpeech: 'noun' as const },
    ]
    const c = buildTermChoices(t, pool, seededRandom(7))!
    expect(c).toHaveLength(3)
    expect(c.map((x) => x.id)).toContain('t')
    expect(c.map((x) => x.id)).toContain('2')
    expect(c.map((x) => x.id)).not.toContain('1')
    expect(buildTermChoices(t, [t, pool[1]])).toBeNull()
  })

  it('không đủ nghĩa thì không làm trắc nghiệm', () => {
    const t = { id: 't', meaningVi: 'a', partOfSpeech: 'noun' as const }
    expect(buildMeaningChoices(t, [t, { id: '1', meaningVi: 'b', partOfSpeech: 'noun' as const }])).toBeNull()
  })
})

describe('thời gian học thực tế', () => {
  it('mỗi bước tính tối đa 2 phút, tổng kết dùng thời gian thực tế', () => {
    let plan = planReview(['a'], () => 'mcq_meaning', 0)
    plan = addActiveTime(plan, 5_000)
    plan = addActiveTime(plan, 10 * 60_000)
    expect(plan.activeMs).toBe(125_000)
    expect(summarize(plan, 12 * 3_600_000).durationMs).toBe(125_000)
  })
})
