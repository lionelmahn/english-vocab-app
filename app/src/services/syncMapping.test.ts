import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CardStateRow, Deck, DeckItem, ReviewLogRow, VocabItem } from '../db/types'
import { cardStateToRemote, deckItemToRemote, deckToRemote, reviewLogToRemote, vocabItemToRemote } from './syncMapping'

/**
 * Kiểm tra dữ liệu app gửi lên khớp schema thật trên máy chủ (cột, kiểu, ràng buộc, RLS),
 * bằng cách chạy file migration trên Postgres trong bộ nhớ và chèn như PostgREST.
 */

const MIGRATION = fileURLToPath(new URL('../../../supabase/migrations/20261023000000_init.sql', import.meta.url))
const USER = '00000000-0000-0000-0000-0000000000aa'
let pg: PGlite

async function asUser<T>(fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${USER}', false);`)
  try {
    return await fn()
  } finally {
    await pg.exec('reset role;')
  }
}

/** Giống PostgREST upsert: chèn từ JSON, xung đột id thì cập nhật (hoặc bỏ qua). */
async function upsert(table: string, rows: Record<string, unknown>[], ignoreDuplicates = false) {
  const cols = Object.keys(rows[0])
  const list = cols.map((c) => `"${c}"`).join(', ')
  const onConflict = ignoreDuplicates ? 'do nothing' : `do update set ${cols.filter((c) => c !== 'id').map((c) => `"${c}" = excluded."${c}"`).join(', ')}`
  return asUser(() =>
    pg.query(`insert into public.${table} (${list}) select ${list} from json_populate_recordset(null::public.${table}, $1) on conflict (id) ${onConflict}`, [JSON.stringify(rows)]),
  )
}

const T = Date.parse('2026-10-24T08:00:00Z')
const item: VocabItem = {
  id: '10000000-0000-4000-8000-000000000001',
  term: 'resilient',
  termKey: 'resilient',
  partOfSpeech: 'adjective',
  meaningVi: 'kiên cường',
  ipaUs: '/rɪˈzɪliənt/',
  examples: [{ en: 'Kids are resilient.', vi: 'Trẻ em rất kiên cường.' }],
  acceptedAnswers: ['resiliant'],
  tags: ['ielts', 'Công việc'],
  favorite: true,
  difficult: false,
  archived: false,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
}
const deck: Deck = { id: '20000000-0000-4000-8000-000000000001', name: 'IELTS', active: true, archived: false, createdAt: T, updatedAt: T, deletedAt: null }
const link: DeckItem = { id: '30000000-0000-4000-8000-000000000001', deckId: deck.id, itemId: item.id, position: 0, createdAt: T, updatedAt: T, deletedAt: null }
const card: CardStateRow = {
  id: item.id,
  itemId: item.id,
  due: T + 3 * 86_400_000,
  stability: 3.17,
  difficulty: 5.28,
  scheduledDays: 3,
  learningSteps: 0,
  reps: 2,
  lapses: 0,
  state: 2,
  lastReview: T,
  suspended: false,
  createdAt: T,
  updatedAt: T,
  deletedAt: null,
}
const log: ReviewLogRow = {
  id: '40000000-0000-4000-8000-000000000001',
  itemId: item.id,
  sessionId: '50000000-0000-4000-8000-000000000001',
  reviewedAt: T,
  mode: 'review',
  exercise: 'recall_typing',
  grade: 3,
  correct: true,
  hintLevel: 0,
  responseMs: 2300,
  affectsSchedule: true,
  deviceId: 'device-1',
  createdAt: T,
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create role authenticated;
    create role anon;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `)
  await pg.exec(readFileSync(MIGRATION, 'utf8'))
  await pg.exec(`insert into auth.users values ('${USER}');`)
}, 60_000)

describe('dữ liệu gửi lên khớp schema máy chủ', () => {
  it('chèn đủ 5 bảng theo thứ tự gửi, gắn đúng người dùng', async () => {
    await upsert('vocab_items', [vocabItemToRemote(item)])
    await upsert('decks', [deckToRemote(deck)])
    await upsert('deck_items', [deckItemToRemote(link)])
    await upsert('card_states', [cardStateToRemote(card)])
    await upsert('review_logs', [reviewLogToRemote(log)], true)

    const row = (await pg.query<{ user_id: string; tags: string[]; examples: unknown; accepted_answers: string[] }>(
      `select user_id, tags, examples, accepted_answers from public.vocab_items where id = '${item.id}'`,
    )).rows[0]
    expect(row.user_id).toBe(USER)
    expect(row.tags).toEqual(['ielts', 'Công việc'])
    expect(row.accepted_answers).toEqual(['resiliant'])
    expect(row.examples).toEqual([{ en: 'Kids are resilient.', vi: 'Trẻ em rất kiên cường.' }])
    const due = (await pg.query<{ due: Date }>(`select due from public.card_states where id = '${item.id}'`)).rows[0].due
    expect(new Date(due).getTime()).toBe(card.due)
  })

  it('sửa rồi gửi lại thì cập nhật, không tạo dòng mới', async () => {
    await upsert('vocab_items', [vocabItemToRemote({ ...item, meaningVi: 'mau phục hồi', updatedAt: T + 1000 })])
    const rows = (await pg.query<{ meaning_vi: string }>(`select meaning_vi from public.vocab_items`)).rows
    expect(rows).toEqual([{ meaning_vi: 'mau phục hồi' }])
  })

  it('gửi lại lượt trả lời không bị nhân đôi', async () => {
    await upsert('review_logs', [reviewLogToRemote(log)], true)
    await upsert('review_logs', [reviewLogToRemote(log)], true)
    expect((await pg.query<{ n: number }>('select count(*)::int as n from public.review_logs')).rows[0].n).toBe(1)
  })

  it('xóa mềm được gửi lên như một lần cập nhật', async () => {
    await upsert('deck_items', [deckItemToRemote({ ...link, deletedAt: T + 5000, updatedAt: T + 5000 })])
    const r = (await pg.query<{ deleted_at: Date | null }>(`select deleted_at from public.deck_items where id = '${link.id}'`)).rows[0]
    expect(r.deleted_at).not.toBeNull()
  })
})
