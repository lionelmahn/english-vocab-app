// Lấy phiên âm Anh–Mỹ và Anh–Anh từ Wiktionary (CC BY-SA) cho từ của một khóa học mới, dùng đúng bộ đọc phiên âm của app.
// Chạy: npx esbuild scripts/course-ipa.ts --bundle --platform=node --format=esm --outfile=<thư mục tạm>/course-ipa.mjs
//       node <thư mục tạm>/course-ipa.mjs <plan.json của khóa> <thư mục đệm>
// Ghi ipa.json cạnh plan.json: { "từ|loại từ": { "us": "/…/", "uk": "/…/" } }, và in báo cáo từ thiếu phiên âm.
// Lấy nội dung 50 trang mỗi lần (nghỉ giữa các lần, có User-Agent theo quy định của Wikimedia), lưu đệm để chạy lại không tải lại.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { englishSection, parsePronunciation, type Ipa } from '../src/core/dictionary'
import type { PartOfSpeech } from '../src/core/pos'

const API = 'https://en.wiktionary.org/w/api.php'
const UA = 'EnglishVocabApp/0.36 (https://english-vocab.lionelmahn.workers.dev; personal vocabulary app; course IPA script)'
const planFile = process.argv[2]
const cacheDir = process.argv[3]
if (!planFile || !cacheDir) throw new Error('Cách chạy: course-ipa.mjs <plan.json> <thư mục đệm>')
mkdirSync(cacheDir, { recursive: true })
const cacheFile = join(cacheDir, 'wiktionary-pages.json')

type PlanWord = { term: string; pos: PartOfSpeech }
const plan = JSON.parse(readFileSync(planFile, 'utf8')) as { lessons: { words: PlanWord[] }[] }[]
const words = plan.flatMap((ch) => ch.lessons.flatMap((l) => l.words))
const terms = [...new Set(words.map((w) => w.term))]

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

// Chỉ có một giọng mà phiên âm không có âm nào khác nhau giữa hai giọng: dùng cho cả hai (như script của bộ 1.000 từ).
const SAME_BOTH = /[ɑɒɔɜɝɚæː]|oʊ|əʊ|eə|ɪə|ʊə|r(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ])/
const ALLOWED = /^\/[pbtdkɡfvθðszʃʒhmnŋlrjwiɪeɛæʌɑɒɔʊuɜɝəɚaoˈˌ.ː ]+\/$/
const odd = (v: string, accent: 'us' | 'uk') =>
  !ALLOWED.test(v) || (accent === 'uk' ? /ɚ|ɝ|oʊ|r(?![.ˈˌ]?[aeiouæɑɒɔəɛɜɪʊʌ])/.test(v) : /ɒ|əʊ|ɜ|[eɛ]ə|ː/.test(v))

const out: Record<string, { us: string; uk: string }> = {}
const report = { full: 0, onlyOne: [] as string[], none: [] as string[], odd: [] as string[] }
for (const w of words) {
  const text = pages[w.term]
  let chosen: Ipa = {}
  if (text) {
    const { ipa, byPos } = parsePronunciation(englishSection(text), w.term)
    chosen = byPos[w.pos] ?? ipa
    if (!chosen.uk && chosen.us && !SAME_BOTH.test(chosen.us)) chosen = { ...chosen, uk: chosen.us }
    if (!chosen.us && chosen.uk && !SAME_BOTH.test(chosen.uk)) chosen = { ...chosen, us: chosen.uk }
  }
  // Phiên âm có ký hiệu lạ hoặc sai giọng thì bỏ (app tự tra lại khi mở từ) chứ không ghi sai vào khóa.
  const us = chosen.us && !odd(chosen.us, 'us') ? chosen.us : ''
  const uk = chosen.uk && !odd(chosen.uk, 'uk') ? chosen.uk : ''
  if ((chosen.us && !us) || (chosen.uk && !uk)) report.odd.push(`${w.term} (${w.pos}): ${chosen.us ?? '—'} | ${chosen.uk ?? '—'}`)
  if (us && uk) report.full++
  else if (us || uk) report.onlyOne.push(`${w.term} (${w.pos})`)
  else report.none.push(`${w.term} (${w.pos})`)
  out[`${w.term}|${w.pos}`] = { us, uk }
}
writeFileSync(join(dirname(planFile), 'ipa.json'), JSON.stringify(out, null, 1))
console.log(`\nĐủ cả Mỹ và Anh: ${report.full}/${words.length}`)
console.log(`Chỉ một giọng (${report.onlyOne.length}): ${report.onlyOne.join(', ')}`)
console.log(`Không có (${report.none.length}): ${report.none.join(', ')}`)
console.log(`Bỏ vì ký hiệu lạ (${report.odd.length}): ${report.odd.join('; ')}`)
