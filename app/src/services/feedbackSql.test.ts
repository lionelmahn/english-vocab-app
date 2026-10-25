import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addUser, asUser, startTestServer, upsertAs } from './testServer'

/** Báo lỗi (R14.4) gửi vào bảng feedback_reports như app gửi: chỉ thêm, gửi lại không nhân đôi, chỉ người gửi đọc được. */

let pg: PGlite
let me: string
let other: string

beforeAll(async () => {
  pg = await startTestServer()
  ;[me, other] = [await addUser(pg), await addUser(pg)]
}, 60_000)

afterAll(async () => {
  await pg.close()
})

const report = (id: string, kind = 'content') => ({ id, kind, message: 'Nghĩa của từ "run" bị sai', context: { version: '0.24.0', itemId: 'x' }, created_at: '2026-10-25T10:00:00Z' })

describe('feedback_reports', () => {
  it('gửi được, gửi lại cùng mã thì bỏ qua, người khác không đọc được', async () => {
    const id = crypto.randomUUID()
    await upsertAs(pg, me, 'feedback_reports', [report(id)], true)
    await upsertAs(pg, me, 'feedback_reports', [report(id)], true)
    const mine = await asUser(pg, me, () => pg.query<{ user_id: string; kind: string; status: string }>('select user_id, kind, status from public.feedback_reports'))
    expect(mine.rows).toEqual([{ user_id: me, kind: 'content', status: 'open' }])
    const theirs = await asUser(pg, other, () => pg.query('select id from public.feedback_reports'))
    expect(theirs.rows).toHaveLength(0)
  })

  it('loại báo cáo phải hợp lệ', async () => {
    await expect(upsertAs(pg, me, 'feedback_reports', [report(crypto.randomUUID(), 'spam')], true)).rejects.toThrow()
  })
})
