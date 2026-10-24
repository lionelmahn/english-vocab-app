import type { LibCard } from '../core/library'
import { itemLevel } from '../core/library'
import { LEVEL_LABELS } from '../core/levels'
import type { Deck, DeckItem, VocabItem } from '../db/types'

/**
 * Xuất từ vựng ra CSV (R11.3, phần "xuất nội dung"): mở được bằng Excel/Google Sheets và nhập lại được vào app
 * (các cột trùng tên với file mẫu của trang Nhập từ file, R11.2). Thêm vài cột tiến độ chỉ để xem.
 */

export interface ExportSource {
  items: readonly VocabItem[]
  decks: readonly Deck[]
  deckItems: readonly DeckItem[]
  cards: ReadonlyMap<string, LibCard>
}

export interface ExportOptions {
  /** Chỉ xuất từ thuộc bộ này; bỏ trống = mọi từ. */
  deckId?: string
  /** Gồm cả từ đã lưu trữ. */
  includeArchived: boolean
}

const COLUMNS = [
  'term',
  'part_of_speech',
  'meaning_vi',
  'meaning_en',
  'ipa_us',
  'ipa_uk',
  'example',
  'example_vi',
  'tags',
  'deck',
  'note',
  'level',
  'next_review',
  'favorite',
  'difficult',
  'archived',
] as const

/** Ô CSV: bọc nháy kép khi có dấu phẩy, nháy kép hoặc xuống dòng. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function isoDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Các dòng đã chọn, theo thứ tự thêm vào sổ tay. */
export function exportRows(src: ExportSource, opts: ExportOptions): string[][] {
  const liveLinks = src.deckItems.filter((l) => l.deletedAt === null)
  const deckName = new Map(src.decks.filter((d) => d.deletedAt === null).map((d) => [d.id, d.name]))
  const decksOf = new Map<string, string[]>()
  for (const l of [...liveLinks].sort((a, b) => a.position - b.position)) {
    const name = deckName.get(l.deckId)
    if (!name) continue
    const list = decksOf.get(l.itemId)
    if (list) list.push(name)
    else decksOf.set(l.itemId, [name])
  }
  const inDeck = opts.deckId ? new Set(liveLinks.filter((l) => l.deckId === opts.deckId).map((l) => l.itemId)) : null
  const chosenDeck = opts.deckId ? deckName.get(opts.deckId) : undefined

  return src.items
    .filter((i) => i.deletedAt === null && (opts.includeArchived || !i.archived) && (!inDeck || inDeck.has(i.id)))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((i) => {
      const card = src.cards.get(i.id)
      const live = card && card.deletedAt === null ? card : undefined
      // Cột "deck" chỉ nhận một bộ khi nhập lại: lấy bộ đang xuất, hoặc bộ đầu tiên của từ.
      const deck = chosenDeck ?? decksOf.get(i.id)?.[0] ?? ''
      const row: Record<(typeof COLUMNS)[number], string> = {
        term: i.term,
        part_of_speech: i.partOfSpeech,
        meaning_vi: i.meaningVi,
        meaning_en: i.meaningEn ?? '',
        ipa_us: i.ipaUs ?? '',
        ipa_uk: i.ipaUk ?? '',
        example: i.examples[0]?.en ?? '',
        example_vi: i.examples[0]?.vi ?? '',
        tags: i.tags.join(', '),
        deck,
        note: i.note ?? '',
        level: LEVEL_LABELS[itemLevel(live)],
        next_review: live && !live.suspended ? isoDate(live.due) : '',
        favorite: i.favorite ? 'x' : '',
        difficult: i.difficult ? 'x' : '',
        archived: i.archived ? 'x' : '',
      }
      return COLUMNS.map((c) => row[c])
    })
}

/** Nội dung file CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt, xuống dòng CRLF). */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return '﻿' + [COLUMNS as readonly string[], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** tu-vung-2026-10-24.csv, hoặc tu-vung-ielts-2026-10-24.csv khi xuất một bộ. */
export function exportFileName(deck: string | undefined, now = Date.now()): string {
  const slug = deck
    ? '-' +
      deck
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
    : ''
  return `tu-vung${slug}-${isoDate(now)}.csv`
}
