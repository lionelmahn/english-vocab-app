-- Xóa tài khoản của chính mình (R1.6).
-- Chạy trong SQL Editor của Supabase; chạy lại nhiều lần vẫn an toàn.
--
-- Hàm xóa người dùng đang đăng nhập khỏi auth.users. Mọi dòng dữ liệu của người đó (hồ sơ, từ vựng, bộ từ,
-- lịch ôn, lịch sử học, âm thanh, đăng ký nhắc nhở…) tự xóa theo nhờ khóa ngoại "on delete cascade".
-- File âm thanh trong kho "audio" do app xóa trước (Storage API), vì kho không xóa theo khóa ngoại.
-- Hàm chạy với quyền của chủ hàm (security definer) nhưng chỉ xóa đúng tài khoản đang gọi (auth.uid()).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Chưa đăng nhập';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
