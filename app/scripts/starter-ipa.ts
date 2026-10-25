// Bổ sung phiên âm Anh–Mỹ và Anh–Anh cho bộ từ khởi đầu từ Wiktionary (CC BY-SA), dùng đúng bộ đọc phiên âm của app.
// Chạy: npx esbuild scripts/starter-ipa.ts --bundle --platform=node --format=esm --outfile=<thư mục tạm>/starter-ipa.mjs
//       node <thư mục tạm>/starter-ipa.mjs <thư mục đệm> [--write]
// Lấy nội dung 50 trang mỗi lần (nghỉ giữa các lần, có User-Agent theo quy định của Wikimedia), lưu đệm để chạy lại không tải lại.
// Không có --write thì chỉ in báo cáo; có --write thì ghi hai cột ipa_us, ipa_uk vào file dữ liệu.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { englishSection, parsePronunciation, type Ipa } from '../src/core/dictionary'
import type { PartOfSpeech } from '../src/core/pos'

// Chạy từ thư mục app/.
const DATA = join(process.cwd(), 'src/data/starter/ngsl-1000.txt')
const API = 'https://en.wiktionary.org/w/api.php'
const UA = 'EnglishVocabApp/0.12 (https://english-vocab.lionelmahn.workers.dev; personal vocabulary app; starter IPA script)'
const cacheDir = process.argv[2]
const write = process.argv.includes('--write')
if (!cacheDir) throw new Error('Thiếu thư mục đệm')
mkdirSync(cacheDir, { recursive: true })
const cacheFile = join(cacheDir, 'wiktionary-pages.json')

const lines = readFileSync(DATA, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const header = lines[0].split('|')
const rows = lines.slice(1).map((l) => l.split('|'))
const termAt = header.indexOf('term')
const posAt = header.indexOf('part_of_speech')
const terms = [...new Set(rows.map((r) => r[termAt]))]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pages: Record<string, string | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}

const missing = terms.filter((t) => !(t in pages))
for (let i = 0; i < missing.length; i += 50) {
  const batch = missing.slice(i, i + 50)
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(batch.join('|'))}`
  let res: Response | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })
    if (res.status !== 429 && res.status < 500) break
    await sleep(10_000 * (attempt + 1))
  }
  if (!res?.ok) throw new Error(`Wiktionary ${res?.status}`)
  const json = (await res.json()) as {
    query: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] }
  }
  const byTitle = new Map(json.query.pages.map((p) => [p.title, p.missing ? null : (p.revisions?.[0]?.slots.main.content ?? null)]))
  const follow = (t: string) => {
    let title = t
    for (const step of [json.query.normalized ?? [], json.query.redirects ?? []]) title = step.find((s) => s.from === title)?.to ?? title
    return title
  }
  for (const t of batch) pages[t] = byTitle.get(follow(t)) ?? null
  writeFileSync(cacheFile, JSON.stringify(pages))
  console.log(`Đã tải ${Math.min(i + 50, missing.length)}/${missing.length} trang`)
  await sleep(2000)
}

// ---- Tách phiên âm theo đúng loại từ của mục trong bộ -------------------------------------------
// Wiktionary không có phiên âm, hoặc từ đọc khác nhau theo nghĩa mà bộ đọc không phân biệt được: ghi tay.
const MANUAL: Record<string, Ipa> = {
  'according to': { us: '/əˈkɔrdɪŋ tu/', uk: '/əˈkɔːdɪŋ tuː/' },
  // Động từ "dẫn dắt"; Wiktionary để nghĩa "chì" /lɛd/ (cũng là danh từ, động từ) lên trước.
  lead: { us: '/lid/', uk: '/liːd/' },
  // Wiktionary gọi /əˈnʌðə/ là dạng đọc lướt, nhưng đó là cách đọc thông thường; dạng nhấn /ænˈʌðə/ hiếm gặp.
  another: { us: '/əˈnʌðɚ/', uk: '/əˈnʌðə/' },
  // Wiktionary chỉ có giọng Mỹ.
  positive: { us: '/ˈpɑzətɪv/', uk: '/ˈpɒzətɪv/' },
  // Giọng Mỹ trên Wiktionary chỉ có dạng /ˈðæŋk/ không nhãn và dạng /θeɪŋk/ (æ-tensing).
  thank: { us: '/θæŋk/', uk: '/θæŋk/' },
  // Wiktionary đặt /ˈɪʃjuː/ không nhãn lên trên; từ điển cho người học ghi /ˈɪʃuː/.
  issue: { us: '/ˈɪʃu/', uk: '/ˈɪʃuː/' },
  // Wiktionary ghi /ɛni/ thiếu dấu nhấn.
  any: { us: '/ˈɛni/', uk: '/ˈɛni/' },
  // Giọng Mỹ trên Wiktionary chỉ có /fəɪt/ (giọng Canada, một số vùng Mỹ).
  fight: { us: '/faɪt/', uk: '/faɪt/' },
  // Giọng Mỹ trên Wiktionary để /ˈbiˌhaɪnd/ lên trước; cách đọc thông thường là /bɪˈhaɪnd/.
  behind: { us: '/bɪˈhaɪnd/', uk: '/bɪˈhaɪnd/' },
  // Wiktionary chỉ có phiên âm chung /jɛ(ə)/, /jaː/, /jæ(.ə)/.
  yeah: { us: '/jæ/', uk: '/jɛə/' },
}
// Chỉ có một giọng mà phiên âm không có âm nào khác nhau giữa hai giọng (/əˈkaʊnt/): dùng cho cả hai.
const SAME_BOTH = /[ɑɒɔɜɝɚæː]|oʊ|əʊ|eə|ɪə|ʊə|r(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ])/

const same = (a?: Ipa, b?: Ipa) => a?.us === b?.us && a?.uk === b?.uk
// Ký hiệu ngoài bảng phiên âm quen thuộc của từ điển cho người học, hoặc sai giọng (Anh–Anh có /ɚ/, Anh–Mỹ có /ɒ/…).
const ALLOWED = /^\/[pbtdkɡfvθðszʃʒhmnŋlrjwiɪeɛæʌɑɒɔʊuɜɝəɚaoˈˌ.ː ]+\/$/
const odd = (v: string, accent: 'us' | 'uk') =>
  !ALLOWED.test(v) || (accent === 'uk' ? /ɚ|ɝ|oʊ|r(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ])/.test(v) : /ɒ|əʊ|ɜ|[eɛ]ə|ː/.test(v))
// Mỗi phần Etymology/Pronunciation N đọc riêng: loại từ có mặt ở nhiều phần với phiên âm khác nhau thì cần rà tay.
const chunks = (text: string) => text.split(/\n(?==+\s*(?:Etymology|Pronunciation \d))/)

const report = { full: 0, onlyOne: [] as string[], none: [] as string[], ambiguous: [] as string[], odd: [] as string[], manual: [] as string[] }
const result = rows.map((r) => {
  const term = r[termAt]
  const pos = r[posAt] as PartOfSpeech
  const text = pages[term]
  let chosen: Ipa = {}
  if (MANUAL[term]) {
    chosen = MANUAL[term]
    report.manual.push(term)
  } else if (text) {
    const english = englishSection(text)
    const { ipa, byPos } = parsePronunciation(english, term)
    chosen = byPos[pos] ?? ipa
    if (!chosen.uk && chosen.us && !SAME_BOTH.test(chosen.us)) chosen = { ...chosen, uk: chosen.us }
    if (!chosen.us && chosen.uk && !SAME_BOTH.test(chosen.uk)) chosen = { ...chosen, us: chosen.uk }
    const variants = chunks(english)
      .map((c) => parsePronunciation(c, term).byPos[pos])
      .filter((v): v is Ipa => !!v && !!(v.us || v.uk))
      .filter((v, i, all) => all.findIndex((w) => same(v, w)) === i)
    if (variants.length > 1) report.ambiguous.push(`${term} (${pos}): chọn ${chosen.us ?? '—'} | ${chosen.uk ?? '—'}; có ${variants.map((v) => `${v.us ?? '—'} | ${v.uk ?? '—'}`).join('; ')}`)
  }
  if (chosen.us && chosen.uk) report.full++
  else if (chosen.us || chosen.uk) report.onlyOne.push(`${term} (${pos}): ${chosen.us ?? '—'} | ${chosen.uk ?? '—'}`)
  else report.none.push(term)
  if ((chosen.us && odd(chosen.us, 'us')) || (chosen.uk && odd(chosen.uk, 'uk'))) report.odd.push(`${term} (${pos}): ${chosen.us ?? '—'} | ${chosen.uk ?? '—'}`)
  return { us: chosen.us ?? '', uk: chosen.uk ?? '' }
})

console.log(`\nĐủ cả Mỹ và Anh: ${report.full}/${rows.length}`)
console.log(`Ghi tay: ${report.manual.join(', ')}`)
console.log(`Chỉ có một giọng (${report.onlyOne.length}):\n  ${report.onlyOne.join('\n  ')}`)
console.log(`Không có phiên âm (${report.none.length}): ${report.none.join(', ')}`)
console.log(`Đọc khác theo nghĩa, cần rà (${report.ambiguous.length}):\n  ${report.ambiguous.join('\n  ')}`)
console.log(`Ký hiệu lạ hoặc sai giọng (${report.odd.length}):\n  ${report.odd.join('\n  ')}`)
writeFileSync(join(cacheDir, 'ipa-result.json'), JSON.stringify(rows.map((r, i) => ({ rank: r[0], term: r[termAt], pos: r[posAt], ...result[i] })), null, 1))

if (write) {
  const extra = header.includes('ipa_us') ? 0 : 2
  const out = [extra ? [...header, 'ipa_us', 'ipa_uk'].join('|') : lines[0]]
  rows.forEach((r, i) => {
    const base = extra ? r : r.slice(0, header.indexOf('ipa_us'))
    out.push([...base, result[i].us, result[i].uk].join('|'))
  })
  writeFileSync(DATA, out.join('\n') + '\n')
  console.log('Đã ghi phiên âm vào file dữ liệu.')
}
