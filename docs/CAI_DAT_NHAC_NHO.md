# Cài đặt nhắc nhở (Web Push)

Nhắc học vào giờ học và nhắc ôn khi có từ đến hạn, gửi tới iPhone kể cả khi app đang đóng. Tất cả chạy trên gói miễn phí của Supabase (0đ).

Cách chạy: Supabase gọi Edge Function `send-reminders` 15 phút một lần. Mỗi lần, hàm xem giờ học, giờ yên lặng và số từ đến hạn của bạn, rồi mới gửi thông báo nếu cần.

Bạn làm **một lần** các bước dưới. Khóa đã được tạo sẵn trong file `app/push-keys.local` (mở bằng Notepad). File này không lên git; đừng gửi nó cho ai.

## 1. Thêm khóa vào Edge Function Secrets

1. Mở Supabase → dự án **english-vocab** → **Edge Functions** → **Secrets** (đường dẫn: `https://supabase.com/dashboard/project/fiaszihrpitcsdsqdgdu/functions/secrets`).
2. Thêm 3 khóa, lấy từ file `app/push-keys.local`. Key là phần trước dấu `=`, Value là phần sau dấu `=`:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `CRON_SECRET`
3. Bấm **Save**.

## 2. Tạo Edge Function `send-reminders`

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Đặt tên đúng là `send-reminders`.
3. Xóa hết mã mẫu, dán **toàn bộ** nội dung file `supabase/functions/send-reminders/index.ts`, rồi bấm **Deploy function**.
4. Mở hàm vừa tạo → phần cài đặt (**Details**) → **tắt** "Verify JWT" (có thể mang tên "Enforce JWT verification") → lưu.
   Lý do: lịch chạy gọi hàm bằng khóa `CRON_SECRET` chứ không bằng phiên đăng nhập. Nút "Gửi thử" trong app vẫn kiểm tra đăng nhập ngay bên trong hàm.

## 3. Chạy SQL

Mở **SQL Editor** và chạy lần lượt:

1. Lưu địa chỉ dự án vào Vault:
   ```sql
   select vault.create_secret('https://fiaszihrpitcsdsqdgdu.supabase.co', 'project_url');
   ```
2. Lưu khóa lịch chạy: chép **nguyên dòng** `select vault.create_secret(…, 'reminders_cron_secret');` ở cuối file `app/push-keys.local` rồi chạy.
3. Dán toàn bộ file `supabase/migrations/20261026000000_reminders.sql` rồi chạy. File này tạo bảng, hàm và lịch chạy 15 phút một lần; chạy lại nhiều lần vẫn an toàn.

Nếu bước 1 hoặc 2 báo trùng tên (đã tạo trước đó), dùng `vault.update_secret` thay vì tạo lại. Ví dụ:

```sql
select vault.update_secret((select id from vault.secrets where name = 'project_url'), 'https://fiaszihrpitcsdsqdgdu.supabase.co');
```

## 4. Bật trên iPhone

1. Mở app **từ màn hình chính** (Web Push trên iPhone chỉ chạy với app đã cài).
2. **Cá nhân** → **Nhắc nhở** → **Bật nhắc nhở trên máy này** → chọn **Cho phép**.
3. Bấm **Gửi thử**. Thông báo "Nhắc nhở đã chạy" sẽ hiện sau vài giây.
4. Nếu chưa đặt giờ học thì đặt ở **Mục tiêu và lịch học**.

## Kiểm tra khi không thấy nhắc

- **"Gửi thử" báo chưa có Edge Function:** kiểm tra tên hàm đúng là `send-reminders`.
- **"Gửi thử" báo thiếu VAPID:** kiểm tra đủ 3 khóa ở bước 1 (tên viết hoa, đúng chính tả).
- **"Gửi thử" chạy được nhưng không có nhắc theo lịch:**
  - Xem **Integrations → Cron → Jobs** có lịch `send-reminders` và các lần chạy gần đây.
  - Xem **Edge Functions → send-reminders → Logs**. Lỗi 401 là chưa tắt Verify JWT. Lỗi 403 là khóa `CRON_SECRET` trong Secrets khác với khóa trong Vault.
- **iPhone:** không bật chế độ Tập trung hay Không làm phiền; vào Cài đặt → Thông báo, kiểm tra app được phép gửi thông báo.

## Đổi khóa

Chạy `npm run push-keys -- --force` trong thư mục `app`, rồi làm lại bước 1, bước 3.2 (dùng `vault.update_secret`) và phát hành lại app. Mọi máy phải bật lại nhắc nhở.
