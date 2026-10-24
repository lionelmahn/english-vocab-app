-- EnglishVocab — âm thanh của người học (R7.8 bổ sung âm thanh, R13.8 quản lý nguồn)
-- Ghi âm, tải bản ghi lên, chọn hoặc báo sai bản Wiktionary, và Giọng iPhone đồng bộ giữa các máy.
-- Chạy lại nhiều lần cũng an toàn. Chạy sau file 20261023000000_init.sql.

-- Bảng audio_assets (đã có từ đầu): thêm cột để đồng bộ như các bảng khác -------------------------
alter table public.audio_assets alter column owner_id set default auth.uid();
alter table public.audio_assets add column if not exists text text;
alter table public.audio_assets add column if not exists mime text;
alter table public.audio_assets add column if not exists updated_at timestamptz not null default now();
alter table public.audio_assets add column if not exists deleted_at timestamptz;
create index if not exists audio_assets_sync_idx on public.audio_assets (owner_id, server_updated_at);

-- Kho file "audio": riêng tư, mỗi file tối đa 2 MB, chỉ nhận âm thanh ------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 2097152, array['audio/*'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Mỗi người chỉ đọc/ghi thư mục của mình: audio/<user_id>/<tên file>
drop policy if exists "audio files: read own" on storage.objects;
create policy "audio files: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "audio files: insert own" on storage.objects;
create policy "audio files: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "audio files: update own" on storage.objects;
create policy "audio files: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "audio files: delete own" on storage.objects;
create policy "audio files: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
