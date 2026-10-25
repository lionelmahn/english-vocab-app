import { STARTER_DECKS } from '../data/starter'
import { db } from '../db/db'
import { repo } from '../db/repo'

/**
 * Từ của bộ khởi đầu thêm trước bản 0.12.2 chưa có phiên âm: mỗi máy điền một lần (chỉ điền ô trống), rồi đồng bộ đi.
 * Sổ tay chưa có từ nào của bộ thì để lần sau kiểm tra lại, vì đồng bộ có thể mang từ cũ về sau.
 */

const DONE_KEY = 'starter-ipa-filled'
let running = false

function done(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return true
  }
}

export async function fillStarterIpa(): Promise<void> {
  if (running || done()) return
  running = true
  try {
    const sources = new Set(STARTER_DECKS.map((d) => d.source))
    const fromStarter = await db.vocabItems.filter((i) => i.deletedAt === null && !!i.source && sources.has(i.source)).toArray()
    if (fromStarter.length === 0) return
    if (fromStarter.some((i) => !i.ipaUs || !i.ipaUk)) {
      for (const deck of STARTER_DECKS) await repo.fillMissingIpa(await deck.load())
    }
    localStorage.setItem(DONE_KEY, '1')
  } catch (e) {
    // Không tải được dữ liệu bộ từ (mất mạng khi chưa lưu sẵn): lần mở app sau thử lại.
    console.warn('Chưa điền được phiên âm cho bộ từ khởi đầu', e)
  } finally {
    running = false
  }
}
