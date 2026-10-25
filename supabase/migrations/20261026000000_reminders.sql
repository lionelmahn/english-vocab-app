-- EnglishVocab — nhắc học và nhắc ôn qua Web Push (R9.3, R9.4, R9.6)
-- Chạy sau các file trước. Chạy lại nhiều lần cũng an toàn.
-- Trước khi chạy, tạo hai bí mật trong Vault và Edge Function "send-reminders" (xem docs/CAI_DAT_NHAC_NHO.md).

-- Các máy nhận thông báo của mỗi người ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions: own" on public.push_subscriptions;
create policy "push_subscriptions: own" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Nhật ký đã nhắc (để giới hạn số lần mỗi ngày) ---------------------------------------------------
create table if not exists public.reminder_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('study', 'due')),
  study_day date not null,
  sent_at timestamptz not null default now()
);
create index if not exists reminder_log_user_idx on public.reminder_log (user_id, sent_at desc);
alter table public.reminder_log enable row level security;
grant select on public.reminder_log to authenticated;

drop policy if exists "reminder_log: read own" on public.reminder_log;
create policy "reminder_log: read own" on public.reminder_log
  for select to authenticated using (user_id = (select auth.uid()));

-- Dữ liệu cho Edge Function: mỗi người có máy đăng ký một dòng ----------------------------------
-- Ngày học đổi lúc 4:00 sáng theo múi giờ trong hồ sơ, giống app.
create or replace function public.reminder_targets(p_now timestamptz default now(), p_user uuid default null)
returns table (
  user_id uuid,
  time_zone text,
  study_time text,
  study_weekdays smallint[],
  prefs jsonb,
  due_count integer,
  last_review_at timestamptz,
  sent_study_today integer,
  sent_due_today integer,
  last_sent_at timestamptz,
  subscriptions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with subs as (
    select s.user_id,
           jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) as subscriptions
    from public.push_subscriptions s
    where p_user is null or s.user_id = p_user
    group by s.user_id
  ),
  who as (
    select subs.user_id,
           subs.subscriptions,
           case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p.time_zone)
                then p.time_zone else 'Asia/Ho_Chi_Minh' end as tz,
           p.study_weekdays,
           coalesce(p.settings, '{}'::jsonb) as settings
    from subs
    left join public.profiles p on p.user_id = subs.user_id and p.deleted_at is null
  )
  select
    w.user_id,
    w.tz,
    w.settings ->> 'studyTime',
    w.study_weekdays,
    coalesce(w.settings -> 'reminders', '{}'::jsonb),
    (select count(*)::integer
       from public.card_states c
       join public.vocab_items v on v.id = c.id
      where c.user_id = w.user_id and c.deleted_at is null and not c.suspended and c.due <= p_now
        and v.deleted_at is null and not v.archived),
    (select max(r.reviewed_at) from public.review_logs r where r.user_id = w.user_id),
    (select count(*)::integer from public.reminder_log l
      where l.user_id = w.user_id and l.kind = 'study' and l.study_day = ((p_now at time zone w.tz) - interval '4 hours')::date),
    (select count(*)::integer from public.reminder_log l
      where l.user_id = w.user_id and l.kind = 'due' and l.study_day = ((p_now at time zone w.tz) - interval '4 hours')::date),
    (select max(l.sent_at) from public.reminder_log l where l.user_id = w.user_id),
    w.subscriptions
  from who w
$$;

revoke all on function public.reminder_targets(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.reminder_targets(timestamptz, uuid) to service_role;

-- ==== LỊCH CHẠY: gọi Edge Function 15 phút một lần (cần pg_cron, pg_net và hai bí mật trong Vault) ====
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Cùng tên thì pg_cron thay lịch cũ, nên chạy lại file này không tạo lịch trùng.
select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
