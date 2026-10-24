import { POS_ORDER, type PartOfSpeech } from '../../core/pos'
import type { ItemInput } from '../../db/repo'

/**
 * Bộ từ khởi đầu (R1.7): danh sách soạn sẵn để học ngay, không phải tự nhập.
 * Nội dung dài nên mỗi bộ chỉ được tải (thành một gói riêng) khi người học chọn thêm.
 */

export interface StarterDeck {
  id: string
  /** Tên bộ từ tạo trong sổ tay. */
  name: string
  description: string
  count: number
  /** Ghi nguồn theo giấy phép. */
  attribution: string
  load: () => Promise<ItemInput[]>
}

const NGSL_SOURCE = 'NGSL 1.2 (CC BY-SA 4.0)'

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: 'ngsl-1000',
    name: '1.000 từ thông dụng nhất',
    description: '1.000 từ xuất hiện nhiều nhất trong tiếng Anh hằng ngày, học từ phổ biến nhất trở đi. Mỗi từ có nghĩa chính, loại từ, câu ví dụ và bản dịch.',
    count: 1000,
    attribution:
      'Danh sách từ: New General Service List 1.2 của C. Browne, B. Culligan và J. Phillips (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Nghĩa tiếng Việt và câu ví dụ do app soạn, cùng giấy phép.',
    load: async () => parseStarter((await import('./ngsl-1000.txt?raw')).default, NGSL_SOURCE),
  },
]

/**
 * Đọc file bộ từ: mỗi dòng `hạng|từ|loại từ|nghĩa|câu ví dụ|dịch câu ví dụ` (dòng đầu là tiêu đề).
 * Giữ đúng thứ tự trong file để học từ phổ biến nhất trước.
 */
export function parseStarter(text: string, source: string): ItemInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  return lines.slice(1).map((line) => {
    const [, term, pos, meaningVi, example, exampleVi] = line.split('|')
    return {
      term: term.trim(),
      partOfSpeech: POS_ORDER.includes(pos as PartOfSpeech) ? (pos as PartOfSpeech) : 'other',
      meaningVi: meaningVi.trim(),
      examples: example ? [{ en: example.trim(), vi: exampleVi?.trim() || undefined }] : [],
      acceptedAnswers: [],
      source,
      tags: [],
      favorite: false,
      difficult: false,
    }
  })
}
