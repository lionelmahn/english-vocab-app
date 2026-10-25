import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decideReminder, type ReminderTarget } from '../../../supabase/functions/send-reminders/index.ts'
import { addUser, asUser, startTestServer } from './testServer'

/** File SQL nhắc nhở chạy trên Postgres thật: hàm reminder_targets() đưa đúng dữ liệu cho Edge Function, quyền đúng. */

let pg: PGlite
let u1: string
let u2: string
// 20:05 Chủ nhật 25/10/2026 giờ Việt Nam.
const NOW = '2026-10-25T13:05:00Z'

beforeAll(async () => {
  pg = await startTestServer({ reminders: true })
  // u3 có tài khoản nhưng không đăng ký máy nào nhận thông báo.
  ;[u1, u2] = [await addUser(pg), await addUser(pg), await addUser(pg)]
  const item = async (user: string, term: string, extra = '') => {
    const id = crypto.randomUUID()
    await pg.query(
      `insert into public.vocab_items (id, user_id, term, term_key, meaning_vi, created_at, updated_at${extra ? ', ' + extra.split('=')[0] : ''})
       values ($1, $2, $3, $3, 'nghĩa', now(), now()${extra ? ', ' + extra.split('=')[1] : ''})`,
      [id, user, term],
    )
    return id
  }
  const card = (user: string, id: string, due: string, deleted = false) =>
    pg.query(`insert into public.card_states (id, user_id, due, created_at, updated_at, deleted_at) values ($1, $2, $3, now(), now(), $4)`, [id, user, due, deleted ? new Date().toISOString() : null])

  // u1: hồ sơ đầy đủ; 2 từ đến hạn hợp lệ, 1 từ lưu trữ, 1 từ đã xóa, 1 lịch đã xóa, 1 từ chưa đến hạn.
  // Hồ sơ được tạo sẵn khi có tài khoản (trigger trong file SQL đầu tiên); u1 cập nhật lịch học và tùy chọn nhắc.
  await pg.query(`update public.profiles set time_zone = 'Asia/Ho_Chi_Minh', study_weekdays = '{1,2,3,4,5}', settings = $2 where user_id = $1`, [
    u1,
    JSON.stringify({ studyTime: '20:00', reviewLimit: 50, reminders: { dueMin: 2, duePerDay: 3 } }),
  ])
  const a = await item(u1, 'a')
  const b = await item(u1, 'b')
  const archived = await item(u1, 'c', 'archived=true')
  const deleted = await item(u1, 'd', 'deleted_at=now()')
  const cardGone = await item(u1, 'e')
  const later = await item(u1, 'f')
  await card(u1, a, '2026-10-25T10:00:00Z')
  await card(u1, b, '2026-10-25T13:00:00Z')
  await card(u1, archived, '2026-10-24T00:00:00Z')
  await card(u1, deleted, '2026-10-24T00:00:00Z')
  await card(u1, cardGone, '2026-10-24T00:00:00Z', true)
  await card(u1, later, '2026-10-26T00:00:00Z')
  await pg.query(
    `insert into public.review_logs (id, user_id, item_id, session_id, reviewed_at, mode, exercise, affects_schedule, device_id, created_at)
     values ($1, $2, $3, $1, '2026-10-24T14:00:00Z', 'review', 'mcq_meaning', true, 'd1', now())`,
    [crypto.randomUUID(), u1, a],
  )
  // Hôm nay (ngày học 25/10) đã nhắc ôn một lần lúc 15:00; hôm qua nhắc giờ học (không tính cho hôm nay).
  await pg.query(`insert into public.reminder_log (user_id, kind, study_day, sent_at) values ($1, 'due', '2026-10-25', '2026-10-25T08:00:00Z'), ($1, 'study', '2026-10-24', '2026-10-24T13:00:00Z')`, [u1])
  // u1 có hai máy, u2 một máy (hồ sơ mặc định), u3 không đăng ký máy nào.
  for (const [user, endpoint] of [
    [u1, 'https://web.push.apple.com/one'],
    [u1, 'https://fcm.googleapis.com/fcm/send/two'],
    [u2, 'https://web.push.apple.com/three'],
  ])
    await pg.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [user, endpoint])
}, 60_000)

afterAll(async () => {
  await pg.close()
})

const targets = async (user: string | null = null) =>
  (await pg.query<ReminderTarget>('select * from public.reminder_targets($1, $2)', [NOW, user])).rows

describe('reminder_targets()', () => {
  it('chỉ người có máy đăng ký; đếm đúng từ đến hạn, lần học cuối và số lần đã nhắc hôm nay', async () => {
    const rows = await targets()
    expect(rows.map((r) => r.user_id).sort()).toEqual([u1, u2].sort())
    const one = rows.find((r) => r.user_id === u1)!
    expect(one).toMatchObject({
      time_zone: 'Asia/Ho_Chi_Minh',
      study_time: '20:00',
      study_weekdays: [1, 2, 3, 4, 5],
      prefs: { dueMin: 2, duePerDay: 3 },
      due_count: 2,
      sent_study_today: 0,
      sent_due_today: 1,
    })
    expect(new Date(one.last_review_at!).toISOString()).toBe('2026-10-24T14:00:00.000Z')
    expect(new Date(one.last_sent_at!).toISOString()).toBe('2026-10-25T08:00:00.000Z')
    expect(one.subscriptions!.map((s) => s.endpoint).sort()).toEqual(['https://fcm.googleapis.com/fcm/send/two', 'https://web.push.apple.com/one'])
    // Hồ sơ mặc định: múi giờ Việt Nam, chưa đặt giờ học, tùy chọn nhắc mặc định.
    expect(rows.find((r) => r.user_id === u2)).toMatchObject({ time_zone: 'Asia/Ho_Chi_Minh', study_time: null, prefs: {}, due_count: 0, subscriptions: [expect.objectContaining({ endpoint: 'https://web.push.apple.com/three' })] })
  })

  it('kết quả dùng được ngay cho quyết định nhắc', async () => {
    const one = (await targets(u1))[0]
    // Chủ nhật không phải ngày học của u1 nên không nhắc giờ học; nhắc ôn vì đủ 2 từ, cách lần trước hơn 3 tiếng.
    expect(decideReminder(one, Date.parse(NOW))).toMatchObject({ kind: 'due', body: '2 từ đang chờ ôn. Ôn lúc này là nhớ lâu nhất.' })
  })

  it('người dùng thường không gọi được hàm, chỉ thấy máy đăng ký của mình', async () => {
    await expect(asUser(pg, u2, () => pg.query('select * from public.reminder_targets()'))).rejects.toThrow(/permission denied/)
    const mine = await asUser(pg, u2, async () => (await pg.query<{ endpoint: string }>('select endpoint from public.push_subscriptions')).rows)
    expect(mine.map((r) => r.endpoint)).toEqual(['https://web.push.apple.com/three'])
    // Không thêm được máy đăng ký cho người khác.
    await expect(
      asUser(pg, u2, () => pg.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.test/1', 'k', 'a')`, [u1])),
    ).rejects.toThrow(/row-level security/)
  })
})
