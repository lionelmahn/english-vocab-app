# Hướng dẫn chạy, thử trên điện thoại và phát hành

Mọi lệnh dưới đây chạy trong thư mục `app/` (mở terminal tại `C:\EnglishVocab\app`).

## 1. Chạy trên máy tính

```bash
npm install
```

```bash
npm run dev
```

Mở http://localhost:5173. Sửa mã thì trang tự cập nhật.

Các lệnh khác:

| Lệnh | Tác dụng |
|---|---|
| `npm test` | Chạy toàn bộ test (logic FSRS, chấm điểm, 5 cấp, ngày học, CSDL) |
| `npm run lint` | Kiểm tra lỗi mã |
| `npm run build` | Tạo bản phát hành trong `app/dist` |
| `npm run preview` | Chạy thử bản phát hành tại http://localhost:4173 (có service worker, chạy được khi mất mạng) |
| `npm run deploy` | Build và phát hành lên Cloudflare (mục 3) |

## 2. Xem nhanh trên điện thoại (cùng mạng Wi-Fi)

1. Chạy `npm run dev`. Dòng `Network:` trong terminal cho địa chỉ dạng `http://192.168.x.x:5173`.
2. Mở địa chỉ đó trên điện thoại (điện thoại và máy tính phải cùng mạng).
3. Nếu Windows hỏi tường lửa, cho phép với "Private network".

Cách này chỉ để xem giao diện. Vì không có HTTPS, điện thoại **không cài được** app và không chạy khi mất mạng. Muốn cài lên màn hình chính, làm mục 3.

## 3. Phát hành lên Cloudflare (miễn phí, có HTTPS)

**Địa chỉ hiện tại: https://english-vocab.lionelmahn.workers.dev** (phát hành lần đầu ngày 23/10/2026).

Cloudflare đã gộp Pages vào Workers, nên app được phát hành dạng **file tĩnh trên Workers**. Cấu hình nằm ở `app/wrangler.jsonc`: thư mục `dist`, và mọi đường dẫn như `/notebook` đều trả về `index.html`. Gói miễn phí không tính phí cho lượt tải file tĩnh.

### Phát hành bản mới (từ máy tính)

```bash
npm run deploy
```

Lệnh này build rồi đẩy lên Cloudflare. Điện thoại đã cài app sẽ tự nhận bản mới ở lần mở kế tiếp.

### Máy mới hoặc tài khoản khác

1. Đăng nhập Cloudflare (trình duyệt sẽ mở để bạn đăng nhập):

   ```bash
   npx wrangler login
   ```

2. Kiểm tra đang dùng tài khoản nào:

   ```bash
   npx wrangler whoami
   ```

3. Chạy `npm run deploy`.

### Tự phát hành mỗi khi đẩy mã lên GitHub (tùy chọn, sau này)

Trong Cloudflare: Workers & Pages → Create → Import a repository, chọn kho mã. Đặt **Root directory** là `app`, **Build command** là `npm run build`, **Deploy command** là `npx wrangler deploy`. Thêm biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` khi đã có Supabase (mục 5).

## 4. Cài lên điện thoại

- **iPhone:** mở link bằng **Safari** → nút Chia sẻ → "Thêm vào MH chính".
- **Android:** mở link bằng **Chrome** → menu ⋮ → "Cài đặt ứng dụng" (hoặc "Thêm vào màn hình chính").

Mở app từ biểu tượng trên màn hình chính. Từ lần mở thứ hai, app chạy được cả khi mất mạng.

## 5. Kết nối Supabase (cần cho đăng nhập và đồng bộ, giai đoạn 1–2)

1. Tạo dự án miễn phí tại https://supabase.com. Chọn region **Singapore** cho gần Việt Nam.
2. Vào **SQL Editor**, dán toàn bộ nội dung file `supabase/migrations/20261023000000_init.sql`, bấm **Run**. File này chạy lại nhiều lần cũng an toàn, và tự tạo hồ sơ cho tài khoản đã có từ trước.
3. Vào **Authentication → Users → Add user → Create new user** để tạo sẵn tài khoản của bạn, tick **Auto Confirm User** (bản cá nhân không cần trang đăng ký, R1.1 là P3).
4. Tắt đăng ký công khai: **Authentication → Sign In / Providers**, tắt "Allow new users to sign up".
   - **Authentication → URL Configuration**: Site URL là `https://english-vocab.lionelmahn.workers.dev`; trong Redirect URLs thêm `https://english-vocab.lionelmahn.workers.dev/**` và `http://localhost:5173/**` (để link "quên mật khẩu" mở đúng app).
5. Vào **Project Settings → API Keys**, sao chép **Project URL** và **Publishable key**.
6. Trong `app/`, sao chép `.env.example` thành `.env.local` rồi điền hai giá trị trên. File `.env.local` không được đưa lên git.
7. Chạy lại `npm run deploy` (mục 3) để bản phát hành nhận cấu hình.

Publishable key được phép nằm trong ứng dụng: dữ liệu được bảo vệ bằng phân quyền theo dòng (RLS). Mỗi tài khoản chỉ đọc/ghi được dữ liệu của chính mình. **Không bao giờ** đưa `service_role` key hay secret key vào ứng dụng.

## 6. Cấu trúc mã

```
app/src/
├─ core/        logic thuần, có test: FSRS (scheduler), quy đổi điểm (grading),
│               so khớp đáp án (answers), 5 cấp ghi nhớ (levels), ngày học & chuỗi ngày (day)
├─ db/          CSDL trên thiết bị (Dexie/IndexedDB), hàng đợi đồng bộ, chuyển đổi thẻ FSRS
├─ services/    kết nối Supabase (chỉ tải khi đã cấu hình)
├─ lib/         cấu hình chuyển động chung (motion.ts), cài đặt giao diện, danh sách tab
├─ components/  thanh tab, nút, thẻ, vòng tiến độ, số đếm dần
└─ pages/       5 màn hình: Hôm nay, Sổ tay, Tra từ, Thống kê, Cá nhân
supabase/migrations/   schema máy chủ + phân quyền RLS
```
