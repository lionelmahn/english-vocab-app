import { englishSection, parseDefinitions, parsePronunciation, parseVietnamese, type DictEntry } from '../core/dictionary'
import { termKey } from '../core/vocab'
import { db, type VocabDatabase } from '../db/db'

/**
 * Tra từ và cụm từ (R15.1) trên Wiktionary (CC BY-SA, miễn phí, gọi thẳng từ trình duyệt):
 * nghĩa và ví dụ từ REST API, phiên âm và gợi ý nghĩa tiếng Việt từ mã nguồn trang.
 * Kết quả được lưu trên máy để tra lại không tốn mạng.
 */

const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/'
const API = 'https://en.wiktionary.org/w/api.php'
/** Kết quả tìm thấy giữ 30 ngày; không tìm thấy thì 1 ngày (Wiktionary được bổ sung dần). */
const FOUND_TTL = 30 * 86_400_000
const MISSING_TTL = 86_400_000
/** Tăng khi đổi cách đọc dữ liệu từ điển, để kết quả cũ trên máy được tra lại. */
const PARSER_VERSION = 2

export type LookupResult =
  | { status: 'found'; entry: DictEntry }
  | { status: 'not_found'; suggestions: string[] }
  | { status: 'offline' }
  | { status: 'error'; message: string }

/** Lấy JSON; trả null khi không có trang (404). Lỗi khác thì ném lỗi. */
export type FetchJson = (url: string) => Promise<unknown | null>

async function fetchJson(url: string): Promise<unknown | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(res.status === 429 ? 'Từ điển đang bận, thử lại sau ít phút.' : `Lỗi từ điển (${res.status}).`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/** Chuẩn hóa chữ người dùng gõ: bỏ khoảng trắng thừa, nháy cong thành nháy thẳng. */
export function cleanQuery(input: string): string {
  return input.trim().replace(/\s+/g, ' ').replace(/[‘’]/g, "'")
}

/** Tiêu đề trang thử lần lượt: chữ thường trước (Wiktionary phân biệt hoa thường), rồi đúng như gõ. */
function candidateTitles(q: string): string[] {
  return [...new Set([q.toLowerCase(), q])]
}

const pageTitle = (title: string) => encodeURIComponent(title.replace(/ /g, '_'))

export function createDictionary(database: VocabDatabase, get: FetchJson = fetchJson, isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false) {
  /** Phần English trong mã nguồn trang (để lấy phiên âm và bảng dịch). Lỗi thì bỏ qua, vẫn có nghĩa. */
  async function englishWikitext(title: string): Promise<string> {
    try {
      const sections = (await get(`${API}?action=parse&page=${pageTitle(title)}&prop=sections&format=json&formatversion=2&origin=*`)) as {
        parse?: { sections?: { index: string; line: string; toclevel: number }[] }
      } | null
      const index = sections?.parse?.sections?.find((s) => s.toclevel === 1 && s.line === 'English')?.index
      if (!index) return ''
      const page = (await get(`${API}?action=parse&page=${pageTitle(title)}&section=${index}&prop=wikitext&format=json&formatversion=2&origin=*`)) as {
        parse?: { wikitext?: string }
      } | null
      return englishSection(page?.parse?.wikitext ?? '')
    } catch {
      return ''
    }
  }

  /** Từ gần giống để gợi ý khi không tìm thấy (R15.5): tìm gần đúng, bắt được lỗi chính tả ("resilent" → "resilient"). */
  async function suggestionsFor(q: string): Promise<string[]> {
    try {
      const res = (await get(`${API}?action=opensearch&search=${encodeURIComponent(q)}&limit=8&namespace=0&profile=fuzzy&format=json&origin=*`)) as [string, string[]] | null
      const self = q.toLowerCase()
      return [...new Set((res?.[1] ?? []).filter((t) => !!t && !t.includes(':') && t.toLowerCase() !== self))].slice(0, 6)
    } catch {
      return []
    }
  }

  async function fetchEntry(q: string): Promise<DictEntry | null> {
    for (const title of candidateTitles(q)) {
      const json = await get(`${REST}${pageTitle(title)}`)
      if (!json) continue
      const groups = parseDefinitions(json, title)
      if (groups.length === 0) continue
      const wikitext = await englishWikitext(title)
      const { ipa, byPos } = parsePronunciation(wikitext, title)
      return { title, ipa, ipaByPos: byPos, groups, vietnamese: parseVietnamese(wikitext, title) }
    }
    return null
  }

  return {
    async lookup(input: string, now = Date.now()): Promise<LookupResult> {
      const q = cleanQuery(input)
      const key = termKey(q)
      if (!key) return { status: 'not_found', suggestions: [] }
      const cached = await database.dictionary.get(key)
      const fresh = cached && cached.parser === PARSER_VERSION && now - cached.fetchedAt < (cached.entry ? FOUND_TTL : MISSING_TTL)
      if (cached && (fresh || !isOnline())) {
        return cached.entry ? { status: 'found', entry: cached.entry } : { status: 'not_found', suggestions: cached.suggestions }
      }
      if (!isOnline()) return { status: 'offline' }
      try {
        const entry = await fetchEntry(q)
        const suggestions = entry ? [] : await suggestionsFor(q)
        await database.dictionary.put({ key, entry, suggestions, fetchedAt: now, parser: PARSER_VERSION })
        return entry ? { status: 'found', entry } : { status: 'not_found', suggestions }
      } catch (e) {
        if (cached?.entry) return { status: 'found', entry: cached.entry }
        const err = e as Error
        const message =
          err.name === 'AbortError'
            ? 'Từ điển phản hồi quá lâu, thử lại sau.'
            : err instanceof TypeError
              ? 'Không kết nối được tới từ điển. Kiểm tra mạng rồi thử lại.'
              : err.message
        return isOnline() ? { status: 'error', message } : { status: 'offline' }
      }
    },
  }
}

export const dictionary = createDictionary(db)
