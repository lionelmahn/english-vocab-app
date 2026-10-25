import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addUser, asUser, startTestServer } from './testServer'

/** File SQL xóa tài khoản chạy trên Postgres thật: xóa đúng người đang gọi cùng mọi dữ liệu, không ai khác gọi được. */

let pg: PGlite
let me: string
let other: string

beforeAll(async () => {
  pg = await startTestServer({ reminders: true, account: true })
  ;[me, other] = [await addUser(pg), await addUser(pg)]
  for (const user of [me, other]) {
    const id = crypto.randomUUID()
    await pg.query(`insert into public.vocab_items (id, user_id, term, term_key, meaning_vi, created_at, updated_at) values ($1, $2, 'run', 'run', 'chạy', now(), now())`, [id, user])
    await pg.query(`insert into public.card_states (id, user_id, due, created_at, updated_at) values ($1, $2, now(), now(), now())`, [id, user])
    await pg.query(
      `insert into public.review_logs (id, user_id, item_id, session_id, reviewed_at, mode, exercise, affects_schedule, device_id, created_at)
       values ($1, $2, $3, $1, now(), 'review', 'mcq_meaning', true, 'd1', now())`,
      [crypto.randomUUID(), user, id],
    )
    await pg.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [user, `https://push.example/${user}`])
  }
}, 60_000)

afterAll(async () => {
  await pg.close()
})

const count = async (table: string, user: string) => Number((await pg.query<{ n: number }>(`select count(*)::int as n from public.${table} where user_id = $1`, [user])).rows[0].n)

describe('delete_my_account() (R1.6)', () => {
  it('khách chưa đăng nhập không gọi được; đăng nhập mà thiếu mã người dùng thì báo lỗi', async () => {
    await pg.exec('set role anon')
    await expect(pg.query('select public.delete_my_account()')).rejects.toThrow(/permission denied/)
    await pg.exec('reset role')
    await expect(asUser(pg, '', () => pg.query('select public.delete_my_account()'))).rejects.toThrow(/Chưa đăng nhập/)
  })

  it('xóa tài khoản đang đăng nhập cùng mọi dữ liệu; tài khoản khác giữ nguyên', async () => {
    for (const t of ['profiles', 'vocab_items', 'card_states', 'review_logs', 'push_subscriptions']) expect(await count(t, me), t).toBe(1)
    await asUser(pg, me, () => pg.query('select public.delete_my_account()'))
    expect((await pg.query('select id from auth.users where id = $1', [me])).rows).toHaveLength(0)
    for (const t of ['profiles', 'vocab_items', 'card_states', 'review_logs', 'push_subscriptions']) {
      expect(await count(t, me), t).toBe(0)
      expect(await count(t, other), t).toBe(1)
    }
  })
})
