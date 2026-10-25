-- EnglishVocab — hình minh họa cho từ (R2.6)
-- Mỗi từ gắn được một ảnh. File ảnh nằm ở kho "images" (riêng tư); bảng item_images ghi ảnh nào thuộc từ nào,
-- đồng bộ giữa các máy như các bảng khác. Chạy lại nhiều lần cũng an toàn. Chạy sau file 20261023000000_init.sql.

create table if not exists public.item_images (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null,
  storage_path text,
  mime text,
  width integer check (width is null or width between 1 and 4096),
  height integer check (height is null or height between 1 and 4096),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);
create index if not exists item_images_sync_idx on public.item_images (user_id, server_updated_at);

drop trigger if exists item_images_server_updated_at on public.item_images;
create trigger item_images_server_updated_at before insert or update on public.item_images
  for each row execute function public.set_server_updated_at();

alter table public.item_images enable row level security;
drop policy if exists "item_images: own rows" on public.item_images;
create policy "item_images: own rows" on public.item_images
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.item_images from anon, authenticated;
grant select, insert, update, delete on public.item_images to authenticated;

-- Kho file "images": riêng tư, mỗi file tối đa 1 MB, chỉ nhận ảnh JPEG/PNG/WebP --------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Mỗi người chỉ đọc/ghi thư mục của mình: images/<user_id>/<tên file>
drop policy if exists "image files: read own" on storage.objects;
create policy "image files: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "image files: insert own" on storage.objects;
create policy "image files: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "image files: update own" on storage.objects;
create policy "image files: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "image files: delete own" on storage.objects;
create policy "image files: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = (select auth.uid())::text);
