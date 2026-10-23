-- EnglishVocab — schema khởi tạo (kế hoạch mục 3.4, 3.5)
-- Chạy lại nhiều lần cũng an toàn: bảng/chỉ mục đã có thì bỏ qua, trigger và policy được tạo lại.
--
-- Quy ước đồng bộ:
--   * id do thiết bị tạo (UUID), nên tạo dữ liệu khi mất mạng không bị trùng mã.
--   * created_at / updated_at / deleted_at do thiết bị ghi; bản sửa mới nhất thắng; xóa mềm.
--   * server_updated_at do máy chủ ghi mỗi lần thay đổi; thiết bị kéo về các dòng có
--     server_updated_at lớn hơn mốc lần đồng bộ trước.
--   * review_logs chỉ được thêm, không được sửa hay xóa.
--   * Không đặt ràng buộc unique cho từ trùng: hai thiết bị có thể cùng tạo một từ khi mất mạng.
--     Phát hiện và gộp trùng làm ở ứng dụng (R2.5).

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Hồ sơ người học (R1.4, R1.5, R9.2, R14) ---------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  self_level text check (self_level in ('beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced')),
  learning_purpose text,
  daily_new_words integer not null default 10 check (daily_new_words between 0 and 200),
  daily_minutes integer not null default 15 check (daily_minutes between 0 and 600),
  study_weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  time_zone text not null default 'Asia/Ho_Chi_Minh',
  preferred_accent text not null default 'us' check (preferred_accent in ('uk', 'us')),
  settings jsonb not null default '{}'::jsonb,
  fsrs_params jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

-- Mục học: một từ/cụm từ với một nghĩa xác định (R2) ----------------------------------
create table if not exists public.vocab_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  term text not null check (length(term) between 1 and 200),
  term_key text not null,
  part_of_speech text not null default 'other',
  meaning_vi text not null default '',
  meaning_en text,
  ipa_uk text,
  ipa_us text,
  examples jsonb not null default '[]'::jsonb,
  accepted_answers text[] not null default '{}',
  note text,
  mnemonic text,
  source text,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  difficult boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists vocab_items_sync_idx on public.vocab_items (user_id, server_updated_at);
create index if not exists vocab_items_term_idx on public.vocab_items (user_id, term_key);

-- Bộ từ (R3) -------------------------------------------------------------------------
create table if not exists public.decks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  topic text,
  daily_goal integer,
  active boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists decks_sync_idx on public.decks (user_id, server_updated_at);

create table if not exists public.deck_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid not null references public.decks (id) on delete cascade,
  item_id uuid not null references public.vocab_items (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists deck_items_sync_idx on public.deck_items (user_id, server_updated_at);
create index if not exists deck_items_deck_idx on public.deck_items (deck_id);
create index if not exists deck_items_item_idx on public.deck_items (item_id);

-- Trạng thái FSRS: một dòng cho mỗi mục học (R5) ---------------------------------------
create table if not exists public.card_states (
  id uuid primary key references public.vocab_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0 check (state between 0 and 3),
  last_review timestamptz,
  suspended boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists card_states_sync_idx on public.card_states (user_id, server_updated_at);
create index if not exists card_states_due_idx on public.card_states (user_id, due);

-- Lượt trả lời: chỉ thêm (R4–R6, R10) --------------------------------------------------
create table if not exists public.review_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.vocab_items (id) on delete cascade,
  session_id uuid not null,
  reviewed_at timestamptz not null,
  mode text not null check (mode in ('learn', 'review', 'retry', 'practice', 'test')),
  exercise text not null,
  grade smallint check (grade between 1 and 4),
  correct boolean,
  hint_level smallint not null default 0,
  response_ms integer,
  affects_schedule boolean not null,
  device_id text not null,
  created_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);
create index if not exists review_logs_sync_idx on public.review_logs (user_id, server_updated_at);
create index if not exists review_logs_item_idx on public.review_logs (item_id, reviewed_at);

-- Buổi học/ôn (R4.6, R5.12, R6.8) -----------------------------------------------------
create table if not exists public.study_sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (mode in ('learn', 'review', 'retry', 'practice', 'test')),
  started_at timestamptz not null,
  ended_at timestamptz,
  queue uuid[] not null default '{}',
  queue_cursor integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists study_sessions_sync_idx on public.study_sessions (user_id, server_updated_at);

-- Âm thanh và phiên âm (R7.1, R7.8, R13.8) ---------------------------------------------
-- owner_id null = nội dung chung của hệ thống; có giá trị = bản riêng của người học.
create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  term_key text not null,
  part_of_speech text not null default 'other',
  accent text not null check (accent in ('uk', 'us')),
  ipa text,
  source text not null check (source in ('dictionary', 'tts', 'upload', 'recording')),
  license text,
  attribution text,
  storage_path text,
  remote_url text,
  status text not null default 'active' check (status in ('active', 'flagged', 'replaced')),
  created_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);
create index if not exists audio_assets_lookup_idx on public.audio_assets (term_key, part_of_speech, accent);

-- Lịch sử tra cứu (R15.4) và báo lỗi (R14.4, R6.13) --------------------------------------
create table if not exists public.lookup_history (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query text not null,
  looked_up_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists lookup_history_sync_idx on public.lookup_history (user_id, server_updated_at);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'content', 'answer', 'other')),
  context jsonb not null default '{}'::jsonb,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Tự cập nhật server_updated_at ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'vocab_items', 'decks', 'deck_items', 'card_states', 'review_logs',
                           'study_sessions', 'audio_assets', 'lookup_history']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_server_updated_at', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.set_server_updated_at()',
      t || '_server_updated_at', t);
  end loop;
end;
$$;

-- Tạo hồ sơ khi có tài khoản mới ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tài khoản tạo trước khi chạy file này cũng được tạo hồ sơ.
insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

-- Phân quyền theo dòng (RLS): mỗi người chỉ thấy dữ liệu của mình -------------------------
alter table public.profiles enable row level security;
alter table public.vocab_items enable row level security;
alter table public.decks enable row level security;
alter table public.deck_items enable row level security;
alter table public.card_states enable row level security;
alter table public.review_logs enable row level security;
alter table public.study_sessions enable row level security;
alter table public.audio_assets enable row level security;
alter table public.lookup_history enable row level security;
alter table public.feedback_reports enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['vocab_items', 'decks', 'deck_items', 'card_states', 'study_sessions', 'lookup_history']
  loop
    execute format('drop policy if exists %I on public.%I', t || ': own rows', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || ': own rows', t);
  end loop;
end;
$$;

-- review_logs: chỉ đọc và thêm, không sửa, không xóa.
drop policy if exists "review_logs: read own" on public.review_logs;
create policy "review_logs: read own" on public.review_logs
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "review_logs: insert own" on public.review_logs;
create policy "review_logs: insert own" on public.review_logs
  for insert to authenticated with check (user_id = (select auth.uid()));

-- audio_assets: đọc nội dung chung và bản của mình; chỉ ghi bản của mình.
drop policy if exists "audio_assets: read shared and own" on public.audio_assets;
create policy "audio_assets: read shared and own" on public.audio_assets
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
drop policy if exists "audio_assets: insert own" on public.audio_assets;
create policy "audio_assets: insert own" on public.audio_assets
  for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "audio_assets: update own" on public.audio_assets;
create policy "audio_assets: update own" on public.audio_assets
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "audio_assets: delete own" on public.audio_assets;
create policy "audio_assets: delete own" on public.audio_assets
  for delete to authenticated using (owner_id = (select auth.uid()));

-- feedback_reports: gửi và xem báo cáo của mình.
drop policy if exists "feedback_reports: read own" on public.feedback_reports;
create policy "feedback_reports: read own" on public.feedback_reports
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "feedback_reports: insert own" on public.feedback_reports;
create policy "feedback_reports: insert own" on public.feedback_reports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Quyền truy cập qua API ------------------------------------------------------------------
-- Ghi rõ để không phụ thuộc quyền mặc định của dự án. RLS ở trên vẫn lọc theo từng dòng.
-- Người chưa đăng nhập (anon) không được chạm vào bảng nào của app.
revoke all on
  public.profiles, public.vocab_items, public.decks, public.deck_items, public.card_states,
  public.review_logs, public.study_sessions, public.audio_assets, public.lookup_history,
  public.feedback_reports
  from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.vocab_items, public.decks, public.deck_items, public.card_states,
  public.study_sessions, public.audio_assets, public.lookup_history
  to authenticated;
-- Lịch sử trả lời và báo lỗi: chỉ đọc và thêm.
grant select, insert on public.review_logs, public.feedback_reports to authenticated;
