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
    expect(byPos.verb).toEqual({ uk: '/rɪˈkɔːd/', us: '/rəˈkɔrd/' })
  })

  it('từ chức năng lấy dạng đọc nhấn, không lấy dạng đọc lướt, giọng SSB hay giọng vùng ("should", "the")', () => {
    const should = [
      '===Pronunciation===',
      '* {{IPA|en|/ʃəd/|a=weak form}}',
      '* {{IPA|en|/ʃʊd/|a=strong form}}',
      '* {{IPA| en|/ʃɵd/|a=SSB,strong form}}',
      '* {{IPA|en|/ʃʉd/|a=Scotland,NI,strong form}}',
      '* {{a|en|Early Modern}}',
      '** {{IPA|en|/ʃʊ(l)d/<ref:<<name:Dobson>>>|a=weak form}}',
      '===Verb===',
    ].join('\n')
    expect(parsePronunciation(should, 'should').ipa).toEqual({ us: '/ʃʊd/', uk: '/ʃʊd/' })
    const the = [
      '===Pronunciation===',
      '* {{a|en|RP}}',
      "** {{IPA|en|/ðə/|a=weak form before consonants}}, {{enPR|''th''ə}}",
      "** {{IPA|en|/ði/ [ðɪj]|a=weak form before vowels}}, {{enPR|''th''ē}}",
      "** {{IPA|en|/ðiː/|a=strong form}}, {{enPR|''th''ē}}",
      '* {{a|en|GA}}',
      "** {{IPA|en|/ðə/|a=weak form before consonants}}, {{enPR|''th''ə}}",
      "** {{IPA|en|/ði/ [ðɪj]|a=strong form}}, {{enPR|''th''ē}}",
      '* {{audio|en|en-uk-the-stressed.ogg|a=UK|IPA=/ðiː/}}',
    ].join('\n')
    expect(parsePronunciation(the, 'the').ipa).toEqual({ uk: '/ðiː/', us: '/ði/' })
  })

  it('phiên âm hẹp […] dùng phiên âm /…/ ở dòng cha; dòng cha không hợp giọng thì đổi phiên âm hẹp về dạng từ điển', () => {
    const might = ['* {{enPR|mīt}}, {{IPA|en|/maɪt/}}', '** {{IPA|en|[maɪt]|a=RP}}', '** {{IPA|en|[mɐɪt]|a=US}}', '** {{IPA|en|[mɑjt]|a=SSB}}']
    expect(parsePronunciation(['===Pronunciation===', ...might].join('\n')).ipa).toEqual({ us: '/maɪt/', uk: '/maɪt/' })
    const pass = [
      '* {{IPA|en|/pɑːs/}}',
      '** {{IPA|en|[pʰɑːs]|a=RP,South Africa}}',
      '** {{IPA|en|[pʰaːs]|a=Boston}}',
      '* {{IPA|en|/pæs/}}',
      '** {{IPA|en|[pʰæs]|[pʰɛə̯s]|[pʰeə̯s]|a=GA,Canada}}',
      '** {{IPA|en|[pʰeə̯s]|a=NYC}}',
    ]
    expect(parsePronunciation(['===Pronunciation===', ...pass].join('\n')).ipa).toEqual({ uk: '/pɑːs/', us: '/pæs/' })
    const number = ['* {{enPR|nŭmʹbər}}, {{IPA|en|/ˈnʌmbər/}}', '** {{IPA|en|[ˈnʌmbə]|a=RP}}', '** {{IPA|en|[ˈnʌ̟mbɚ]|a=US,CA}}', '** {{IPA|en|[ˈnɐmbɐ]|a=AU}}']
    expect(parsePronunciation(['===Pronunciation===', ...number].join('\n')).ipa).toEqual({ uk: '/ˈnʌmbə/', us: '/ˈnʌmbɚ/' })
  })

  it('nhãn của file ghi âm không áp cho phiên âm bên dưới; giọng vùng (l-vocalization) không được chọn', () => {
    const bill = ['===Pronunciation===', '* {{IPA|en|/ˈbɪl/|[ˈbɪɫ]}}', '** {{audio|en|en-uk-bill.ogg|a=UK}}', '*** {{IPA|en|/ˈbɪʊ̯/|[ˈbɪʊ̯]|a=l-vocalization}}'].join('\n')
    expect(parsePronunciation(bill).ipa).toEqual({ us: '/bɪl/', uk: '/bɪl/' })
  })

  it('nhãn riêng cho từng phiên âm (a2=, q2=) và mẫu lồng trong mẫu ({{R:…}})', () => {
    const only = ['===Pronunciation===', '*{{IPA|en|/ˈoʊn.li/}}', '** {{IPA|en|/ˈəʊn.li/|/ˈəʊn.i/|q2=in fast speech|a=UK}}', '** {{IPA|en|/ˈoʊn.li/|a=US}}'].join('\n')
    expect(parsePronunciation(only).ipa).toEqual({ us: '/ˈoʊn.li/', uk: '/ˈəʊn.li/' })
    const catchText = [
      '===Pronunciation===',
      '* {{enPR|kăch|a=RP,Australia}}, {{IPA|en|/kæt͡ʃ/|/kɛt͡ʃ/|a2=obsolete|ref2={{R:en:Ross:1953|37}}}}',
      '* {{enPR|kăch|kĕch|a=US,Canada}}, {{IPA|en|/kæt͡ʃ/|/kɛt͡ʃ/}}',
    ].join('\n')
    expect(parsePronunciation(catchText).ipa).toEqual({ uk: '/kætʃ/', us: '/kætʃ/' })
  })

  it('nhãn loại từ: {{sense|noun}}, {{a|en|adjective|noun}}; nhãn nghĩa lạ ("past of presend") xếp sau', () => {
    const estimate = [
      '===Pronunciation===',
      '* {{a|en|UK}}',
      '** {{sense|noun}} {{IPA|en|/ˈɛs.tɪ.mət/}}',
      '** {{sense|verb}} {{IPA|en|/ˈɛs.tɪˌmeɪt/}}',
      '* {{a|en|US}}',
      '** {{sense|noun}}{{IPA|en|/ˈɛs.tə.mət/}}',
      '** {{sense|verb}} {{IPA|en|/ˈɛs.təˌmeɪt/}}',
      '===Etymology 1===',
      '====Noun====',
      '===Etymology 2===',
      '====Verb====',
    ].join('\n')
    const e = parsePronunciation(estimate, 'estimate')
    expect(e.byPos.noun).toEqual({ uk: '/ˈɛs.tɪ.mət/', us: '/ˈɛs.tə.mət/' })
    expect(e.byPos.verb).toEqual({ uk: '/ˈɛs.tɪˌmeɪt/', us: '/ˈɛs.təˌmeɪt/' })
    const present = [
      '===Pronunciation===',
      '* {{a|en|adjective|noun}}',
      '** {{enPR|prĕzʹənt|a=RP,GA,CA}}, {{IPA|en|/ˈpɹɛz.ənt/}}',
      '** {{IPA|en|/ˈpɹez.ənt/|a=AU,NZ}}',
      '* {{a|en|verb}}',
      "** {{enPR|prĭzĕnt'|a=RP}}, {{IPA|en|/pɹɪˈzɛnt/}}",
      '** {{IPA|en|/pɹɪˈzɛnt/|a=GA}}',
      '** {{IPA|en|/pɹiˈzɛnt/|a=US}}',
      '* {{a|en|past of "presend"}}',
      '** {{IPA|en|/pɹiːˈsɛnt/|a=RP}}',
      '** {{IPA|en|/pɹiˈsɛnt/|a=GA,Canada}}',
      '===Etymology 1===',
      '====Adjective====',
      '====Noun====',
      '===Etymology 2===',
      '====Verb====',
    ].join('\n')
    const p = parsePronunciation(present, 'present')
    expect(p.ipa).toEqual({ uk: '/ˈprɛz.ənt/', us: '/ˈprɛz.ənt/' })
    expect(p.byPos.noun).toEqual(p.ipa)
    expect(p.byPos.adjective).toEqual(p.ipa)
    expect(p.byPos.verb).toEqual({ uk: '/prɪˈzɛnt/', us: '/prɪˈzɛnt/' })
  })

  it('"Pronunciation 1", "Pronunciation 2" bao các Etymology bên trong ("separate")', () => {
    const separate = [
      '==English==',
      '===Pronunciation 1===',
      '* {{IPA|en|/ˈsɛp.əˌɹeɪt/|/ˈsɛpˌɹeɪt/|/ˈsɛp.ɚˌeɪt/<a:rhotic,also>|a=GA,CA}}',
      '* {{IPA|en|/ˈsɛp.əˌɹæɪt/|a=AU,NZ}}',
      '====Etymology====',
      '====Verb====',
      '===Pronunciation 2===',
      '* {{IPA|en|/ˈsɛp.(ə.)ɹət/|a=RP}}',
      '* {{IPA|en|/ˈsɛp.ɹət/|a=GA,CA}}',
      '====Etymology 1====',
      '=====Adjective=====',
      '====Etymology 2====',
      '=====Noun=====',
    ].join('\n')
    const { byPos } = parsePronunciation(separate, 'separate')
    expect(byPos.verb).toEqual({ us: '/ˈsɛp.əˌreɪt/' })
    expect(byPos.adjective).toEqual({ uk: '/ˈsɛp.ə.rət/', us: '/ˈsɛp.rət/' })
    expect(byPos.noun).toEqual(byPos.adjective)
  })

  it('tiêu đề con Stressed/Unstressed trong phần Pronunciation ("to"); phiên âm chỉ của giọng vùng thì không dùng', () => {
    const to = [
      '==English==',
      '===Etymology 1===',
      '====Pronunciation====',
      '=====Stressed=====',
      '* {{enPR|to͞o}}, {{IPA|en|/tuː/}}',
      '** {{a|en|UK}}',
      '*** {{IPA|en|[tu̟ː]|[tʰʊw]|a=RP}}',
      '*** {{IPA|en|[tʰʉw]|a=SSB}}',
      '** {{IPA|en|[tʰu̟(ː)]|a=US}}',
      '=====Unstressed=====',
      '* {{IPA|en|q=before a consonant|/tə/|/tʊ/}}',
      '** {{IPA|en|[ɾə]|a=US|q=after a vowel}}',
      '====Preposition====',
      '===Etymology 2===',
      '====Pronunciation====',
      '* {{IPA|en|/t̪oː/|[t̪oː]|a=India}}',
      '====Particle====',
    ].join('\n')
    const { ipa, byPos } = parsePronunciation(to, 'to')
    expect(ipa).toEqual({ us: '/tu/', uk: '/tuː/' })
    expect(byPos.preposition).toEqual(ipa)
    expect(parsePronunciation('===Pronunciation===\n* {{IPA|en|/t̪oː/|[t̪oː]|a=India}}')).toEqual({ ipa: {}, byPos: {} })
  })

  it('viết theo giọng: Anh–Anh bỏ âm nối (r), Anh–Mỹ dùng /ɚ/, /ɔr/ và không ghi ː', () => {
    const or = ['===Pronunciation===', '* {{a|en|RP}}', '** {{IPA|en|/ə(ɹ)/|a=weak form}}', '** {{IPA|en|/ɔː(ɹ)/|a=strong form}}', '* {{a|en|GA}}', '** {{IPA|en|/ɚ/|a=weak form}}', '** {{IPA|en|/oɹ/|a=strong form}}']
    expect(parsePronunciation(or.join('\n')).ipa).toEqual({ uk: '/ɔː/', us: '/ɔr/' })
    expect(parsePronunciation('===Pronunciation===\n* {{IPA|en|/ˈɛvə(ɹ)/}}').ipa).toEqual({ uk: '/ˈɛvə/', us: '/ˈɛvɚ/' })
    expect(parsePronunciation('===Pronunciation===\n* {{IPA|en|/ˈiːvən/}}').ipa).toEqual({ uk: '/ˈiːvən/', us: '/ˈivən/' })
  })

  it('không có phiên âm thì trả về rỗng', () => {
    expect(parsePronunciation('===Pronunciation===\n* {{audio|en|LL-Q1860 (eng)-give up.wav|a=Southern England}}')).toEqual({ ipa: {}, byPos: {} })
  })

  it('tidyIpa: bỏ dấu nối âm và dấu phụ, viết l̩ n̩ thành əl ən, viết âm trong ngoặc, từ một âm tiết không ghi dấu nhấn', () => {
    expect(tidyIpa(' /ˈd͡ʒʌd͡ʒ.mənt/ ')).toBe('/ˈdʒʌdʒ.mənt/')
    expect(tidyIpa('/ˈbʊt/')).toBe('/bʊt/')
    expect(tidyIpa('/ˈlɪ.tl̩/')).toBe('/ˈlɪ.təl/')
    expect(tidyIpa('/ˈækʃən̩/')).toBe('/ˈækʃən/')
    expect(tidyIpa('/ˈpæ̞t(ə)n/')).toBe('/ˈpætən/')
    expect(tidyIpa('/sɪn(t)s/')).toBe('/sɪns/')
    expect(tidyIpa('/(h)waɪl/')).toBe('/waɪl/')
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
