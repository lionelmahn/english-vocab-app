import { describe, expect, it } from 'vitest'
import { englishSection, htmlToText, mapPos, parseDefinitions, parsePronunciation, parseVietnamese, tidyIpa } from './dictionary'

/** Các đoạn dữ liệu rút gọn từ Wiktionary (CC BY-SA), giữ đúng cấu trúc thật. */

const LINK = (w: string) => `<a rel="mw:WikiLink" href="/wiki/${w}" title="${w}">${w}</a>`

describe('htmlToText', () => {
  it('bỏ thẻ, giải mã ký tự và bỏ danh sách nghĩa con lồng bên trong', () => {
    const html = `Moving or advancing at a run.\n<ol><li>Of a horse, having a running gait; not a ${LINK('trotter')}.<ol><li>deeper</li></ol></li></ol>`
    expect(htmlToText(html)).toBe('Moving or advancing at a run.')
    expect(htmlToText('<span class="usage-label-sense"></span> To look after &amp; care for ; to <b>mind</b> .')).toBe('To look after & care for; to mind.')
    expect(htmlToText('caf&#233; &#x2014; tea&nbsp;room')).toBe('café — tea room')
  })
})

describe('mapPos', () => {
  it('đổi loại từ Wiktionary sang loại từ của app, bỏ ký hiệu và tiền tố', () => {
    expect(mapPos('Verb', 'run')).toBe('verb')
    expect(mapPos('Verb', 'give up')).toBe('phrasal_verb')
    expect(mapPos('Proper noun', 'London')).toBe('noun')
    expect(mapPos('Prepositional phrase', 'at once')).toBe('phrase')
    expect(mapPos('Determiner', 'the')).toBe('other')
    expect(mapPos('Symbol', 'run')).toBeNull()
    expect(mapPos('Suffix', '-ness')).toBeNull()
  })
})

describe('parseDefinitions — nghĩa theo loại từ (R15.2)', () => {
  const json = {
    en: [
      { partOfSpeech: 'Symbol', language: 'English', definitions: [{ definition: 'ISO 639-2 language code for Kirundi.' }] },
      {
        partOfSpeech: 'Verb',
        language: 'English',
        definitions: [
          {
            definition: `<span class="usage-label-sense"></span> To ${LINK('surrender')} ; to give oneself up.`,
            parsedExamples: [{ example: 'He was surrounded, so <b>gave</b> himself <b>up</b>.' }],
            examples: ['He was surrounded, so <b>gave</b> himself <b>up</b>.'],
          },
          { definition: '' },
          { definition: 'To relinquish.', examples: ['He <b>gave up</b> his seat.', 'Second.', 'Third.'] },
        ],
      },
      { partOfSpeech: 'Adjective', language: 'English', definitions: [{ definition: 'Fully taken over by a quality.' }] },
      { partOfSpeech: 'Verb', language: 'English', definitions: [{ definition: 'To abandon (an idea).' }] },
    ],
    fr: [{ partOfSpeech: 'Verb', language: 'French', definitions: [{ definition: 'abandonner' }] }],
  }

  it('gộp nhóm cùng loại từ, bỏ nghĩa trống, ký hiệu và ngôn ngữ khác; giữ tối đa 2 ví dụ', () => {
    const groups = parseDefinitions(json, 'give up')
    expect(groups.map((g) => [g.partOfSpeech, g.label, g.senses.length])).toEqual([
      ['phrasal_verb', 'Verb', 3],
      ['adjective', 'Adjective', 1],
    ])
    expect(groups[0].senses[0]).toEqual({ definition: 'To surrender; to give oneself up.', examples: ['He was surrounded, so gave himself up.'] })
    expect(groups[0].senses[1].examples).toEqual(['He gave up his seat.', 'Second.'])
  })

  it('nghĩa dạng "simple past of go" ghi lại từ gốc để tra tiếp', () => {
    const went = {
      en: [
        {
          partOfSpeech: 'Verb',
          language: 'English',
          definitions: [
            {
              definition:
                '<span class="form-of-definition use-with-mention">simple <a href="/wiki/Appendix:Glossary#past_tense" title="Appendix:Glossary">past</a> of <span class="form-of-definition-link"><i class="Latn mention" lang="en"><a rel="mw:WikiLink" href="/wiki/go#English" title="go">go</a></i></span></span>',
            },
          ],
        },
      ],
    }
    expect(parseDefinitions(went, 'went')[0].senses[0]).toEqual({ definition: 'simple past of go', examples: [], formOf: 'go' })
  })

  it('dữ liệu lạ hoặc rỗng thì không có nhóm nào', () => {
    expect(parseDefinitions(null, 'x')).toEqual([])
    expect(parseDefinitions({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: '  ' }] }] }, 'x')).toEqual([])
  })
})

describe('parsePronunciation — phiên âm Anh–Mỹ, Anh–Anh', () => {
  it('không có nhãn giọng thì dùng cho cả hai; viết /ɹ/ thành /r/', () => {
    const wt = `==English==\n===Pronunciation===\n* {{IPA|en|/ɹɪˈzɪl.jənt/|/ɹɪˈzɪli.ənt/}}\n* {{audio|en|en-us-resilient.ogg|a=US}}\n===Adjective===`
    expect(parsePronunciation(wt).ipa).toEqual({ us: '/rɪˈzɪl.jənt/', uk: '/rɪˈzɪl.jənt/' })
  })

  it('nhãn trong mẫu (a=GA,RP) và nhãn ở dòng cha ({{a|RP}} rồi **)', () => {
    expect(parsePronunciation(`===Pronunciation===\n* {{IPA|en|/ɹʌn/|a=GA,RP}}\n* {{IPA|en|/ɹʊn/|a=North England,Ireland}}`).ipa).toEqual({ us: '/rʌn/', uk: '/rʌn/' })
    const schedule = [
      '===Pronunciation===',
      '* {{a|en|RP}}<ref>{{cite-web|url=http://example.org|title=Definition}}</ref>',
      '** {{IPA|en|/ˈʃɛd͡ʒuːl/|/ˈskɛd͡ʒ.uːl/|a=yod-coalescence}}',
      '* {{a|en|SSB}}',
      '** {{IPA|en|/ˈʃɛd͡ʒʉwl/|a=yod-coalescence}}',
      '* {{IPA|en|/ˈskɛd͡ʒ.ʊl/|/ˈskɛd͡ʒ.(u)(ə)l/|a=GA,Philippines}}',
    ].join('\n')
    expect(parsePronunciation(schedule).ipa).toEqual({ uk: '/ˈʃɛdʒuːl/', us: '/ˈskɛdʒ.ʊl/' })
  })

  it('từ nhiều gốc đọc khác theo loại từ ("record" danh từ và động từ); nhãn ở mẫu enPR cùng dòng', () => {
    const record = [
      '==English==',
      '===Etymology 1===',
      '====Pronunciation====',
      '* {{enPR|rĕkʹôrd|a=RP}}, {{IPA|en|/ˈɹɛk.ɔːd/}}',
      '* {{enPR|rĕkʹərd|rĕkʹôrd|a=GA}}, {{IPA|en|/ˈɹɛk.ɚd/|/ˈɹɛk.oɹd/}}',
      '====Noun====',
      '# An item of information.',
      '====Adjective====',
      '===Etymology 2===',
      '====Pronunciation====',
      '* {{IPA|en|/ɹɪˈkɔːd/|/ɹə-/|a=RP}}',
      '* {{IPA|en|/ɹəˈkoɹd/|/ɹɪ-/|a=GA}}',
      '====Verb====',
    ].join('\n')
    const { ipa, byPos } = parsePronunciation(record, 'record')
    expect(ipa).toEqual({ uk: '/ˈrɛk.ɔːd/', us: '/ˈrɛk.ɚd/' })
    expect(byPos.noun).toEqual({ uk: '/ˈrɛk.ɔːd/', us: '/ˈrɛk.ɚd/' })
    expect(byPos.adjective).toEqual(byPos.noun)
    expect(byPos.verb).toEqual({ uk: '/rɪˈkɔːd/', us: '/rəˈkord/' })
  })

  it('không có phiên âm thì trả về rỗng', () => {
    expect(parsePronunciation('===Pronunciation===\n* {{audio|en|LL-Q1860 (eng)-give up.wav|a=Southern England}}')).toEqual({ ipa: {}, byPos: {} })
  })

  it('tidyIpa bỏ dấu nối âm', () => {
    expect(tidyIpa(' /ˈd͡ʒʌd͡ʒ/ ')).toBe('/ˈdʒʌdʒ/')
  })
})

describe('parseVietnamese — gợi ý nghĩa tiếng Việt từ bảng dịch', () => {
  it('lấy chữ tiếng Việt theo từng nghĩa, bỏ chú thích', () => {
    const wt = [
      '===Verb===',
      '====Translations====',
      '{{trans-top|look after}}',
      '* French: {{t+|fr|soigner}}',
      '* Vietnamese: {{t+|vi|chăm sóc}}, {{t+|vi|săn sóc}} {{q|to take care of someone carefully}}',
      '{{trans-bottom}}',
      '{{trans-top|deal with}}',
      '* French: {{t|fr|s\'[[occuper]] de}}',
      '{{trans-bottom}}',
      '{{trans-top|kill}}',
      '* Vietnamese: {{t+|vi|xử}} {{qualifier|informal|transitive}}',
      '{{trans-bottom}}',
    ].join('\n')
    expect(parseVietnamese(wt, 'take care of')).toEqual([
      { partOfSpeech: 'phrasal_verb', gloss: 'look after', words: ['chăm sóc', 'săn sóc'] },
      { partOfSpeech: 'phrasal_verb', gloss: 'kill', words: ['xử'] },
    ])
  })

  it('liên kết bên trong mẫu dịch được gộp thành một nghĩa, không tách rời', () => {
    const wt = '===Verb===\n{{trans-top|lose hope}}\n* Vietnamese: {{t|vi|[[từ bỏ]] [[hi vọng]]}}, {{t+|vi|[[bỏ cuộc|bỏ cuộc]]}}\n{{trans-bottom}}'
    expect(parseVietnamese(wt, 'give up')).toEqual([{ partOfSpeech: 'phrasal_verb', gloss: 'lose hope', words: ['từ bỏ hi vọng', 'bỏ cuộc'] }])
  })

  it('nhận cả liên kết [[...]] và bỏ dòng tiếng Việt nằm ngoài bảng dịch', () => {
    const wt = '===Adjective===\n* Vietnamese: {{t|vi|ngoài bảng}}\n{{trans-top|elastic}}\n* Vietnamese: [[đàn hồi]], [[dẻo|dẻo dai]]\n{{trans-bottom}}'
    expect(parseVietnamese(wt)).toEqual([{ partOfSpeech: 'adjective', gloss: 'elastic', words: ['đàn hồi', 'dẻo dai'] }])
  })
})

describe('englishSection', () => {
  it('chỉ lấy phần English của trang', () => {
    const wt = '==Translingual==\n===Symbol===\n==English==\n===Noun===\n# a thing\n==French==\n===Noun===\n# une chose'
    expect(englishSection(wt)).toBe('==English==\n===Noun===\n# a thing\n')
  })
})
