import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AI_DEFAULTS,
  cefrOf,
  CHAT_START,
  chatSummaryPrompt,
  contextPrompt,
  defaultTopic,
  examplesPrompt,
  practicePrompt,
  extractJson,
  sanitizeAi,
  toChatSummary,
  toChatTurn,
  toCollocations,
  toConfusables,
  toContextExplanation,
  toCorrection,
  toExamples,
  toMnemonics,
  toPracticeSentences,
  toSenseMeanings,
  toWordInfo,
  usageSummary,
  usesTerm,
  wordDiff,
  type AiSettings,
  type AiUsageRow,
} from '../core/ai'
import { VocabDatabase } from '../db/db'
import { AiError, askAI, askJson, peekJson, type AiDeps } from './ai'

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

  it('xem kết quả đã lưu mà không gọi AI, không tính lượt', async () => {
    const { deps, calls, database } = setup()
    const parse = (raw: unknown) => toWordInfo(raw, 'issue')
    expect(await peekJson(ASK, parse, deps)).toBeNull()
    await askJson(ASK, parse, deps)
    expect((await peekJson(ASK, parse, deps))?.senses[0].meaningVi).toBe('vấn đề')
    expect(await peekJson(ASK, parse, { ...deps, settings: async () => ({ ...AI_DEFAULTS, enabled: false }) })).toBeNull()
    expect(calls).toHaveLength(1)
    expect(await database.aiUsage.count()).toBe(1)
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

describe('kiểm kết quả AI cho kết hợp từ và từ dễ nhầm (R7.4, R7.5)', () => {
  it('kết hợp từ: bỏ cụm không chứa từ, cụm lặp, kiểu lạ thành "col"; tối đa 5', () => {
    const raw = {
      items: [
        { kind: 'col', en: 'lend a hand', vi: 'giúp một tay', ex: 'Can you lend a hand?', ex_vi: 'Giúp một tay nhé?' },
        { kind: 'prep', en: 'lend sth to sb', vi: 'cho ai mượn gì', ex: '', ex_vi: 'thừa' },
        { kind: 'idiom', en: 'lending library', vi: 'thư viện cho mượn' },
        { kind: 'col', en: 'Lend a hand', vi: 'lặp' },
        { kind: 'col', en: 'give a hand', vi: 'không chứa từ' },
        { kind: 'col', en: 'lend money', vi: 'cho vay tiền' },
        { kind: 'col', en: 'lend support', vi: 'ủng hộ' },
        { kind: 'col', en: 'lend weight', vi: 'thêm sức nặng' },
      ],
    }
    const out = toCollocations(raw, 'lend')!
    expect(out.map((c) => c.en)).toEqual(['lend a hand', 'lend sth to sb', 'lending library', 'lend money', 'lend support'])
    expect(out[1]).toEqual({ kind: 'prep', en: 'lend sth to sb', vi: 'cho ai mượn gì', ex: undefined, exVi: undefined })
    expect(out[2].kind).toBe('col')
    expect(toCollocations({ items: [{ en: 'give up', vi: 'bỏ cuộc' }] }, 'lend')).toBeNull()
    expect(toCollocations({ nope: 1 }, 'lend')).toBeNull()
  })

  it('từ dễ nhầm: nhóm phải chứa từ được hỏi, đủ mục cho mỗi từ; tự đánh dấu từ trong câu; danh sách rỗng hợp lệ', () => {
    const raw = {
      groups: [
        {
          words: ['lend', 'borrow'],
          summary: '*lend* là cho mượn, [borrow] là mượn.',
          items: [
            { word: 'lend', meaning: 'cho mượn', usage: '[lend] sb sth', examples: [{ en: 'Could you lend me a pen?', vi: 'Cho tớ mượn bút?' }, { en: 'He lent me a car.', vi: 'Anh ấy cho tôi mượn xe.' }] },
            { word: 'Borrow', meaning: 'mượn', usage: 'borrow sth from sb', examples: [{ en: 'Can I [borrow] it?', vi: 'Tớ [mượn] được không?' }] },
          ],
        },
      ],
    }
    const [g] = toConfusables(raw, 'Lend')!
    expect(g.words).toEqual(['lend', 'borrow'])
    expect(g.summary).toBe('lend là cho mượn, borrow là mượn.')
    expect(g.items[0].usage).toBe('lend sb sth')
    // "lent" không đánh dấu được (dạng bất quy tắc) nên bị bỏ.
    expect(g.items[0].examples).toEqual([{ en: 'Could you [lend] me a pen?', vi: 'Cho tớ mượn bút?' }])
    expect(g.items[1].examples[0]).toEqual({ en: 'Can I [borrow] it?', vi: 'Tớ mượn được không?' })
    expect(toConfusables({ groups: [] }, 'lend')).toEqual([])
    expect(toConfusables({ groups: [{ words: ['say', 'tell'], summary: 'x', items: [] }] }, 'lend')).toBeNull()
    expect(toConfusables({ groups: [{ words: ['lend', 'loan'], summary: 'x', items: [{ word: 'lend', meaning: 'cho mượn' }] }] }, 'lend')).toBeNull()
  })
})

describe('giải thích theo ngữ cảnh và sửa câu (R8.2, R8.6)', () => {
  it('lời nhắc có đoạn văn (khi dài hơn câu), câu và chữ được chọn', () => {
    expect(contextPrompt('A. We need to make up for it.', 'We need to make up for it.', 'make')).toBe('Đoạn văn:\n"""\nA. We need to make up for it.\n"""\nCâu: "We need to make up for it."\nChữ được chọn: "make"')
    expect(contextPrompt('He ran fast.', 'He ran fast.', 'ran')).toBe('Câu: "He ran fast."\nChữ được chọn: "ran"')
  })

  it('giải thích: thiếu nghĩa thì null; loại từ lạ thành "other"; thiếu cụm, dạng gốc thì lấy chữ đã chọn', () => {
    const r = toContextExplanation({ expression: 'make up for', lemma: 'make up for', pos: 'phrasal_verb', meaning_vi: 'bù đắp', explanation_vi: 'Cụm động từ.', sentence_vi: 'Cần bù lại.' }, 'make', 'We need to make up for it.')!
    expect(r).toMatchObject({ expression: 'make up for', pos: 'phrasal_verb', meaningVi: 'bù đắp', sentence: 'We need to make up for it.', otherMeaningsVi: '' })
    expect(toContextExplanation({ meaning_vi: 'chạy', pos: 'verbish' }, 'ran', 'He ran.')).toMatchObject({ expression: 'ran', lemma: 'ran', pos: 'other' })
    expect(toContextExplanation({ expression: 'ran' }, 'ran', 'He ran.')).toBeNull()
  })

  it('sửa câu: có lỗi thì không "đúng"; câu đúng giữ nguyên; bỏ lỗi trùng và lỗi không đổi gì', () => {
    const bad = toCorrection(
      {
        correct: true,
        corrected: 'I enjoy reading books.',
        issues: [
          { type: 'grammar', original: 'to read', fix: 'reading', explain_vi: 'Sau enjoy dùng V-ing.' },
          { type: 'target', original: 'enjoy to read', fix: 'enjoy reading', explain_vi: 'enjoy + V-ing.' },
          { type: 'style', original: 'books', fix: 'books', explain_vi: 'không đổi' },
        ],
        target_ok: false,
        translation_vi: 'Tôi thích đọc sách.',
      },
      'I enjoy to read books.',
    )!
    expect(bad.correct).toBe(false)
    expect(bad.issues).toEqual([{ type: 'target', original: 'enjoy to read', fix: 'enjoy reading', explainVi: 'enjoy + V-ing.' }])
    expect(bad.targetOk).toBe(false)
    const ok = toCorrection({ correct: false, corrected: 'can you lend me your pen? ', issues: [], target_ok: true }, 'Can you lend me your pen?')!
    expect(ok).toMatchObject({ correct: true, corrected: 'Can you lend me your pen?', issues: [] })
    expect(toCorrection({ nothing: 1 }, 'x')).toBeNull()
  })

  it('so chữ hai câu: phần bỏ, phần thêm; dấu câu dính vào chữ trước', () => {
    expect(wordDiff('I enjoy to read books.', 'I enjoy reading books.')).toEqual([
      { type: 'same', text: 'I enjoy' },
      { type: 'del', text: 'to read' },
      { type: 'add', text: 'reading' },
      { type: 'same', text: 'books.' },
    ])
    expect(wordDiff("It's fine, ok", "it's fine, ok")).toEqual([{ type: 'same', text: "it's fine, ok" }])
    expect(wordDiff('We deal the problem', 'We deal with the problem')).toEqual([
      { type: 'same', text: 'We deal' },
      { type: 'add', text: 'with' },
      { type: 'same', text: 'the problem' },
    ])
  })
})

describe('bài luyện câu mới và hội thoại (R8.5, R8.7)', () => {
  it('câu luyện: theo số thứ tự; chỉ nhận câu có y nguyên chữ cần điền và dài vừa phải', () => {
    expect(practicePrompt([{ term: 'take care of', partOfSpeech: 'phrasal_verb', meaningVi: 'chăm sóc' }], 'B1')).toBe('Trình độ người học: B1\n1. "take care of" (phrasal_verb): chăm sóc')
    const out = toPracticeSentences(
      {
        items: [
          { n: 2, sentence: 'She made a big decision about her future career.', sentence_vi: 'Cô ấy đưa ra quyết định lớn.' },
          { n: 1, sentence: 'He improved his English a lot this year.', sentence_vi: 'Anh ấy tiến bộ.' },
          { n: 3, sentence: 'Too short.', sentence_vi: 'Ngắn.' },
        ],
      },
      ['improve', 'decision', 'weather'],
    )
    // "improved" không phải y nguyên "improve": bỏ, để chỗ trống có đúng một đáp án.
    expect(out).toEqual([null, { en: 'She made a big decision about her future career.', vi: 'Cô ấy đưa ra quyết định lớn.' }, null])
    expect(toPracticeSentences({ items: [] }, ['x'])).toBeNull()
  })

  it('lượt hội thoại: chỉ nhận từ mục tiêu, từ dùng sai không tính là đúng; thiếu lời đáp thì null', () => {
    const r = toChatTurn({ reply: 'Sure! I recommend the soup.', reply_vi: 'Tôi gợi ý món súp.', feedback_vi: '', corrected: '', used_ok: ['Recommend', 'pizza', 'bill'], used_wrong: ['bill'] }, ['recommend', 'delicious', 'bill'])!
    expect(r).toMatchObject({ reply: 'Sure! I recommend the soup.', usedOk: ['recommend'], usedWrong: ['bill'] })
    expect(toChatTurn({ reply_vi: 'x' }, ['a'])).toBeNull()
  })

  it('nhận xét cuối buổi: đủ mọi từ theo thứ tự, thiếu thì "chưa dùng"; lời nhắc bỏ lượt mở đầu ẩn', () => {
    const s = toChatSummary({ summary_vi: 'Tốt.', words: [{ word: 'BILL', status: 'ok', note_vi: 'Dùng đúng.' }, { word: 'soup', status: 'wrong' }], tips_vi: ['a', '', 'b', 'c', 'd'] }, ['recommend', 'bill'])!
    expect(s.words).toEqual([
      { word: 'recommend', status: 'unused', noteVi: '' },
      { word: 'bill', status: 'ok', noteVi: 'Dùng đúng.' },
    ])
    expect(s.tipsVi).toEqual(['a', 'b', 'c'])
    expect(chatSummaryPrompt(['bill'], [{ role: 'user', content: CHAT_START }, { role: 'assistant', content: 'Hi!' }, { role: 'user', content: 'The bill, please.' }])).toBe('Từ mục tiêu: "bill"\nHội thoại:\nBạn luyện nói: Hi!\nNgười học: The bill, please.')
  })
})
