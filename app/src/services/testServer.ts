import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { SyncRemote } from './syncEngine'

/**
 * Máy chủ giả cho kiểm thử: Postgres trong bộ nhớ chạy đúng file migration của Supabase
 * (cột, kiểu, ràng buộc, trigger, RLS), truy vấn với quyền của từng người dùng như PostgREST.
 * Chỉ dùng trong test.
 */

const migration = (name: string) => fileURLToPath(new URL(`../../../supabase/migrations/${name}`, import.meta.url))
const INIT = migration('20261023000000_init.sql')
const AUDIO = migration('20261025000000_audio_storage.sql')
const REMINDERS = migration('20261026000000_reminders.sql')
const ACCOUNT = migration('20261027000000_account.sql')

/**
 * `audio: false` = máy chủ chưa chạy file SQL âm thanh (để thử đồng bộ vẫn chạy).
 * `reminders: true` = chạy thêm file SQL nhắc nhở (phần bảng và hàm; phần lịch chạy cần pg_cron của Supabase nên bỏ qua).
 * `account: true` = chạy thêm file SQL xóa tài khoản.
 */
export async function startTestServer({ audio = true, reminders = false, account = false }: { audio?: boolean; reminders?: boolean; account?: boolean } = {}): Promise<PGlite> {
  const pg = new PGlite()
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
  await pg.exec(readFileSync(INIT, 'utf8'))
  if (audio) {
    // Kho file của Supabase (schema storage) rút gọn, đủ để chạy file SQL âm thanh.
    await pg.exec(`
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    `)
    await pg.exec(readFileSync(AUDIO, 'utf8'))
  }
  if (reminders) {
    await pg.exec('create role service_role;')
    await pg.exec(readFileSync(REMINDERS, 'utf8').split('-- ==== LỊCH CHẠY')[0])
  }
  if (account) await pg.exec(readFileSync(ACCOUNT, 'utf8'))
  return pg
}

export async function addUser(pg: PGlite, id: string = crypto.randomUUID()): Promise<string> {
  await pg.query('insert into auth.users values ($1)', [id])
  return id
}

export async function asUser<T>(pg: PGlite, user: string, fn: () => Promise<T>): Promise<T> {
  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try {
    return await fn()
  } finally {
    await pg.exec('reset role;')
  }
}

/** Giống PostgREST upsert: chèn từ JSON, trùng khóa (`key`, mặc định id) thì cập nhật (hoặc bỏ qua). */
export function upsertAs(pg: PGlite, user: string, table: string, rows: Record<string, unknown>[], ignoreDuplicates = false, key = 'id') {
  const cols = Object.keys(rows[0])
  const list = cols.map((c) => `"${c}"`).join(', ')
  const onConflict = ignoreDuplicates ? 'do nothing' : `do update set ${cols.filter((c) => c !== key).map((c) => `"${c}" = excluded."${c}"`).join(', ')}`
  return asUser(pg, user, () =>
    pg.query(`insert into public.${table} (${list}) select ${list} from json_populate_recordset(null::public.${table}, $1) on conflict (${key}) ${onConflict}`, [
      JSON.stringify(rows),
    ]),
  )
}

/** Kênh đồng bộ nói chuyện với máy chủ giả, thay cho Supabase. */
export function testRemote(pg: PGlite, user: string): SyncRemote & { requests: number } {
  const remote = {
    requests: 0,
    async upsert(table: string, rows: Record<string, unknown>[], opts: { ignoreDuplicates: boolean; onConflict: string }) {
      remote.requests++
      if (rows.length > 0) await upsertAs(pg, user, table, rows, opts.ignoreDuplicates, opts.onConflict)
    },
    async pullPage(table: string, after: { ts: string; id: string }, limit: number, idColumn: string) {
      remote.requests++
      const res = await asUser(pg, user, () =>
        pg.query<{ row: Record<string, unknown> }>(
          `select to_jsonb(t) as row from public.${table} t
           where t.server_updated_at > $1::timestamptz or (t.server_updated_at = $1::timestamptz and t.${idColumn} > $2::uuid)
           order by t.server_updated_at, t.${idColumn} limit $3`,
          [after.ts, after.id, limit],
        ),
      )
      return res.rows.map((r) => r.row)
    },
  }
  return remote
}
