import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AI_DEFAULTS, cefrOf, defaultTopic, examplesPrompt, extractJson, sanitizeAi, toExamples, toMnemonics, toSenseMeanings, toWordInfo, usageSummary, usesTerm, type AiSettings, type AiUsageRow } from '../core/ai'
import { VocabDatabase } from '../db/db'
import { AiError, askAI, askJson, type AiDeps } from './ai'

const opened: VocabDatabase[] = []
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

const T0 = Date.parse('2026-10-26T08:00:00Z')

function setup({ reply, ai, ...over }: Partial<AiDeps> & { reply?: () => Response; ai?: Partial<AiSettings> } = {}) {
  const database = new VocabDatabase(`ai-${crypto.randomUUID()}`)
  opened.push(database)
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = []
  let clock = T0
  const deps: Partial<AiDeps> = {
    database,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') })
      return reply ? reply() : new Response(JSON.stringify({ text: '{"term":"issue","senses":[{"pos":"noun","meaning_vi":"vấn đề","example_en":"A big issue.","example_vi":"Một vấn đề lớn."}],"mnemonic_vi":"ít sự"}', usage: { inputTokens: 300, outputTokens: 200, neurons: 42.5 } }))
    }) as unknown as typeof fetch,
    token: async () => 'tok',
    settings: async () => ({ ...AI_DEFAULTS, ...ai }),
    online: () => true,
    now: () => (clock += 10),
    ...over,
  }
  return { database, deps, calls }
}

const ASK = { task: 'word_info', system: 'S', prompt: 'issue' }

describe('gọi trợ lý AI', () => {
  it('gửi đúng model và phiên đăng nhập; lần hỏi lại cùng câu thì lấy kết quả đã lưu, không gọi AI', async () => {
    const { deps, calls, database } = setup()
    const first = await askAI(ASK, deps)
    expect(first).toMatchObject({ cached: false, neurons: 42.5 })
    expect(calls[0]).toMatchObject({ url: '/api/ai', auth: 'Bearer tok', body: { model: AI_DEFAULTS.model, system: 'S', prompt: 'issue' } })
    const again = await askAI(ASK, deps)
    expect(again.cached).toBe(true)
    expect(calls).toHaveLength(1)
    const rows = await database.aiUsage.orderBy('at').toArray()
    expect(rows.map((r) => [r.cached, r.neurons])).toEqual([
      [false, 42.5],
      [true, 0],
    ])
  })

  it('đọc JSON theo khuôn; JSON hỏng thì báo lỗi và không giữ lại câu trả lời hỏng', async () => {
    const ok = setup()
    const res = await askJson(ASK, (raw) => toWordInfo(raw, 'issue'), ok.deps)
    expect(res.data.senses[0]).toEqual({ pos: 'noun', meaningVi: 'vấn đề', exampleEn: 'A big issue.', exampleVi: 'Một vấn đề lớn.' })
    const bad = setup({ reply: () => new Response(JSON.stringify({ text: 'xin lỗi, tôi không biết', usage: {} })) })
    await expect(askJson(ASK, (raw) => toWordInfo(raw, 'issue'), bad.deps)).rejects.toMatchObject({ code: 'bad_output' })
    expect(await bad.database.aiCache.count()).toBe(0)
  })

  it('tắt, chưa đăng nhập, mất mạng, quá giới hạn ngày, hết hạn mức miễn phí, máy chủ lỗi', async () => {
    const code = async (s: ReturnType<typeof setup>) => askAI(ASK, s.deps).then(() => 'ok', (e: AiError) => e.code)
    expect(await code(setup({ ai: { enabled: false } }))).toBe('disabled')
    expect(await code(setup({ token: async () => null }))).toBe('signed_out')
    expect(await code(setup({ online: () => false }))).toBe('offline')
    expect(await code(setup({ reply: () => new Response('{}', { status: 429 }) }))).toBe('quota')
    expect(await code(setup({ reply: () => new Response('{}', { status: 401 }) }))).toBe('signed_out')
    expect(await code(setup({ reply: () => new Response('{}', { status: 502 }) }))).toBe('unavailable')
    const limited = setup({ ai: { dailyLimit: 2 } })
    await askAI({ ...ASK, prompt: 'a' }, limited.deps)
    await askAI({ ...ASK, prompt: 'b' }, limited.deps)
    expect(await askAI({ ...ASK, prompt: 'c' }, limited.deps).then(() => 'ok', (e: AiError) => e.code)).toBe('limit')
    // Lượt lấy lại kết quả đã lưu vẫn được, kể cả khi đã đến giới hạn.
    expect((await askAI({ ...ASK, prompt: 'a' }, limited.deps)).cached).toBe(true)
  })
})

describe('phần thuần của trợ lý AI', () => {
  it('đọc JSON lẫn chữ thừa, chuẩn hóa nghĩa và loại từ, bỏ nghĩa thiếu', () => {
    expect(extractJson('Đây là kết quả:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(extractJson('<think>{"x":0}</think>{"a":2}')).toEqual({ a: 2 })
    expect(extractJson('không có')).toBeNull()
    const info = toWordInfo({ senses: [{ pos: 'Idiom', meaning_vi: '  rất   vui ' }, { pos: 'verb' }, { pos: 'preposition', meaning_vi: 'trên', example_en: 'on it', example_vi: 'trên đó' }] }, 'over the moon')
    expect(info).toEqual({
      term: 'over the moon',
      senses: [
        { pos: 'idiom', meaningVi: 'rất vui', exampleEn: '', exampleVi: '' },
        { pos: 'preposition', meaningVi: 'trên', exampleEn: 'on it', exampleVi: 'trên đó' },
      ],
      mnemonicVi: '',
    })
    expect(toWordInfo({ senses: [] }, 'x')).toBeNull()
  })

  it('cài đặt: giữ giá trị hợp lệ, model lạ thì về mặc định', () => {
    expect(sanitizeAi({ enabled: false, model: 'llama-3.3-70b', dailyLimit: 30.4 })).toEqual({ enabled: false, model: 'llama-3.3-70b', dailyLimit: 30 })
    expect(sanitizeAi({ model: 'gpt-9', dailyLimit: -5 })).toEqual({ ...AI_DEFAULTS, dailyLimit: 1 })
    expect(sanitizeAi(null)).toEqual(AI_DEFAULTS)
  })

  it('lượt dùng hôm nay tính theo ngày UTC (hạn mức miễn phí đặt lại lúc 7:00 sáng giờ Việt Nam)', () => {
    const now = Date.parse('2026-10-26T06:00:00Z') // 13:00 giờ Việt Nam
    const row = (at: string, extra: Partial<AiUsageRow> = {}): AiUsageRow => ({ id: at, at: Date.parse(at), task: 't', model: 'm', inputTokens: 0, outputTokens: 0, neurons: 10, cached: false, ...extra })
    const s = usageSummary(
      [
        row('2026-10-26T00:30:00Z'), // 7:30 sáng hôm nay giờ VN
        row('2026-10-25T23:30:00Z'), // 6:30 sáng hôm nay giờ VN, nhưng là hôm qua theo UTC
        row('2026-10-26T01:00:00Z', { cached: true }),
        row('2026-10-26T02:00:00Z', { error: 'quota' }),
        row('2026-09-01T00:00:00Z'),
      ],
      now,
    )
    expect(s).toEqual({ todayRequests: 1, todayNeurons: 10, monthRequests: 2, monthNeurons: 20, monthCached: 1, monthErrors: 1 })
  })
})

describe('kiểm kết quả AI cho nghĩa, mẹo nhớ, câu ví dụ (R8.1, R8.3, R8.4)', () => {
  it('nghĩa tiếng Việt theo đúng số thứ tự; thiếu thì để trống; không có nghĩa nào thì null', () => {
    expect(
      toSenseMeanings({ senses: [{ n: 2, meaning_vi: 'số báo', example_vi: '' }, { n: 1, meaning_vi: 'vấn đề', example_vi: 'Đây là vấn đề lớn.' }] }, 3),
    ).toEqual([
      { meaningVi: 'vấn đề', exampleVi: 'Đây là vấn đề lớn.' },
      { meaningVi: 'số báo', exampleVi: '' },
      { meaningVi: '', exampleVi: '' },
    ])
    // Không có n thì theo thứ tự.
    expect(toSenseMeanings({ senses: [{ meaning_vi: 'a' }, { meaning_vi: 'b' }] }, 2)?.map((m) => m.meaningVi)).toEqual(['a', 'b'])
    expect(toSenseMeanings({ senses: [{ n: 1, meaning_vi: '' }] }, 1)).toBeNull()
    expect(toSenseMeanings('x', 1)).toBeNull()
  })

  it('mẹo nhớ: bỏ mẹo rỗng hoặc "None", đoán kiểu khi model ghi sai', () => {
    expect(toMnemonics({ mnemonics: [{ type: 'sound', text: ' Lây dì lười ' }, { type: 'image', text: 'None' }, { type: 'xyz', text: 'Tách: la + zy' }] })).toEqual([
      { kind: 'sound', text: 'Lây dì lười' },
      { kind: 'image', text: 'Tách: la + zy' },
    ])
    expect(toMnemonics({ mnemonics: [] })).toBeNull()
  })

  it('câu ví dụ phải dùng từ (kể cả dạng biến đổi) và đủ dài', () => {
    expect(usesTerm('She issued a statement.', 'issue')).toBe(true)
    expect(usesTerm('The plane took off at noon.', 'take off')).toBe(true)
    expect(usesTerm('The weather is nice.', 'resilient')).toBe(false)
    expect(usesTerm('I am here.', 'be')).toBe(true)
    expect(
      toExamples({ examples: [{ en: 'Children are resilient.', vi: 'Trẻ em kiên cường.' }, { en: 'Hi there.', vi: 'Chào' }, { en: 'The weather is very nice today.', vi: 'Trời đẹp.' }] }, 'resilient'),
    ).toEqual([{ en: 'Children are resilient.', vi: 'Trẻ em kiên cường.' }])
    expect(toExamples({ examples: [{ en: 'Nope.', vi: '' }] }, 'resilient')).toBeNull()
  })

  it('trình độ và chủ đề mặc định theo hồ sơ; lần soạn lại xin câu khác', () => {
    expect(cefrOf('upper_intermediate')).toBe('B2')
    expect(cefrOf(undefined)).toBe('B1')
    expect(defaultTopic('Công việc, Du lịch')).toBe('Công việc')
    expect(defaultTopic('Thi IELTS/TOEIC')).toBe('Học tập, thi cử')
    expect(defaultTopic(undefined)).toBe('Đời sống hằng ngày')
    const p = examplesPrompt({ term: 'issue', partOfSpeech: 'noun', meaningVi: 'vấn đề', level: 'A2', topic: 'Du lịch', attempt: 2 })
    expect(p).toContain('Trình độ người học: A2')
    expect(p).toContain('lần 2')
    expect(examplesPrompt({ term: 'issue', partOfSpeech: 'noun', meaningVi: 'vấn đề', level: 'A2', topic: 'Du lịch' })).not.toContain('lần')
  })
})
