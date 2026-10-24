import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../db/db'
import { cleanQuery, createDictionary, type FetchJson } from './dictionary'

/** Tra từ với mạng giả: kiểm tra thứ tự gọi, lưu kết quả trên máy và các trường hợp lỗi (R15.1, R15.5). */

const opened: VocabDatabase[] = []
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

function setup(routes: Record<string, unknown>, opts: { online?: boolean; fail?: RegExp } = {}) {
  const database = new VocabDatabase(`dict-${crypto.randomUUID()}`)
  opened.push(database)
  const calls: string[] = []
  const get: FetchJson = async (url) => {
    calls.push(url)
    if (opts.fail?.test(url)) throw new Error('Từ điển đang bận, thử lại sau ít phút.')
    const hit = Object.entries(routes).find(([k]) => url.includes(k))
    return hit ? hit[1] : null
  }
  const state = { online: opts.online ?? true }
  return { database, calls, state, dict: createDictionary(database, get, () => state.online) }
}

const RESILIENT = {
  en: [{ partOfSpeech: 'Adjective', language: 'English', definitions: [{ definition: 'Returning quickly to normal after damaging events.', examples: ['Kids are <b>resilient</b>.'] }] }],
}
const SECTIONS = { parse: { sections: [{ index: '1', line: 'English', toclevel: 1 }] } }
const WIKITEXT = {
  parse: {
    wikitext: [
      '==English==',
      '===Pronunciation===',
      '* {{IPA|en|/ɹɪˈzɪl.jənt/}}',
      '===Adjective===',
      '====Translations====',
      '{{trans-top|elastic}}',
      '* Vietnamese: {{t+|vi|đàn hồi}}',
      '{{trans-bottom}}',
    ].join('\n'),
  },
}

describe('tra từ (R15.1)', () => {
  it('chữ gõ hoa thì thử chữ thường trước; có nghĩa, phiên âm và gợi ý tiếng Việt', async () => {
    const { dict, calls } = setup({ 'definition/resilient': RESILIENT, 'prop=sections': SECTIONS, 'prop=wikitext': WIKITEXT })
    const res = await dict.lookup('  Resilient ')
    expect(res.status).toBe('found')
    if (res.status !== 'found') return
    expect(res.entry.title).toBe('resilient')
    expect(res.entry.groups[0].senses[0]).toEqual({ definition: 'Returning quickly to normal after damaging events.', examples: ['Kids are resilient.'] })
    expect(res.entry.ipa).toEqual({ us: '/rɪˈzɪl.jənt/', uk: '/rɪˈzɪl.jənt/' })
    expect(res.entry.vietnamese).toEqual([{ partOfSpeech: 'adjective', gloss: 'elastic', words: ['đàn hồi'] }])
    expect(calls[0]).toContain('definition/resilient')
  })

  it('tra lại thì lấy từ máy, kể cả khi mất mạng', async () => {
    const { dict, calls, state } = setup({ 'definition/resilient': RESILIENT, 'prop=sections': SECTIONS, 'prop=wikitext': WIKITEXT })
    await dict.lookup('resilient')
    const n = calls.length
    expect((await dict.lookup('RESILIENT')).status).toBe('found')
    state.online = false
    expect((await dict.lookup('resilient')).status).toBe('found')
    expect(calls.length).toBe(n)
  })

  it('kết quả lưu bởi bộ đọc cũ thì tra lại', async () => {
    const { dict, database, calls } = setup({ 'definition/resilient': RESILIENT })
    await database.dictionary.put({ key: 'resilient', entry: null, suggestions: [], fetchedAt: Date.now(), parser: 0 })
    expect((await dict.lookup('resilient')).status).toBe('found')
    expect(calls[0]).toContain('definition/resilient')
  })

  it('cụm từ dùng dấu gạch dưới trên đường dẫn; mã nguồn trang lỗi thì vẫn có nghĩa', async () => {
    const giveUp = { en: [{ partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'To surrender.' }] }] }
    const { dict, calls } = setup({ 'definition/give_up': giveUp }, { fail: /action=parse/ })
    const res = await dict.lookup('give  up')
    expect(res.status === 'found' && res.entry.groups[0].partOfSpeech).toBe('phrasal_verb')
    expect(res.status === 'found' && res.entry.ipa).toEqual({})
    expect(calls[0]).toContain('definition/give_up')
  })

  it('mất mạng và chưa từng tra thì báo mất mạng', async () => {
    const { dict, calls } = setup({}, { online: false })
    expect(await dict.lookup('resilient')).toEqual({ status: 'offline' })
    expect(calls).toEqual([])
  })

  it('từ điển lỗi thì báo lỗi dễ hiểu, không lưu kết quả hỏng', async () => {
    const { dict, database } = setup({}, { fail: /definition/ })
    expect(await dict.lookup('resilient')).toEqual({ status: 'error', message: 'Từ điển đang bận, thử lại sau ít phút.' })
    expect(await database.dictionary.count()).toBe(0)
  })

  it('chuẩn hóa chữ gõ', () => {
    expect(cleanQuery('  don’t   give up ')).toBe("don't give up")
  })
})

describe('không tìm thấy (R15.5)', () => {
  it('gợi ý từ gần giống (tìm gần đúng), bỏ chính nó và trang không phải mục từ', async () => {
    const fuzzy = ['resilent', ['resilient', 'Resilent', 'Wiktionary:About', 'resilience', 'resilient'], [], []]
    const { dict, database, calls } = setup({ 'action=opensearch': fuzzy })
    expect(await dict.lookup('resilent')).toEqual({ status: 'not_found', suggestions: ['resilient', 'resilience'] })
    expect(calls.at(-1)).toContain('profile=fuzzy')
    expect((await database.dictionary.get('resilent'))?.entry).toBeNull()
  })

  it('trang chỉ có ngôn ngữ khác hoặc chỉ có ký hiệu thì coi như không tìm thấy', async () => {
    const onlySymbol = { en: [{ partOfSpeech: 'Symbol', language: 'English', definitions: [{ definition: 'ISO code.' }] }], fr: [] }
    const { dict } = setup({ 'definition/xx': onlySymbol })
    expect((await dict.lookup('xx')).status).toBe('not_found')
  })
})
