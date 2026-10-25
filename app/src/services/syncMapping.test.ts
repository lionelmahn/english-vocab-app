import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { PROFILE_ID, type CardStateRow, type Deck, type DeckItem, type Profile, type ReviewLogRow, type VocabItem } from '../db/types'
import { cardStateToRemote, deckItemToRemote, deckToRemote, fromRemote, profileToRemote, reviewLogToRemote, toMs, vocabItemToRemote } from './syncMapping'
import { addUser, startTestServer, upsertAs } from './testServer'

/**
 * Kiểm tra dữ liệu app gửi lên khớp schema thật trên máy chủ (cột, kiểu, ràng buộc, RLS),
 * bằng cách chạy file migration trên Postgres trong bộ nhớ và chèn như PostgREST.
 */

const USER = '00000000-0000-0000-0000-0000000000aa'
let pg: PGlite

const upsert = (table: string, rows: Record<string, unknown>[], ignoreDuplicates = false) => upsertAs(pg, USER, table, rows, ignoreDuplicates)

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
  pg = await startTestServer()
  await addUser(pg, USER)
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

describe('dữ liệu kéo về đổi lại đúng như trên thiết bị', () => {
  const read = async (table: string, id: string) =>
    (await pg.query<{ row: Record<string, unknown> }>(`select to_jsonb(t) as row from public.${table} t where id = $1`, [id])).rows[0].row

  it('từ, bộ, liên kết, lịch ôn và lượt trả lời giữ nguyên sau một vòng lên rồi về', async () => {
    const edited = { ...item, meaningVi: 'kiên cường', note: 'ghi chú', updatedAt: T + 9000 }
    await upsert('vocab_items', [vocabItemToRemote(edited)])
    await upsert('decks', [deckToRemote({ ...deck, description: 'Từ học thuật', dailyGoal: 15 })])
    await upsert('deck_items', [deckItemToRemote(link)])
    await upsert('card_states', [cardStateToRemote(card)])
    expect(fromRemote('vocabItems', await read('vocab_items', item.id))).toEqual({
      ...edited,
      meaningEn: undefined,
      ipaUk: undefined,
      mnemonic: undefined,
      source: undefined,
    })
    expect(fromRemote('decks', await read('decks', deck.id))).toEqual({ ...deck, description: 'Từ học thuật', topic: undefined, dailyGoal: 15 })
    expect(fromRemote('deckItems', await read('deck_items', link.id))).toEqual(link)
    expect(fromRemote('cardStates', await read('card_states', card.id))).toEqual(card)
    expect(fromRemote('reviewLogs', await read('review_logs', log.id))).toEqual(log)
  })

  it('hồ sơ: cột riêng và ô settings giữ nguyên sau một vòng lên rồi về', async () => {
    const profile: Profile = {
      id: PROFILE_ID,
      displayName: 'Mạnh',
      avatarUrl: 'data:image/jpeg;base64,AAAA',
      selfLevel: 'upper_intermediate',
      learningPurpose: 'Công việc',
      dailyMinutes: 30,
      studyWeekdays: [1, 2, 3, 4, 5],
      studyTime: '21:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      reminders: { study: false, due: true, dueMin: 20, duePerDay: 1, quietStart: '23:00', quietEnd: '06:30' },
      accent: 'uk',
      dailyNewWords: 15,
      reviewLimit: 100,
      reviewStyle: 'flashcard',
      flashcardFront: 'meaning',
      showTranslations: true,
      autoPlay: false,
      preferRecordings: false,
      speechSpeed: 'slow',
      createdAt: T,
      updatedAt: T + 1000,
      deletedAt: null,
    }
    await upsertAs(pg, USER, 'profiles', [profileToRemote(profile, USER)], false, 'user_id')
    const row = (await pg.query<{ row: Record<string, unknown> }>(`select to_jsonb(t) as row from public.profiles t where user_id = $1`, [USER])).rows[0].row
    expect(fromRemote('profiles', row)).toEqual(profile)
  })

  it('hồ sơ mặc định do máy chủ tạo đọc ra giá trị mặc định của app', async () => {
    const other = '00000000-0000-0000-0000-0000000000bb'
    await addUser(pg, other)
    const row = (await pg.query<{ row: Record<string, unknown> }>(`select to_jsonb(t) as row from public.profiles t where user_id = $1`, [other])).rows[0].row
    expect(fromRemote('profiles', row)).toMatchObject({ displayName: '', dailyNewWords: 10, dailyMinutes: 15, studyWeekdays: [0, 1, 2, 3, 4, 5, 6], accent: 'us', reviewLimit: 50 })
  })

  it('đọc được mốc thời gian có micro giây của máy chủ', () => {
    expect(toMs('2026-10-24T08:00:00.123456+00:00')).toBe(Date.parse('2026-10-24T08:00:00.123Z'))
    expect(toMs('2026-10-24T15:00:00+07:00')).toBe(Date.parse('2026-10-24T08:00:00Z'))
  })
})
