# Kế hoạch xây dựng ứng dụng ôn luyện từ vựng tiếng Anh (Web · iOS · Android)

> Ngày lập: 23/10/2026
> Căn cứ: `Tài liệu phân rã các nhóm chức năng.docx` (16 nhóm, 126 chức năng, 12 quy tắc chung)

---

## 1. Tóm tắt

| Nội dung | Kết luận |
|---|---|
| Quy mô | 126 chức năng: **64 P1**, **46 P2**, **16 P3** |
| Hướng kỹ thuật | **Một bộ mã duy nhất**: ứng dụng web cài được (PWA) viết bằng React + TypeScript. Chạy trên trình duyệt máy tính, "cài" lên màn hình chính iPhone và Android. Khi cần, bọc thành app Android/iOS bằng **Capacitor** mà không phải viết lại |
| Máy chủ | **Supabase** (đăng nhập, cơ sở dữ liệu Postgres, lưu file âm thanh, hàm xử lý phía máy chủ) — gói miễn phí |
| Thuật toán ôn | **FSRS** qua thư viện `ts-fsrs` (đúng định hướng trong đặc tả) |
| Chi phí vận hành cá nhân | **0đ/tháng** nếu không dùng AI; AI tùy chọn, từ vài nghìn đến khoảng 250 nghìn đồng/tháng tùy model |
| Mốc dùng được hằng ngày | Sau **giai đoạn 1** (~5–7 tuần) |
| Hoàn thành toàn bộ P1 | Sau **giai đoạn 2** (~2,5–3 tháng) |

Lý do chọn PWA trước: bạn đang dùng Windows, mà build app iOS gốc bắt buộc cần máy Mac và tài khoản Apple Developer (99 USD/năm). PWA giúp dùng được ngay trên iPhone với chi phí 0đ. Trên iOS 16.4 trở lên, PWA đã cài lên màn hình chính cũng nhận được thông báo nhắc học.

---

## 2. Phân tích chức năng

### 2.1 Thống kê theo nhóm và giai đoạn thực hiện

| Nhóm | Tên | Tổng | P1 | P2 | P3 | Giai đoạn chính |
|---|---|---:|---:|---:|---:|---|
| R1 | Tài khoản, hồ sơ, thiết lập ban đầu | 8 | 5 | 2 | 1 | 1, 2, 3, 5, 7 |
| R2 | Sổ tay từ vựng cá nhân | 9 | 8 | 1 | – | 1, 2 |
| R3 | Bộ từ vựng | 6 | 5 | 1 | – | 1 |
| R4 | Học từ mới | 8 | 8 | – | – | 1 |
| R5 | Ôn tập thông minh, lịch ôn | 13 | 10 | 3 | – | 1, 4 |
| R6 | Luyện tập, kiểm tra, chấm đáp án | 13 | 5 | 8 | – | 1, 4 |
| R7 | Phát âm, phiên âm, cách dùng | 8 | 4 | 4 | – | 1, 2, 3, 5 |
| R8 | Trợ lý học tập AI | 8 | – | 8 | – | 5 |
| R9 | Kế hoạch học, nhắc nhở | 6 | 2 | 4 | – | 2, 3 |
| R10 | Thống kê, động lực | 8 | 4 | 3 | 1 | 2, 3, 4, 7 |
| R11 | Lưu trữ, sao lưu, ngoại tuyến, đồng bộ | 8 | 6 | 2 | – | 1, 2, 3 |
| R12 | Kho bộ từ, chia sẻ | 6 | – | – | 6 | 7 |
| R13 | Quản trị hệ thống, nội dung | 8 | 1 | – | 7 | 2, 7 |
| R14 | Cài đặt, hướng dẫn, hỗ trợ | 5 | 2 | 3 | – | 1, 2, 3, 4 |
| R15 | Tra từ điển, lưu nhanh | 5 | 4 | 1 | – | 2, 4 |
| R16 | Khóa học, bài học, lộ trình | 7 | – | 6 | 1 | 6, 7 |
| | **Tổng** | **126** | **64** | **46** | **16** | |

### 2.2 Quan hệ giữa các nhóm: "vòng học lõi"

```
NGUỒN TỪ VỰNG                 VÒNG HỌC LÕI                                  ĐẦU RA
Thêm tay (R2.2) ──────┐
Tra từ (R15) ─────────┤                         ┌─> Học mới (R4) ──┐
Nhập file (R11.2) ────┼─> R2.8 ─> Sổ tay (R2) ──┤                  ├─> Bài luyện & chấm (R6) ─> Lịch ôn FSRS (R5) ─┬─> Thống kê (R10)
Bài học (R16) ────────┤   (lưu    + Bộ từ (R3)  └─> Ôn tập (R5.3) ─┘                                               └─> Hôm nay & nhắc (R9)
Kho chung (R12) ──────┘   + chống trùng R2.5)

NỀN TẢNG DÙNG CHUNG: Tài khoản (R1) · Lưu trữ & đồng bộ (R11) · Âm thanh/phiên âm (R7 + R13.8) · Cài đặt (R14)
TÙY CHỌN (không được chặn vòng học): Trợ lý AI (R8)
```

**Nhận xét quan trọng khi lập trình:**

1. **R4, R5, R6 là trái tim của ứng dụng.** R4 (học mới) và R5 (ôn tập) cùng dùng các dạng bài của R6. Cần xây một "bộ máy bài luyện" dùng chung thay vì làm riêng cho từng luồng.
2. **R2.8 là cửa vào duy nhất.** Mọi nguồn (tra từ, nhập file, bài học, kho chung) đều lưu qua R2.8, nên chỉ cần viết logic chống trùng (R2.5) một lần.
3. **Đồng bộ (R11.5, R11.7) là P1 và ảnh hưởng thiết kế dữ liệu ngay từ đầu.** Dù học ngoại tuyến (R11.6) là P2, nên thiết kế theo kiểu "lưu cục bộ trước, đồng bộ sau" ngay giai đoạn 1 để khỏi phải làm lại.
4. **R13.8 (nguồn âm thanh, phiên âm) có phần P1.** R7.1 và R7.8 phụ thuộc vào nó, nên cần bảng quản lý âm thanh từ sớm.
5. **Các nhóm P3 (R12, R13, R10.8, R1.1, R16.7) chỉ cần khi mở cho người khác dùng.** Với bản cá nhân, tài khoản có thể tạo sẵn trong bảng điều khiển Supabase.
6. **Nên kéo sớm một số P2 rẻ mà giữ thói quen học:** chuỗi ngày học (R10.5) và nhắc ôn (R9.3, R9.4) ở giai đoạn 3.

### 2.3 Những điểm đặc tả còn mở — đề xuất cách chốt

Đặc tả đã nêu rõ quy tắc, nhưng còn vài chỗ cần con số hoặc luật cụ thể trước khi lập trình. Dưới đây là đề xuất; bạn có thể chỉnh.

**a) Quy đổi kết quả bài làm sang điểm FSRS** (quy tắc "không coi mọi câu đúng có giá trị như nhau")

| Tình huống | Điểm FSRS |
|---|---|
| Tự đánh giá Quên / Khó / Nhớ / Dễ (R4.5) | Again / Hard / Good / Easy |
| "Mình không thuộc từ này" (R5.10) | Again |
| Trắc nghiệm, ghép cặp, nghe chọn nghĩa — dạng **nhận diện** (R6.1, R6.5, R6.10, R6.11) — đúng | Good (không cho Easy vì có thể đoán) |
| Gõ từ — dạng **nhớ lại** (R6.2, R6.3, R6.4) — đúng, không gợi ý | Good (người học được nâng lên Easy) |
| Đúng nhưng đã dùng gợi ý (R6.9), hoặc gần đúng (sai 1 ký tự) và người học chấp nhận | Hard |
| Sai | Again |
| "Không tiện nghe" (R6.12) | Không chấm; đổi sang dạng bài không âm thanh |
| Luyện lại sau khi sai (R5.5), ôn chủ động trước hạn (R5.7) | Chỉ ghi lịch sử "luyện tập", **không đổi lịch ôn** |

Luật đi kèm: trong một buổi, **mỗi từ chỉ có một lần chấm tính vào lịch ôn**: lần trả lời đầu tiên. Các lần sau là luyện củng cố (khớp quy tắc "giữ kết quả sai ban đầu").

**b) Năm cấp ghi nhớ (R5.9, R10.7)**: suy ra từ "độ bền trí nhớ" (stability) của FSRS, không gắn với khoảng ôn cố định.

| Cấp | Điều kiện đề xuất |
|---|---|
| Chưa học | Đã lưu vào sổ tay nhưng chưa có lượt học nào |
| 1 – Mới làm quen | Đang học hoặc học lại, hoặc độ bền < 1 ngày |
| 2 – Đang nhớ | 1–7 ngày |
| 3 – Nhớ khá | 7–30 ngày |
| 4 – Nhớ tốt | 30–90 ngày |
| 5 – Thuộc lâu | ≥ 90 ngày |

**c) Các luật nhỏ khác cần chốt**

| Chức năng | Đề xuất |
|---|---|
| R2.3 Sửa từ | Sửa **từ hoặc nghĩa chính** → hỏi người học giữ hay đặt lại tiến độ. Sửa ví dụ, phiên âm, âm thanh, ghi chú → giữ tiến độ |
| R2.5 Từ trùng | Khóa nhận diện = từ đã chuẩn hóa + loại từ + nghĩa. Cùng từ, khác nghĩa → mục học mới; cùng cả ba → báo trùng, gợi ý gộp |
| R3.3 Xóa bộ từ | Từ vẫn còn trong sổ tay. Chỉ hỏi xóa những từ không thuộc bộ nào khác |
| R5.6 Ôn tồn đọng | Giới hạn mỗi buổi (ví dụ 50 từ). Ưu tiên từ quá hạn lâu và từ hay sai. Gợi ý giảm từ mới (R9.5) |
| R6.7 Chấm đáp án | Chuẩn hóa: bỏ khoảng trắng thừa, không phân biệt hoa thường, thống nhất dấu nháy. Chấp nhận biến thể Anh–Anh/Anh–Mỹ (colour/color) |
| R10.5 Chuỗi ngày | Một ngày tính từ 4:00 sáng giờ địa phương (để học khuya vẫn tính cho hôm trước). Tiêu chí: hoàn thành ít nhất 1 buổi |

---

## 3. Kiến trúc và công nghệ

### 3.1 So sánh các phương án

| Phương án | Web | iOS | Android | Chi phí / độ khó | Đánh giá |
|---|---|---|---|---|---|
| **PWA (React) + Capacitor** | Tốt nhất | PWA ngay (0đ); app App Store khi cần | PWA hoặc APK | Một bộ mã; làm được trên Windows | **Chọn** |
| Expo (React Native) | Khá | Cảm giác app gốc tốt hơn | Tốt | Muốn cài lâu dài trên iPhone vẫn cần 99 USD/năm | Phương án dự phòng nếu sau này cần cảm giác app gốc |
| Flutter | Yếu hơn | Tốt | Tốt | Ngôn ngữ Dart; web kém hơn | Không chọn |
| Viết riêng từng nền tảng | Tốt | Tốt | Tốt | Gấp 3 công sức | Không chọn |

Ứng dụng học từ chủ yếu là chữ, nút bấm và âm thanh. Đây đúng là loại ứng dụng mà công nghệ web làm tốt trên điện thoại. Phần logic học (FSRS, chấm điểm, đồng bộ) được viết bằng TypeScript thuần trong thư mục `core/`. Nếu sau này chuyển sang Expo, phần này dùng lại được.

### 3.2 Công nghệ đề xuất

| Lớp | Công nghệ | Dùng cho |
|---|---|---|
| Giao diện | React + TypeScript + Vite | Toàn bộ màn hình |
| Kiểu dáng | Tailwind CSS + shadcn/ui | Giao diện ưu tiên điện thoại, chế độ sáng/tối (R14.1) |
| Hiệu ứng | Motion (trước đây là Framer Motion), CSS transitions; Lottie và canvas-confetti từ giai đoạn 3–4 | Chuyển màn hình, lật thẻ, vuốt chấm điểm, phản hồi đúng/sai, tổng kết buổi (mục 3.8) |
| Điều hướng | React Router | 5 tab và các luồng học toàn màn hình |
| PWA | vite-plugin-pwa (Workbox) | Cài lên màn hình chính, chạy khi mất mạng |
| CSDL trên máy | Dexie.js (IndexedDB) | Lưu cục bộ, hàng đợi đồng bộ (R11) |
| Thuật toán ôn | ts-fsrs | Tính lịch ôn (R5.1, R5.4), tính lại lịch từ lịch sử khi đồng bộ |
| Máy chủ | Supabase: Auth, Postgres + Row Level Security, Storage, Edge Functions, pg_cron | Đăng nhập, dữ liệu từng người, âm thanh/ảnh, AI, nhắc nhở |
| Lưu trữ web | Cloudflare Workers, phục vụ file tĩnh (miễn phí; Cloudflare đã gộp Pages vào Workers) | Phát hành bản web |
| App gốc | Capacitor | APK Android (giai đoạn 3); iOS khi cần |
| Kiểm thử | Vitest (logic), Playwright (luồng trên khung điện thoại) | Giữ đúng các quy tắc chung |

### 3.3 Sơ đồ kiến trúc

```
THIẾT BỊ NGƯỜI HỌC — cùng một bộ mã
  Máy tính (trình duyệt)  |  iPhone (PWA)  |  Android (PWA hoặc APK Capacitor)
    Giao diện React
      -> core/: FSRS, chấm điểm, 5 cấp ghi nhớ, luật đồng bộ   (thuần TypeScript, có test)
      -> CSDL cục bộ Dexie + hàng đợi thay đổi                  (học được khi mất mạng)
                 |
                 |  HTTPS — đồng bộ khi có mạng
                 v
SUPABASE (gói miễn phí)
  Auth (đăng nhập) · Postgres + RLS (mỗi người chỉ thấy dữ liệu của mình) · Storage (âm thanh, ảnh)
  Edge Functions: proxy AI · tạo âm thanh TTS · gửi nhắc nhở Web Push · tra từ điển có cache
  pg_cron: lịch gửi nhắc ôn
                 |
                 v
DỊCH VỤ NGOÀI: Claude API (AI) · Google/Azure TTS (giọng đọc) · Free Dictionary API (IPA, âm thanh)
```

### 3.4 Thiết kế dữ liệu cốt lõi

| Bảng | Trường chính | Phục vụ |
|---|---|---|
| `profiles` | tên, ảnh, trình độ, mục đích, mục tiêu từ/ngày, ngày học, múi giờ, giọng ưu tiên, cài đặt | R1.4, R1.5, R9.2, R14 |
| `vocab_items` (mục học) | từ/cụm, loại từ, nghĩa Việt, nghĩa Anh, IPA Anh–Anh/Anh–Mỹ, ví dụ + bản dịch, ghi chú, mẹo nhớ, nguồn, nhãn, yêu thích, từ khó, trạng thái lưu trữ | R2, R7.7 |
| `decks` / `deck_items` | bộ từ; quan hệ nhiều–nhiều với mục học, thứ tự, cờ "đang học" | R3 |
| `card_states` | **một dòng cho mỗi mục học**: trạng thái FSRS, đến hạn, độ bền, độ khó, số lần quên, tạm dừng | R5 — từ trong nhiều bộ dùng chung tiến độ |
| `review_logs` | **chỉ thêm, không sửa**: mục học, buổi, thời điểm, dạng bài, đúng/sai, điểm FSRS, mức gợi ý, thời gian trả lời, có tính lịch hay chỉ luyện tập, thiết bị | R4–R6, R10, đồng bộ |
| `study_sessions` | loại buổi, danh sách câu, vị trí đang làm, trạng thái, tổng kết | R4.6, R4.7, R5.12, R6.8 |
| `audio_assets` | từ + loại từ + giọng, nguồn (từ điển/TTS/người dùng), giấy phép, đường dẫn file, trạng thái kiểm duyệt | R7.1, R7.8, R13.8 |
| `accepted_answers` | đáp án chấp nhận thêm do người học khai báo | R6.13 |
| `lookup_history`, `dictionary_cache` | lịch sử tra, kết quả tra đã lưu | R15 |
| `ai_cache`, `ai_usage` | kết quả AI đã sinh, lượt dùng, chi phí | R8 |
| `feedback_reports` | báo lỗi ứng dụng/nội dung | R14.4, R6.13 |
| *(sau)* `courses`, `lessons`, `public_decks`, `roles` | khóa học, kho chung, phân quyền | R16, R12, R13 |

### 3.5 Luật đồng bộ (đáp ứng "không mất kết quả, không cộng lặp")

1. Mọi bản ghi có **mã UUID tạo ngay trên thiết bị**, nên tạo dữ liệu khi mất mạng không bị trùng mã.
2. **Nội dung** (từ, bộ từ, cài đặt) có `updated_at` và `deleted_at` (xóa mềm). Khi xung đột, bản sửa mới nhất thắng ở mức từng trường.
3. **Lượt trả lời** (`review_logs`) chỉ được thêm, mỗi lượt có mã duy nhất. Gửi lại nhiều lần cũng không bị nhân đôi.
4. **Trạng thái FSRS** được tính lại bằng cách chạy lại toàn bộ lượt trả lời theo thứ tự thời gian khi hai thiết bị cùng ôn một từ. Nhờ vậy không mất lượt nào.
5. **Điểm, chuỗi ngày, thống kê** được tính ra từ `review_logs`, không lưu bộ đếm cộng dồn. Nhờ vậy không thể bị cộng lặp.

### 3.6 Nguồn dữ liệu miễn phí

| Nhu cầu | Nguồn | Ghi chú |
|---|---|---|
| Nghĩa tiếng Anh, IPA, âm thanh | Free Dictionary API (dữ liệu Wiktionary) | Miễn phí; giấy phép CC BY-SA, cần ghi nguồn |
| Phát âm từ và cụm ngắn (đang dùng từ bản 0.4.0) | Bản ghi giọng người thật trên Wiktionary / Wikimedia Commons (gồm Lingua Libre) | Miễn phí; tra một lần rồi lưu trên máy; chỉ nhận file tiếng Anh; giấy phép CC BY-SA/CC BY/PD, có ghi nguồn trong Cá nhân |
| Đọc tức thời | Giọng đọc có sẵn trên máy (Web Speech API) | 0đ; chất lượng tùy thiết bị; không lưu thành file được. **iPhone/iPad: danh sách giọng của web chỉ có giọng có sẵn; muốn dùng giọng Nâng cao/Cao cấp đã tải thì để trống giọng, chỉ báo ngôn ngữ (máy dùng giọng chọn trong Cài đặt)** |
| Âm thanh lưu lại (R7.8) | Google Cloud TTS hoặc Azure TTS | Có hạn mức miễn phí hằng tháng, đủ cho cá nhân; tạo một lần rồi lưu vào Storage |
| Bộ từ khởi đầu (R1.7) | NGSL (~2.800 từ thông dụng), TSL (từ vựng TOEIC), NAWL (học thuật) | Giấy phép CC BY-SA. Nghĩa tiếng Việt có thể sinh một lần bằng AI rồi rà soát |
| Nghĩa tiếng Việt khi tra từ | Người học nhập, hoặc AI gợi ý (R8.1) để người học xác nhận | Hiếm có API Anh–Việt miễn phí với giấy phép rõ ràng |

Lưu ý quy tắc "khớp cách đọc với loại từ": âm thanh được lưu theo bộ khóa **(từ, loại từ, giọng)**. Ví dụ *record* (danh từ) và *record* (động từ) có hai bản đọc khác nhau, và bản nào cũng sửa được.

### 3.7 Trợ lý AI (R8)

- Mọi lời gọi AI đi qua Edge Function của Supabase. Khóa API không bao giờ nằm trong ứng dụng.
- **Lưu kết quả AI theo từng từ:** hỏi một lần, dùng lại mãi. Chi phí giảm mạnh.
- Có giới hạn lượt/ngày và trần ngân sách/tháng (R8.8). AI lỗi hoặc tắt thì vòng học vẫn chạy bình thường.
- Dùng "structured outputs" (trả về JSON đúng khuôn) cho R8.1 và R8.5 để điền thẳng vào form.
- Model: mặc định **Claude Opus 5.5** (chất lượng cao nhất). Có thể chọn **Sonnet 5.5** hoặc **Haiku 5.5** để tiết kiệm. Việc chọn model là quyết định của bạn; xem chi phí ở mục 5.

### 3.8 Hiệu ứng và trải nghiệm hằng ngày

| Nơi dùng | Hiệu ứng | Giai đoạn |
|---|---|---|
| Toàn app | Trượt khi chuyển tab và màn hình; nút nhún khi bấm; khung chờ khi tải | 0 |
| Học mới, ôn tập | Lật thẻ 3D; vuốt trái là quên, vuốt phải là nhớ; thẻ bay ra và thẻ mới trượt vào; rung khi sai, sáng xanh khi đúng | 1 |
| Tiến độ | Thanh tiến độ trong buổi; chấm cấp ghi nhớ 1→5 sáng lên; vòng mục tiêu hôm nay được tô dần | 1–2 |
| Tổng kết buổi | Đếm số dần lên, "+XP" bay lên, pháo giấy khi đạt mục tiêu | 1 (cơ bản), 4 (điểm, huy hiệu) |
| Danh sách từ, bộ từ | Mục mới trượt vào, mục xóa thu lại; thẻ từ phóng to thành trang chi tiết | 1 |
| Thống kê | Biểu đồ vẽ dần lên | 2 |
| Động lực | Ngọn lửa chuỗi ngày, huy hiệu mới (Lottie) | 3–4 |
| Bản app Android/iOS | Rung nhẹ khi đúng/sai (Capacitor Haptics) | 3 |

Nguyên tắc:

1. Chỉ animate `transform` và `opacity` (chạy bằng GPU) để giữ 60 khung hình/giây trên máy tầm trung.
2. Hiệu ứng trong vòng ôn dài 150–300 ms, không làm chậm nhịp học. Hiệu ứng lớn chỉ dùng lúc kết thúc buổi hoặc đạt cột mốc.
3. Tôn trọng chế độ giảm chuyển động của hệ điều hành; có thêm nút "Giảm hiệu ứng" và nút tắt âm thanh hiệu ứng trong cài đặt.
4. Thời lượng và đường cong chuyển động lấy từ một file cấu hình chung (`src/lib/motion.ts`) để cả app đồng bộ.
5. Lottie và pháo giấy chỉ tải khi cần, để app mở nhanh.

---

## 4. Lộ trình theo giai đoạn

Ước lượng giả định bạn dành **10–15 giờ/tuần** và dùng Claude Code để viết phần lớn mã. Mỗi giai đoạn kết thúc bằng một bản chạy được trên điện thoại thật.

### Giai đoạn 0 — Nền móng (1 tuần)

> **Trạng thái 23/10/2026:** phần mã đã xong (khung app 5 tab có hiệu ứng, PWA, `core/` + 37 test, CSDL trên thiết bị, schema Supabase đã kiểm tra RLS). Đã phát hành thử tại https://english-vocab.lionelmahn.workers.dev. Đã kết nối Supabase (dự án `english-vocab`, vùng Tokyo, đã tắt đăng ký công khai) và có đăng nhập, đăng xuất, quên mật khẩu (R1.2, R1.3 làm sớm).

- Tạo dự án React + Vite + TypeScript, Tailwind, PWA; phát hành thử lên Cloudflare.
- Tạo dự án Supabase; viết schema (mục 3.4) và bật Row Level Security.
- Viết `core/`: bọc ts-fsrs, bảng quy đổi điểm (2.3a), 5 cấp (2.3b), kèm unit test.
- Khung giao diện điện thoại: 5 tab dưới cùng — **Hôm nay · Sổ tay · Tra từ · Thống kê · Cá nhân**; nền tảng hiệu ứng (Motion, cấu hình chuyển động chung, chế độ giảm hiệu ứng, chuyển tab có trượt).
- **Xong khi:** mở được link web trên iPhone/Android, "Thêm vào màn hình chính" được, test `core/` chạy xanh.

### Giai đoạn 1 — Vòng học lõi: MVP dùng hằng ngày (4–6 tuần, 43 chức năng)

> **Trạng thái 23/10/2026:** đã làm xong và phát hành cả 43 chức năng. Gồm: Sổ tay và Bộ từ; học mới bằng thẻ lật, kiểm tra ngay và "đã biết từ này"; ôn FSRS với trắc nghiệm, gõ từ, nghe viết và thẻ tự đánh giá; luyện lại khi sai; tạm dừng rồi tiếp tục; tổng kết buổi; phát âm Anh–Mỹ/Anh–Anh có đọc chậm; nhập CSV/Excel/Anki; cài đặt học tập; tự sao lưu lên Supabase khi đăng nhập. Có 84 test tự động.
> **Cập nhật 24/10/2026 (bản 0.3.0):** làm lại trải nghiệm học/ôn theo mẫu bạn gửi. Gồm: thẻ từ mới hiện câu ngữ cảnh trước; chọn phương án rồi bấm "Kiểm tra"; "Chọn nghĩa của từ được gạch chân"; "Điền từ" theo ô chữ có gợi ý; bảng kết quả trượt lên (xanh/đỏ); nhân vật riêng của app; thanh tiến độ có nhân vật chạy theo; trang Hôm nay dạng biểu đồ 5 cấp; màn "Đang cập nhật lịch ôn". Làm sớm từ giai đoạn 4: R6.10 (nghe chọn nghĩa), R6.11 (chọn âm thanh đúng / điền chỗ trống bằng âm thanh) và một phần R6.9 (gợi ý chữ cái).

> **Cập nhật 24/10/2026 (bản 0.4.0):**
> - **Âm thanh:** từ và cụm ngắn ưu tiên bản ghi giọng người thật (Wiktionary/Wikimedia Commons, MP3 để iPhone phát được), tra trước khi vào buổi học và lưu trên máy. Câu ví dụ và từ chưa có bản ghi dùng giọng máy, app tự chọn giọng tốt nhất (Nâng cao/Cao cấp/Siri/Google…), người học chọn được giọng và xem hướng dẫn tải giọng chất lượng cao trong Cá nhân.
> - **Bản 0.4.1:** danh sách giọng bỏ giọng vui nhộn (Bahh, Wobble, Jester…), gộp giọng trùng, ghi rõ “Nâng cao/Cao cấp”. Trên iPhone, app giải thích rằng Apple không cho web dùng giọng tải thêm (đã kiểm tra mã nguồn WebKit: chỉ lấy `isSystemVoice`). Muốn câu ví dụ hay trên iPhone thì cần giọng đọc trên máy chủ (ví dụ Cloudflare Workers AI).
> - **Bản 0.4.2:** trên iPhone/iPad, "Tự động" không gán giọng mà chỉ báo ngôn ngữ (en-US/en-GB). Khi đó WebKit gọi `voiceWithLanguage`, trả về giọng người dùng chọn trong Cài đặt → Trợ năng → Nội dung được đọc (kể cả giọng Nâng cao/Cao cấp đã tải). Cần kiểm tra trên máy thật.
> - **Bản 0.4.3:** thêm "Tốc độ giọng máy" (Rất chậm/Chậm/Vừa/Nhanh). Thử trên iPhone (iOS 26): Safari đọc được Evan (Nâng cao) qua "Tự động", nhưng app mở từ màn hình chính và khi đổi sang Jamie (giọng Anh) thì về Samantha. Nguyên nhân: giọng trong Cài đặt phải cùng vùng với giọng app yêu cầu, và lỗi iOS 26 khiến `AVSpeechSynthesisVoice(language:)` bỏ qua giọng đã chọn (FB20271264). Cách chắc chắn hơn: tạo file âm thanh bằng Phím tắt ("Tạo âm thanh nói từ văn bản") hoặc giọng máy chủ.
> - **Bản 0.5.0 — Giọng iPhone:** trang mới "Giọng iPhone" (Cá nhân → Giọng iPhone). App mở phím tắt `VocabVoice` qua `shortcuts://run-shortcut?...&input=text` (mỗi mục một dòng, 40 mục/lượt). Phím tắt dùng "Tạo âm thanh đọc từ văn bản" với giọng Nâng cao/Cao cấp người học chọn, mã hóa Base64, nối bằng "|" và chép vào bảng tạm. Người học quay lại bấm "Dán âm thanh". App kiểm tra số file khớp số mục, nhận diện định dạng, từ chối kết quả cũ, rồi lưu vào IndexedDB (bảng `voiceClips`, chỉ trên máy, chưa đồng bộ). Thứ tự phát âm: giọng iPhone → bản ghi Wiktionary → giọng máy.
> - **Bản 0.5.4:** Điền từ: chữ gợi ý chỉ hiện mờ, người học vẫn gõ đủ mọi chữ (trước đây ô gợi ý bị nhảy qua). Giọng iPhone: app chép danh sách vào bộ nhớ tạm, phím tắt đọc từ "Bảng nhớ tạm"; thanh "Dán âm thanh" nổi ở mọi trang; trang từ có nút "Tạo giọng" cho từ mới; trang thêm từ ghi chú rằng giọng iPhone có sau khi lưu.
> - **Bản 0.5.5:** thẻ giới thiệu từ mới luôn hiện tiếng Anh trước (câu ngữ cảnh gạch chân từ), lật mới ra nghĩa. Cài đặt "Mặt trước thẻ khi ôn" chỉ áp dụng cho kiểu ôn bằng thẻ tự đánh giá.
> - **Bản 0.5.6:** mặt trước thẻ từ mới: từ cần học in đậm ở trên, câu ví dụ (gạch chân từ) ngay bên dưới.
> - **Bản 0.5.7:** Điền từ: sửa lỗi không xóa được chữ khi gõ bằng bàn phím tiếng Việt (Telex tách "ả" thành "ar" khi xóa, vượt giới hạn số chữ nên bị chặn). Giờ luôn nhận thao tác xóa, giới hạn rộng hơn, không lọc dấu thanh rời; báo "Thừa n chữ"; nhắc chuyển sang bàn phím tiếng Anh khi gõ ra chữ có dấu (cả bài Nghe viết).
> - **Bản 0.5.8:** Điền từ: đã đủ ô mà gõ thêm thì không nhận chữ thừa; ô chữ cuối rung và gạch dưới nháy đỏ (Android rung máy nhẹ) thay cho dòng cảnh báo. Xóa luôn được nhận.
> - **Học từ mới:** xem thẻ xong là "Điền từ" ngay cho từ đó (trước đây xem hết 5 thẻ mới kiểm tra).
> - **Điền từ:** lộ sẵn vài chữ (1 chữ với từ 4–6 chữ cái, 2 với 7–12, tối đa 3; từ ≤3 chữ không lộ) ở **vị trí ngẫu nhiên, mỗi lần làm bài một kiểu** để không nhớ theo vị trí. Chữ lộ sẵn không tính là gợi ý; bấm "Gợi ý" lộ thêm chữ ở ô đang gõ và tính mức Khó (R6.9).
> **Giới hạn đến bản 0.5.8:** sao lưu chỉ gửi lên một chiều, dữ liệu tạo trên máy này chưa hiện trên máy khác. Đã giải quyết ở bản 0.6.0 (giai đoạn 2: đồng bộ hai chiều).
- Tài khoản: R1.2, R1.3 (tài khoản cá nhân tạo sẵn, chưa cần trang đăng ký)
- Sổ tay: R2.1, R2.2, R2.3, R2.4, R2.5, R2.7, R2.9
- Bộ từ: R3.1, R3.2, R3.3, R3.4, R3.6
- Học mới: R4.1 → R4.8
- Ôn tập: R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R5.9, R5.10, R5.11, R5.12
- Dạng bài: R6.1 (trắc nghiệm nghĩa), R6.2 (gõ từ từ nghĩa), R6.3 (nghe viết), R6.7 (chấm), R6.12 (tạm bỏ âm thanh)
- Âm thanh: R7.1 (IPA + giọng đọc trên máy), R7.6 (tốc độ), R7.7 (dịch câu ví dụ)
- Dữ liệu: R11.1 (lưu cục bộ + tự đẩy lên đám mây), R11.2 (nhập CSV/Excel theo mẫu, xem trước, báo lỗi, xử lý trùng)
- Cài đặt: R14.2 (giọng, tự phát âm, chiều flashcard)
- **Xong khi:** bạn nhập được danh sách từ đang có, học mới bằng flashcard, ôn theo lịch FSRS với 3 dạng bài, dữ liệu tự sao lưu lên đám mây. Đây là lúc có thể bỏ phần mềm trả phí.

### Giai đoạn 2 — Hoàn thiện toàn bộ P1 (4–5 tuần, 21 chức năng)

> **Trạng thái 24/10/2026 (bản 0.6.0):** bắt đầu giai đoạn 2 bằng dữ liệu nhiều thiết bị. Xong R11.4, R11.5, R11.7 và phần "bản sao lưu có tiến độ" của R11.3 (P1: 46/64).
> - **Đồng bộ hai chiều (R11.5):** mỗi lượt đồng bộ kéo thay đổi trên máy chủ về và gộp trước, rồi mới gửi thay đổi của thiết bị lên. Tự chạy khi mở app, sau mỗi thay đổi, khi quay lại app, khi có mạng lại và mỗi 2 phút; có nút "Đồng bộ ngay". Kéo theo trang (server_updated_at, id) và kéo chồng lấn 60 giây để không sót dòng ghi xong muộn. Không cần chạy thêm SQL trên Supabase.
> - **Xử lý xung đột (R11.7):** gộp ba chiều theo từng trường, so với bản đã đồng bộ lần trước (bảng `syncBase` trên thiết bị). Sửa khác trường trên hai máy thì giữ cả hai; cùng sửa một trường thì bản sửa sau thắng (hai máy chọn giống nhau). Lượt trả lời chỉ thêm, gửi trước lịch ôn. Lịch ôn bị đổi ở cả hai máy, hoặc thiếu lượt trả lời, được tính lại từ toàn bộ lượt trả lời.
> - **Sao lưu ra file và khôi phục (R11.4, một phần R11.3):** Cá nhân → Sao lưu và khôi phục. File .json gồm từ, bộ, lịch ôn, lịch sử học và cài đặt học (trừ giọng máy, phím tắt). iPhone lưu qua bảng chia sẻ ("Lưu vào Tệp"). Khi khôi phục, app kiểm tra file (bỏ qua dòng hỏng), cho xem trước, chọn **Gộp** hoặc **Thay thế**, xử lý từ trùng. Cách nào cũng không mất lượt học. Có thêm nút "Tải lại toàn bộ từ máy chủ".
> - **Gộp từ trùng:** từ cùng mặt chữ, loại từ và nghĩa (thường do nhập cùng một danh sách trên hai máy trước khi có đồng bộ) được gộp: giữ mục có tiến độ cao nhất, bổ sung thông tin còn thiếu, chuyển bộ từ, giữ lịch sử. Sổ tay hiện dòng nhắc khi có từ trùng.
> - **Kiểm thử:** 162 test, gồm mô phỏng hai thiết bị đồng bộ qua Postgres chạy đúng file migration Supabase (ôn cùng một từ khi mất mạng, sửa cùng lúc, xóa khi máy kia đang sửa, ghi đè gần cùng lúc, hơn 1.000 dòng, lỗi mạng giữa chừng). Cú pháp truy vấn kéo đã thử với Supabase thật.
> - **Chưa làm:** phần "xuất nội dung" (CSV/Excel) của R11.3. Giọng iPhone (`voiceClips`) vẫn chỉ nằm trên từng máy. Cài đặt chưa tự đồng bộ, chỉ mang theo được bằng file sao lưu (sẽ đồng bộ theo hồ sơ ở R1.4, R1.5).
> **Cập nhật 24/10/2026 (bản 0.7.0): Tra từ và lưu nhanh.** Xong R15.1, R15.2, R15.3, R15.5, R2.8. Tính thêm R9.1 (trang Hôm nay đã có từ đến hạn, từ mới và tiến độ mục tiêu) và R10.7 (phân bố 5 cấp ở Thống kê) vốn đã làm từ giai đoạn 1 → **P1: 53/64**.
> - **Nguồn từ điển:** Free Dictionary API đang trục trặc (chỉ trả từ đã có trong bộ nhớ đệm, cụm từ báo lỗi 1033), nên dùng thẳng **Wiktionary** (CC BY-SA, 0đ, gọi được từ trình duyệt): nghĩa theo loại từ và câu ví dụ qua REST API; phiên âm Anh–Mỹ/Anh–Anh và gợi ý nghĩa tiếng Việt từ bảng dịch qua mã nguồn trang. Phiên âm viết /r/ thay cho /ɹ/ và bỏ dấu nối cho quen mắt; từ đọc khác theo loại từ ("record" danh từ/động từ) có phiên âm riêng.
> - **Tra từ (R15.1, R15.2):** tab Tra từ tra được từ đơn và cụm từ ("give up", "take care of"), nghe Anh–Mỹ/Anh–Anh, 5 nghĩa đầu mỗi loại từ (bấm xem thêm), ví dụ, dạng biến thể dẫn về từ gốc ("went" → Tra "go"). Kết quả lưu trên máy 30 ngày, tra lại không tốn mạng, mất mạng vẫn xem được từ đã tra.
> - **Lưu nhanh (R15.3 → R2.8):** chạm dấu cộng ở các nghĩa cần học, nhập nghĩa tiếng Việt (có chip gợi ý từ Wiktionary nếu có), chọn bộ từ, giữ hoặc bỏ câu ví dụ. `repo.saveFromSource` là cửa lưu chung (sau này dùng cho bài học, kho chung): nghĩa trùng hẳn với từ đã có (R2.5) không tạo thêm mà chỉ thêm vào bộ đã chọn. Nghĩa đã lưu có dấu ✓, đầu trang báo "Đã có n nghĩa trong sổ tay".
> - **Không tìm thấy (R15.5):** gợi ý từ gần đúng ("resilent" → resilient), nút "Tự thêm vào sổ tay" mở form với từ đã điền. Gợi ý bằng AI chờ giai đoạn 5.
> - **Kiểm thử:** 186 test (thêm bộ đọc dữ liệu Wiktionary, tra từ với mạng giả, lưu nhiều nghĩa). Đã thử trên trình duyệt với Wiktionary thật: resilient, give up, went, record, resilent.
> - **Còn lại của giai đoạn 2 (11 chức năng P1):** R1.4, R1.5, R1.7 + bộ từ khởi đầu, R9.2, R10.1, R10.2, R10.4, R7.8, R13.8, R11.3 (xuất CSV/Excel), R14.3.

> **Cập nhật 24/10/2026 (bản 0.8.0): Hồ sơ, mục tiêu, lịch học và đồng bộ cài đặt.** Xong R1.4, R1.5, R9.2 → **P1: 56/64**.
> - **Hồ sơ (R1.4):** Cá nhân → chạm vào thẻ tên. Tên hiển thị, ảnh đại diện (thu về 192×192 JPEG, lưu thẳng trong hồ sơ, không cần kho file), trình độ tự đánh giá (5 mức A1 → C1–C2), mục đích học (chọn nhiều + tự ghi).
> - **Mục tiêu (R1.5) và lịch học (R9.2):** Cá nhân → Đổi mục tiêu và lịch học. Từ mới/ngày, phút/ngày, ngày học trong tuần (hiện “T2–T6”, “n ngày/tuần”), giờ học (dùng cho nhắc ôn ở giai đoạn 3), múi giờ. Trang Hôm nay tính ngày học và chuỗi ngày theo múi giờ trong hồ sơ (giống nhau trên mọi máy) và báo “ngày nghỉ theo lịch học”.
> - **Đồng bộ cài đặt:** cài đặt học (giọng Anh–Mỹ/Anh–Anh, từ mới/ngày, tối đa mỗi buổi ôn, kiểu ôn, mặt trước thẻ, tự phát âm, bản dịch ví dụ, ưu tiên giọng người thật, tốc độ giọng máy) nằm trong hồ sơ trên Supabase (cột sẵn có + ô `settings`), không cần chạy SQL. Giọng máy đã chọn, phím tắt, giảm hiệu ứng, âm thanh hiệu ứng vẫn riêng từng máy. Lần đầu mở bản 0.8.0, máy nào đã chỉnh cài đặt thì các mục đã chỉnh được chuyển vào hồ sơ.
> - **Gộp hồ sơ (R11.7):** hai máy sửa hai mục khác nhau thì giữ cả hai; máy chưa từng đồng bộ hồ sơ mà sửa một mục thì chỉ mục đó đè lên máy chủ, tên/mục tiêu đang có không bị xóa (dùng giá trị mặc định làm bản gốc khi gộp).
> - **Sao lưu:** file sao lưu có thêm hồ sơ; khôi phục có lựa chọn “Dùng cả hồ sơ và cài đặt học”.
> - **Kiểm thử:** 199 test (thêm đồng bộ hồ sơ giữa hai máy, đọc/ghi hồ sơ với schema thật, làm sạch dữ liệu hồ sơ, lịch học). Đã thử trên trình duyệt: sửa hồ sơ, ảnh đại diện, mục tiêu, lịch học, chuyển cài đặt cũ vào hồ sơ, cài đặt đổi theo khi hồ sơ đổi từ máy khác; cú pháp truy vấn hồ sơ đã thử với Supabase thật.
> - **Còn lại của giai đoạn 2 (8 chức năng P1):** R1.7 + bộ từ khởi đầu, R10.1, R10.2, R10.4, R7.8, R13.8, R11.3 (xuất CSV/Excel), R14.3.

> **Cập nhật 24/10/2026 (bản 0.9.0): Thống kê và xuất từ vựng.** Xong R10.1, R10.2, R10.4, R11.3 → **P1: 60/64**.
> - **Tổng quan (R10.1):** trang Thống kê mở đầu bằng 4 ô: trong sổ tay, chưa học, đang học (đã có lịch ôn), đến hạn ôn.
> - **Mục tiêu (R10.4):** hôm nay so với mục tiêu từ mới và số phút; dải 7 ngày của tuần (T2 → CN) đánh dấu ngày đạt mục tiêu, có học chưa đủ, bỏ lỡ, nghỉ theo lịch, hôm nay chưa học. Một ngày đạt khi học đủ số phút (gồm cả ôn tập). Thời gian học ước tính từ lượt trả lời: câu đầu buổi tính thời gian trả lời, các câu sau tính khoảng cách tới câu trước, tối đa 3 phút, để bỏ app mở không bị tính.
> - **Hoạt động (R10.2):** chọn 7 ngày / 30 ngày / 12 tuần; 4 ô lượt trả lời (so với kỳ trước), từ mới đã học, tỷ lệ đúng, thời gian học; biểu đồ cột chồng ôn tập / học từ mới (màu đã kiểm tra phân biệt được với người mù màu ở cả chế độ sáng và tối), chạm vào cột để xem số, có bảng số liệu thay cho biểu đồ. Mọi số liệu tính lại từ lịch sử trả lời theo múi giờ hồ sơ nên khớp trên mọi máy.
> - **Xuất từ vựng (R11.3):** Sao lưu, khôi phục, xuất file → Xuất từ vựng ra file: CSV (UTF-8, mở được bằng Excel/Google Sheets), chọn mọi từ hoặc một bộ, tùy chọn gồm từ đã lưu trữ. Cột trùng với file mẫu của trang Nhập nên nhập lại được; thêm cột cấp ghi nhớ, ngày ôn tiếp theo, yêu thích, từ khó, lưu trữ để xem.
> - **Kiểm thử:** 209 test (thêm tính hoạt động theo ngày, thời gian học, mục tiêu tuần, xuất CSV và nhập lại). Đã thử trên trình duyệt với 30 ngày lịch sử mẫu ở chế độ sáng và tối; sửa lỗi đổi khoảng thời gian khi đang chọn cột.
> - **Còn lại của giai đoạn 2 (4 chức năng P1):** R1.7 (thiết lập lần đầu) + bộ từ khởi đầu NGSL/TSL, R7.8 + R13.8 (âm thanh), R14.3 (hướng dẫn). Cần chốt: cách có nghĩa tiếng Việt cho bộ từ khởi đầu, có dùng giọng máy chủ (Google/Azure) hay không.

> **Cập nhật 25/10/2026 (bản 0.10.0): Thiết lập lần đầu, bộ 1.000 từ khởi đầu và âm thanh của người học.** Xong R1.7, R7.8, R13.8 → **P1: 63/64**. Chọn hướng 0đ: không dùng giọng máy chủ Google/Azure, không dùng API AI trả phí.
> - **Bộ từ khởi đầu:** 1.000 từ đầu của NGSL 1.2 (CC BY-SA 4.0), mỗi từ có nghĩa tiếng Việt chính, loại từ, một câu ví dụ chứa đúng từ đó và bản dịch câu; nghĩa và câu ví dụ soạn ngay trong lúc làm, đã rà soát lại, cùng giấy phép CC BY-SA. Dữ liệu là một file riêng (~110 KB) chỉ tải khi thêm bộ. Học theo thứ tự phổ biến; từ đã biết thì “Mình đã biết từ này”. Thêm lại không tạo bản trùng.
> - **Thiết lập lần đầu (R1.7):** máy chưa có từ nào và chưa qua màn chào thì mở 5 bước: chào hỏi (có “Tôi đã có tài khoản”), trình độ + mục đích, mục tiêu từ mới/phút mỗi ngày, giọng + ngày học + giờ học, bộ từ khởi đầu. Bỏ qua được. Đã đăng nhập thì chờ đồng bộ xong mới quyết định, để máy mới của tài khoản cũ không bị hỏi lại. Sổ tay → Bộ từ → “Thêm bộ có sẵn”, và trang Hôm nay khi sổ tay trống, cũng thêm được bộ này.
> - **Âm thanh của từ (R7.8, R13.8):** trang chi tiết từ có thẻ “Phát âm”, chọn riêng giọng Mỹ/Anh, cho biết đang phát từ nguồn nào. Ghi âm ngay trong app (tối đa 15 giây) hoặc tải file lên (tối đa 2 MB), nghe thử trước khi lưu. “Bản khác” liệt kê mọi bản ghi tiếng Anh của từ trên Wiktionary (gồm cả bản theo loại từ như danh từ/động từ “record”) để nghe, chọn dùng hoặc báo đọc sai. Thứ tự phát: bản người học chọn → Giọng iPhone → Wiktionary (bỏ bản bị báo sai) → giọng máy.
> - **Kho âm thanh trên Supabase:** danh sách âm thanh đồng bộ như dữ liệu học; file nằm trong kho riêng tư `audio` (gói miễn phí 1 GB), mỗi tài khoản một thư mục. Giọng iPhone tạo trên iPhone cũng được tải lên, máy khác tự tải về; xóa ở một máy thì xóa trên mọi máy. **Cần chạy một lần** `supabase/migrations/20261025000000_audio_storage.sql` trong SQL Editor; chưa chạy thì âm thanh chỉ lưu trên máy, dữ liệu học vẫn đồng bộ bình thường và trang Cá nhân có nhắc.
> - **Kiểm thử:** 223 test (thêm bộ từ khởi đầu, chọn bản phát, báo sai, Giọng iPhone đồng bộ qua lại giữa hai máy kể cả tạo lại/xóa/hai máy cùng tạo, ghi âm lên kho, máy chủ chưa chạy SQL âm thanh). Đã thử trên trình duyệt: màn chào đủ 5 bước, thêm 1.000 từ, buổi học đầu tiên, chọn/báo sai bản Wiktionary, tải file, ghi âm (nguồn âm giả), chế độ sáng và tối.
> - **Còn lại của giai đoạn 2 (1 chức năng P1):** R14.3 (hướng dẫn sử dụng).

> **Cập nhật 25/10/2026 (bản 0.11.0): Hướng dẫn sử dụng.** Xong R14.3 → **P1: 64/64, xong giai đoạn 2.**
> - **Trang Hướng dẫn (R14.3):** Cá nhân → “Hướng dẫn sử dụng”. 11 mục chia 4 nhóm: bắt đầu nhanh; thêm từ, học từ mới, ôn tập, lịch ôn hoạt động thế nào; năm cấp ghi nhớ, trang Hôm nay, mục tiêu/chuỗi ngày/thời gian học, tab Thống kê; phát âm và âm thanh, đồng bộ/sao lưu/khôi phục. Có ô tìm không cần gõ dấu (mục chứa nguyên cụm từ xếp trước) và nút sang mục tiếp theo.
> - **Giải thích tại chỗ:** nút “?” mở đúng mục trong bảng trượt ở trang Hôm nay, màn chuẩn bị học và ôn, tab Thống kê (cả trang, “Mục tiêu hôm nay”, “Cấp ghi nhớ”), mục Tiến độ và thẻ Phát âm của một từ, thẻ “Máy chủ và đồng bộ”.
> - **Nội dung khớp với app:** viết từ dữ kiện đọc thẳng trong mã, rồi qua hai vòng đối chiếu từng câu với mã nguồn (60 chỗ sai hoặc dễ hiểu nhầm đã sửa) và một vòng soát câu chữ cho người học. Test tự động kiểm tra mọi tên nút đặt trong “…” có thật trên màn hình; con số mặc định (cấp ghi nhớ, mục tiêu, số mục mỗi lượt Giọng iPhone) lấy thẳng từ mã.
> - **Sửa lỗi tìm thấy khi đối chiếu:** màn tổng kết chỉ đếm từ đã làm tới khi bấm “Kết thúc và xem kết quả”; tổng kết buổi “Luyện lại” có Nhớ/Quên thay vì luôn 0; dấu tích “Thời gian học” chỉ hiện khi học đủ phút thật (khớp dải “Tuần này”); bài thử “Mình đã biết từ này” phải tự điền đúng, dùng gợi ý hay “Tính là đúng” thì không tính là đã biết (trước đây vẫn hẹn ôn xa như Dễ).
> - **Kiểm thử:** 230 test. Đã thử trên trình duyệt: trang Hướng dẫn, tìm không dấu, bảng giải thích ở Thống kê, chế độ sáng và tối, kết thúc buổi học sớm.
> - **Ghi nhận để làm sau:** ~~từ không thuộc bộ nào được học sau mọi từ trong bộ đang bật; bộ thêm sau được học dồn theo vị trí~~ (đã sửa ở 0.11.1); bản ghi âm của người học dùng chung cho các mục cùng cách viết (record danh từ/động từ); mở Cá nhân khi mất mạng báo “Không kiểm tra được máy chủ” thay vì “Đang mất mạng”.

> **Cập nhật 25/10/2026 (bản 0.11.1): Thứ tự học từ mới xen kẽ đều.** Mỗi bộ trong phạm vi là một hàng (theo thứ tự trong bộ), từ không thuộc bộ nào là một hàng nữa (lưu trước học trước); app lấy lần lượt một từ ở mỗi hàng, bộ tạo trước đứng trước, từ nằm trong nhiều bộ chỉ lấy một lần. Trước đây từ không thuộc bộ nào phải chờ học hết các bộ đang bật, và bộ thêm sau bị học dồn cho tới khi bắt kịp vị trí của bộ cũ. Chọn riêng một bộ ở “Phạm vi” vẫn học đúng thứ tự trong bộ đó. Hướng dẫn (mục Học từ mới, Thêm từ) đã cập nhật. 231 test.

> **Cập nhật 25/10/2026 (bản 0.12.0): Bắt đầu giai đoạn 3 — nhắc học và nhắc ôn qua Web Push.** Mã xong R9.3, R9.4, R9.6 (và phần quyền thông báo của R14.5); **chờ bạn cài trên Supabase rồi thử trên iPhone** (docs/CAI_DAT_NHAC_NHO.md). Quyết định: dùng Web Push qua Supabase (0đ), chưa dựng APK Android (bản web cài lên màn hình chính đã nhận được Web Push trên cả iPhone lẫn Android).
> - **Máy chủ:** Edge Function `send-reminders` (supabase/functions/send-reminders/index.ts, một file tự chứa để dán vào trình soạn của Supabase), pg_cron gọi 15 phút một lần kèm khóa riêng `CRON_SECRET` lấy từ Vault. Tự mã hóa Web Push theo RFC 8291 (aes128gcm) và ký VAPID theo RFC 8292 bằng WebCrypto, không dùng thư viện ngoài; test khớp bộ số mẫu trong RFC.
> - **Quyết định nhắc:** nhắc giờ học vào ngày học, trong 2 tiếng kể từ giờ học, nếu hôm đó chưa học và chưa nhắc; nhắc ôn khi có ≥ N từ đến hạn (mặc định 10), tối đa M lần/ngày (mặc định 2), cách lần trước ≥ 3 tiếng, không vừa học trong 1 tiếng; gộp thành một thông báo (thông báo mới thay thông báo cũ); không nhắc trong giờ yên lặng (mặc định 22:00–07:00). Ngày học đổi lúc 4:00 sáng theo múi giờ hồ sơ, giống app.
> - **SQL** (supabase/migrations/20261026000000_reminders.sql): bảng `push_subscriptions` (mỗi máy một dòng, RLS của chủ), `reminder_log` (đếm số lần nhắc mỗi ngày), hàm `reminder_targets()` chỉ cho khóa bí mật của dự án gọi, và lịch pg_cron. Phần bảng và hàm chạy thử trên Postgres (PGlite) trong test.
> - **App:** Cá nhân → Nhắc nhở: bật/tắt trên từng máy (xin quyền, đăng ký, lưu lên máy chủ), gửi thử, danh sách các máy đang nhận, tùy chọn nhắc (lưu trong hồ sơ nên dùng chung mọi máy). Trên iPhone chưa cài app lên màn hình chính thì hướng dẫn cài. Service worker nhận thông báo và mở đúng trang khi chạm. Mỗi lần mở app, đăng ký của máy được gửi lại lên máy chủ. Khóa tạo bằng `npm run push-keys` (khóa riêng nằm trong app/push-keys.local, không lên git). Hướng dẫn thêm mục Nhắc nhở.
> - **Kiểm thử:** 250 test (thêm mã hóa và VAPID theo RFC, quyết định nhắc, xử lý yêu cầu của Edge Function, hàm SQL và quyền trên Postgres, tùy chọn nhắc qua đồng bộ). Đã thử trang Nhắc nhở trên bản dựng thật ở khung điện thoại; chưa thử nhận thông báo thật (cần cài trên Supabase trước).
> - **Còn lại của giai đoạn 3:** R9.5 (đề xuất lượng từ mới theo lượng ôn tồn đọng), R11.6 + R11.8 (học ngoại tuyến, quản lý dữ liệu tải xuống), R14.1 (sáng/tối, cỡ chữ), R14.5 (quyền riêng tư: phần còn lại), R1.6 (phiên đăng nhập, xóa tài khoản), R7.2 (ghi âm để tự so). R10.5 (chuỗi ngày) đã có từ trước.

> **Cập nhật 25/10/2026 (bản 0.12.1): Sửa màn hình trắng ở trang Nhắc nhở.** Hồ sơ lưu trên máy từ trước bản 0.12.0 chưa có mục tùy chọn nhắc nên trang bị lỗi; giờ khi đọc hồ sơ cũ, app tự điền giá trị mặc định cho mục mới (có test). Thêm lớp bắt lỗi chung: trang nào lỗi khi hiển thị sẽ báo “Trang này gặp lỗi” kèm nút tải lại, thay vì màn hình trắng. 251 test.

> **Cập nhật 25/10/2026 (bản 0.12.2): Phiên âm Anh–Mỹ và Anh–Anh cho bộ 1.000 từ.** Bộ từ khởi đầu trước đây chưa có phiên âm; giờ cả 1.000 từ đều có đủ hai giọng, lấy từ Wiktionary (CC BY-SA 4.0, đã ghi nguồn) bằng scripts/starter-ipa.ts, đúng loại từ của mục trong bộ ("present" danh từ /ˈprɛz.ənt/, "lead" động từ /liːd/).
> - **Bộ đọc phiên âm (dùng chung với Tra từ):** chấm điểm từng phiên âm theo nhãn: giọng chuẩn RP/GA trước, rồi nhãn UK/US, rồi phiên âm không nhãn; dạng đọc lướt (weak form), dạng cổ, giọng vùng (SSB, Scotland, Ấn Độ…) chỉ dùng khi không còn gì khác; từ chức năng lấy dạng đọc nhấn (the /ðiː/, to /tuː/). Phiên âm hẹp […] dùng dạng /…/ ở dòng trên. Hiểu thêm nhãn loại từ ({{sense|noun}}, {{a|en|adjective|noun}}), mục "Pronunciation 1/2", tiêu đề Stressed/Unstressed, nhãn riêng từng phiên âm (a2=, q2=). Chuẩn hóa cách viết: Anh–Anh bỏ (r) cuối từ; Anh–Mỹ viết /ɚ/, /ɔr/, không ghi ː; từ một âm tiết không ghi dấu nhấn. Kết quả Tra từ đã lưu trên máy được tra lại theo luật mới.
> - **Ghi tay 10 từ** Wiktionary thiếu hoặc xếp sai: according to, lead, another, positive, thank, issue, any, fight, behind, yeah.
> - **Từ đã có trong sổ tay:** mỗi máy tự điền một lần (sau lần đồng bộ đầu) phiên âm còn trống cho từ của bộ 1.000 từ hoặc từ trùng hẳn nghĩa; không sửa phiên âm người học đã ghi, rồi đồng bộ sang máy khác. Thêm lại bộ cũng điền phần còn trống.
> - **Sửa lỗi đồng bộ Giọng iPhone:** tạo lại một Giọng iPhone ngay sau lần tải lên trước có thể không sang máy kia (dòng mới chỉ khác thời điểm sửa nên bị coi là không đổi); giờ bản tạo lại là dòng mới, file cũ bị xóa khỏi kho. Lỗi lộ ra vì test dùng đồng hồ giả đã lùi về trước giờ thật của máy chủ.
> - **Kiểm thử:** 261 test (thêm test bộ đọc với các đoạn thật của Wiktionary, định dạng phiên âm của cả 1.000 từ, tự điền phiên âm). Đã thử trên trình duyệt: sổ tay cũ chưa có phiên âm được tự điền đúng, trang chi tiết từ và Tra từ hiện phiên âm mới, thêm cả bộ thì 1.000/1.000 từ có đủ hai giọng.

> **Cập nhật 25/10/2026 (bản 0.13.0): Gợi ý số từ mới theo lượng ôn còn tồn (R9.5).** App lấy số phút cần để ôn hết các từ còn đến hạn hôm nay (tới 4:00 sáng mai), trừ vào “Thời gian học mỗi ngày”, phần còn lại chia cho thời gian học một từ mới; tối đa bằng phần mục tiêu từ mới còn thiếu hôm nay. Tốc độ ôn và học mới tính từ lịch sử 30 ngày của chính người học (chưa đủ dữ liệu thì 12 giây/từ ôn, 45 giây/từ mới). Mục tiêu số phút ngắn hơn thời gian học đủ từ mới thì lấy thời gian học đủ từ mới làm mức, để chỉ lượng ôn mới làm giảm gợi ý; đặt 0 phút thì không gợi ý giảm.
> - **Trang Hôm nay:** thẻ “Học từ mới” có thêm dòng gợi ý khi nên học ít hơn hoặc nên ôn trước.
> - **Chuẩn bị buổi học:** chọn sẵn số từ gợi ý (chip có chữ gợi ý) hoặc phần còn thiếu của mục tiêu hôm nay; ôn đã kín thời gian thì có thẻ khuyên ôn trước và nút “Ôn tập trước”. Vẫn chọn học bao nhiêu từ cũng được.
> - **Hướng dẫn:** thêm phần “Gợi ý số từ mới khi còn nhiều từ cần ôn” (bài Học từ mới), cập nhật bài Hôm nay, Mục tiêu; sửa câu cũ ở Bắt đầu nhanh (“App chưa gửi thông báo nhắc”) vì đã có nhắc nhở từ 0.12.0.
> - **Kiểm thử:** 271 test (tốc độ học, gợi ý số từ, hết ngày học). Đã thử trên trình duyệt ở khung điện thoại, sáng và tối: 60 từ đến hạn → gợi ý 4 từ; 80 từ → khuyên ôn trước, nút chuyển sang trang Ôn tập.
> - **Còn lại của giai đoạn 3:** R11.6 + R11.8 (học ngoại tuyến, quản lý dữ liệu tải xuống), R14.1 (sáng/tối, cỡ chữ), R14.5 (quyền riêng tư: phần còn lại), R1.6 (phiên đăng nhập, xóa tài khoản), R7.2 (ghi âm để tự so). Việc nhỏ đang chờ: thêm nút “Đổi giờ học” ở trang Nhắc nhở (bạn hẹn để sau).

> **Cập nhật 25/10/2026 (bản 0.14.0): Dùng khi không có mạng (R11.6) và quản lý dữ liệu tải về (R11.8).** Trang mới Cá nhân → “Dùng khi không có mạng”.
> - **Học ngoại tuyến:** app vốn lưu mọi thứ trên máy nên học, ôn được khi mất mạng; nay trang Hôm nay có dòng “Đang ngoại tuyến.”, trang mới cho xem trạng thái mạng và đồng bộ (số thay đổi chờ gửi, đồng bộ ngay). Khi mất mạng, từ chưa tải bản ghi được đọc ngay bằng giọng máy thay vì chờ lỗi mạng.
> - **Âm thanh ngoại tuyến:** tải file bản ghi Wiktionary về máy theo từng bộ hoặc mọi từ (của giọng đang chọn), kèm bản ghi âm của người học đang nằm trên kho máy chủ; dừng giữa chừng được, rời trang vẫn tải tiếp; xóa theo bộ hoặc xóa hết. Bản đã tải được phát từ máy. Tra bản ghi gộp 20 từ mỗi lần gọi Wiktionary và 50 file mỗi lần gọi Commons. Mỗi từ khoảng 15 KB. Bảng mới trên máy: `offlineAudio` (phiên bản cơ sở dữ liệu 8), không đồng bộ.
> - **Dung lượng:** tổng dung lượng app dùng và giới hạn của trình duyệt; số mục theo loại (sổ tay, âm thanh đã tải, Giọng iPhone, bản ghi âm, kết quả tra từ) kèm nút xóa âm thanh đã tải và kết quả tra từ; nút xin trình duyệt giữ dữ liệu lâu dài.
> - **Hướng dẫn:** bài mới “Dùng khi không có mạng”, thêm dòng về trang Hôm nay. Thẻ “Máy chủ và đồng bộ” tách thành thành phần dùng chung.
> - **Kiểm thử:** 280 test (kế hoạch âm thanh từng từ, tải/phát/xóa file với mạng giả lập, tra gộp). Đã thử trên trình duyệt: tải thật 5 file (77 KB) từ Wikimedia; giả lập mất mạng thì từ đã tải phát từ máy, từ chưa tải đọc bằng giọng máy; sáng và tối ở khung điện thoại.
> - **Còn lại của giai đoạn 3:** R14.1 (sáng/tối, cỡ chữ), R14.5 (quyền riêng tư: phần còn lại), R1.6 (phiên đăng nhập, xóa tài khoản), R7.2 (ghi âm để tự so); việc nhỏ: nút “Đổi giờ học” ở trang Nhắc nhở.

> **Cập nhật 25/10/2026 (bản 0.15.0): Giao diện sáng/tối và cỡ chữ (R14.1).** Cá nhân → Trải nghiệm: “Giao diện” (Theo máy / Sáng / Tối) và “Cỡ chữ” (Nhỏ / Vừa / Lớn / Rất lớn), lưu riêng từng máy.
> - Chọn cố định thì gắn `data-theme` lên trang (CSS có bộ màu tối cho cả hai đường), màu thanh trạng thái đổi theo; index.html áp sẵn trước khi app chạy nên không nháy màu.
> - Cỡ chữ đổi cỡ chữ gốc của trang (93,75–125%); mọi cỡ chữ cố định theo px (190 chỗ) được đổi sang rem nên chữ, khoảng cách và nút phóng to đều nhau. Đã quét 21 trang ở cỡ Rất lớn trên khung điện thoại: không trang nào tràn ngang.
> - Sửa lỗi có sẵn: ô “Điền từ” của từ dài (ví dụ "responsibility", 14 chữ) tràn ra ngoài khung trên điện thoại. Cỡ ô giờ chọn theo từ dài nhất, tính bằng rem, và xuống dòng thay vì tràn khi quá chật.
> - Ngôn ngữ giao diện (phần còn lại của R14.1): giữ tiếng Việt, chưa làm bản tiếng Anh vì app dành cho người học Việt.
> - 280 test. Hướng dẫn cập nhật (bài Bắt đầu nhanh, Đồng bộ: cài đặt riêng từng máy).
> - **Còn lại của giai đoạn 3:** R14.5 (quyền riêng tư: phần còn lại), R1.6 (phiên đăng nhập, xóa tài khoản), R7.2 (ghi âm để tự so); việc nhỏ: nút “Đổi giờ học” ở trang Nhắc nhở.

> **Cập nhật 25/10/2026 (bản 0.16.0): Tài khoản và quyền riêng tư (R1.6, R14.5).** Trang mới Cá nhân → “Tài khoản và quyền riêng tư”.
> - **Tài khoản:** email, lần đăng nhập gần nhất, ngày tạo; “Đổi mật khẩu”; “Đăng xuất mọi máy khác” (thu hồi phiên các máy kia và xóa đăng ký nhắc nhở của chúng). Supabase không cho app xem danh sách phiên đăng nhập, nên app chỉ ghi chú điều này; danh sách máy nhận nhắc nhở có ở trang Nhắc nhở.
> - **Xóa tài khoản:** xóa file âm thanh của tài khoản trong kho, rồi gọi hàm `delete_my_account()` (xóa người dùng; mọi dòng dữ liệu tự xóa theo khóa ngoại). **Cần chạy file supabase/migrations/20261027000000_account.sql trong SQL Editor**; chưa chạy thì app báo rõ. Dữ liệu trên máy đang dùng vẫn giữ. Hàm đã thử trên Postgres giả (xóa đúng người gọi cùng mọi dữ liệu, khách không gọi được); chưa thử với máy chủ thật.
> - **Xóa dữ liệu trên máy này:** xóa cơ sở dữ liệu trên máy, cài đặt và phiên đăng nhập, tắt nhắc nhở của máy này, rồi mở lại app như mới; cảnh báo nếu còn thay đổi chưa gửi. Cả hai thao tác xóa phải gõ chữ XÓA để xác nhận.
> - **Quyền riêng tư:** trạng thái quyền thông báo và micro trên máy, cách đổi; mục “Dữ liệu của bạn đi đâu” (máy này, Supabase, Wiktionary/Wikimedia; không quảng cáo, không theo dõi).
> - Hướng dẫn: bài mới “Tài khoản và quyền riêng tư”. 282 test.
> - **Còn lại của giai đoạn 3:** R7.2 (ghi âm để tự so); việc nhỏ: nút “Đổi giờ học” ở trang Nhắc nhở.

> **Cập nhật 25/10/2026 (bản 0.17.0): Luyện đọc, tự so giọng mình với mẫu (R7.2) — xong giai đoạn 3.**
> - Trang một từ có thẻ “Luyện đọc” (bấm để mở); thẻ giới thiệu từ mới có thêm nút micro cạnh hai nút loa, mở bảng “Luyện đọc”.
> - Bấm micro, đọc to (tối đa 8 giây), rồi “Nghe mẫu”, “Nghe bạn” hoặc “Nghe mẫu rồi nghe bạn” (phát bản mẫu theo đúng nguồn phát âm của app, rồi bản vừa ghi). Bản ghi chỉ nằm trong bộ nhớ, không lưu, không gửi đi.
> - Phần ghi âm tách thành hook dùng chung (`lib/recorder.ts`) cho cả “Ghi âm” ở thẻ Phát âm và luyện đọc.
> - Đã thử trên trình duyệt với micro giả lập (trình duyệt thử chặn micro thật): ghi, dừng, ghi lại, phát mẫu rồi bản ghi đúng thứ tự; báo lỗi đúng khi micro bị chặn. Chưa thử với micro thật trên iPhone.
> - Hướng dẫn: thêm phần Luyện đọc (bài Phát âm), nút micro (bài Học từ mới). 282 test.
> - **Giai đoạn 3 xong** (nhắc nhở, ngoại tuyến, giao diện, tài khoản, quyền riêng tư, luyện đọc). Việc nhỏ còn hẹn: nút “Đổi giờ học” ở trang Nhắc nhở. Tiếp theo: giai đoạn 4 (luyện tập nâng cao).

> **Cập nhật 25/10/2026 (bản 0.18.0): Bắt đầu giai đoạn 4 — điền từ vào câu (R6.4) và ghép từ với nghĩa (R6.5).**
> - “Chọn từ hợp với chỗ trống”: câu ví dụ bị che từ, chọn 1 trong 4 từ (dạng nhận diện, tối đa Nhớ). “Điền từ hợp với câu”: gõ từ theo ô chữ, chỉ có câu có chỗ trống và bản dịch cả câu, không có nghĩa của từ.
> - “Ghép từ với nghĩa”: 4 từ và 4 nghĩa; chỉ từ đang ôn được chấm (ghép đúng ngay là Nhớ, ghép nhầm từ đó hoặc vào nghĩa của nó là Quên); các cặp còn lại khác cả mặt chữ lẫn nghĩa.
> - Vòng luân phiên dạng bài: cấp 1 thêm chọn từ hợp câu và ghép từ; cấp 2–3 thêm chọn từ hợp câu và gõ từ hợp câu; cấp 4–5 thêm gõ từ hợp câu. Từ không có câu ví dụ chứa đúng từ thì đổi sang chọn nghĩa / gõ từ theo nghĩa; sổ tay chưa đủ 4 nghĩa thì đổi sang gõ từ.
> - Hướng dẫn (bài Ôn tập) cập nhật. 284 test. Đã thử cả ba bài trên trình duyệt ở khung điện thoại.

> **Cập nhật 25/10/2026 (bản 0.19.0): Bài kiểm tra tùy chọn (R6.6) và lịch sử bài làm (R6.8).**
> - Thống kê → “Bài kiểm tra”: phạm vi (mọi từ đã học, từ hay quên, một bộ), dạng bài (chọn nhiều; mỗi câu lấy ngẫu nhiên một dạng từ đó làm được), số câu (10–50), thời gian (không giới hạn, 5, 10, 15 phút). Bài kiểm tra không đổi lịch ôn, không có lượt luyện lại; có đồng hồ đếm ngược, hết giờ tự kết thúc, câu chưa làm không tính. Màn kết quả ghi điểm, số câu chưa làm, “Xem lại bài làm”, “Làm bài kiểm tra khác”.
> - Thống kê → “Lịch sử bài làm”: mọi buổi học, ôn, luyện, kiểm tra (mới nhất trước) với số từ, tỷ lệ đúng (theo câu trả lời đầu tiên của mỗi từ), thời gian; chạm để xem từng câu (từ, dạng bài, đúng/sai, thời gian trả lời, gợi ý, lượt luyện lại). Dựng từ lượt trả lời nên có cả buổi làm trên máy khác.
> - 289 test (bài kiểm tra, đếm giờ, chọn dạng bài, lịch sử). Đã thử trên trình duyệt: tạo bài 5 phút, làm sai 1 câu, kết thúc sớm (điểm 0/1, 5 câu chưa làm, lịch ôn không đổi), xem lại bài làm và danh sách lịch sử.

> **Cập nhật 25/10/2026 (bản 0.20.0): Gợi ý cho mọi dạng bài (R6.9) và báo đáp án đúng bị chấm sai (R6.13); R6.10, R6.11 đã có từ trước.**
> - R6.9: bài chọn đáp án (chọn nghĩa, nghe chọn nghĩa, chọn từ hợp với câu, chọn âm thanh) có “Gợi ý” gạch bỏ một phương án sai mỗi lần, còn ít nhất 2 phương án. “Nghe và viết lại”: lần 1 hiện nghĩa, lần 2 hiện chữ đầu và số chữ cái (ví dụ a____). “Điền từ” giữ cách cũ (mở thêm một chữ). Ghép từ không có gợi ý. Dùng gợi ý thì câu đúng tính mức Khó; **số lần dùng gợi ý được lưu vào `hint_level`** của lượt trả lời (trước đây luôn là 0) và hiện trong lịch sử bài làm.
> - R6.13: ở bài gõ (điền từ, điền từ hợp với câu, nghe và viết), câu sai chưa được ghi ngay mà hiện bảng “Chưa đúng” chờ người học chọn: “Tiếp tục” (giữ kết quả sai) hoặc “Đáp án của mình cũng đúng” — câu đã gõ được thêm vào đáp án chấp nhận của từ (đồng bộ như sửa từ) và lượt này tính là đúng. Phải quyết trước khi ghi vì lượt trả lời trên máy chủ không sửa được. Phần “gửi báo lỗi” làm cùng R14.4.
> - R6.10 (nghe và chọn nghĩa) và R6.11 (chọn âm thanh theo nghĩa) đã có từ bản 0.3.0, nay đánh dấu xong.
> - Hướng dẫn cập nhật (bài Học từ mới và Ôn tập). 291 test. Đã thử trên trình duyệt (sáng và tối): gợi ý ở bài chọn ghi mức Khó với 2 gợi ý; gõ “jog” cho “run” rồi báo đáp án cũng đúng (lượt tính Nhớ, “jog” vào đáp án chấp nhận); giữ kết quả sai bằng phím Enter; gợi ý bài nghe viết.

> **Cập nhật 25/10/2026 (bản 0.21.0): Ôn chủ động trước hạn (R5.7) và tạm dừng / học lại từ đầu (R5.8).**
> - R5.7: trang `/practice` “Ôn chủ động”, mở từ Hôm nay (“Ôn chủ động trước hạn”, khi không còn từ đến hạn), Thống kê (thẻ đổi tên “Luyện thêm và lịch sử”), trang bộ từ (nút “Ôn chủ động” và khi chọn nhiều từ), màn ôn trống. Phạm vi: sắp đến hạn (chưa tới hạn, gần hạn trước), từ hay quên, mọi từ đã học, một bộ, hoặc từ đã chọn; 10/20/30 từ. Chế độ `practice`: không đổi lịch ôn, chỉ ghi lịch sử; sai thì luyện lại trong buổi; dạng bài theo cấp như ôn nhưng đổi ngẫu nhiên. Còn từ đến hạn thì trang nhắc ôn theo lịch. Thẻ tự đánh giá ở lượt không tính lịch (luyện lại, ôn chủ động) không còn ghi thời gian dưới nút; màn chờ cuối buổi ghi “Đang tổng kết” thay vì “Đang cập nhật lịch ôn”.
> - R5.8: mục “Tiến độ” ở trang một từ có “Tạm dừng ôn” / “Bỏ tạm dừng” và “Học lại từ đầu” (hỏi lại trước). Trang bộ từ: chọn nhiều từ → “Tạm dừng ôn” / “Bỏ tạm dừng”. Sổ tay có nút lọc và nhãn “Tạm dừng”. Từ tạm dừng không vào ôn, ôn chủ động (trừ khi tự chọn) và bài kiểm tra. Học lại từ đầu xóa (mềm) lịch ôn; lượt cũ còn trong lịch sử nhưng không tính vào thẻ mới (lọc theo ngày tạo thẻ, đồng bộ đã xử lý sẵn).
> - Sửa kèm: nút hai cột hẹp ở khung điện thoại bị ép mất biểu tượng (“Chuyển / thêm…” ở trang bộ từ) do lề trong của Button không ghi đè được — dùng `px-2!`.
> - Hướng dẫn cập nhật (Thêm từ, Ôn tập, Lịch ôn, Năm cấp ghi nhớ). 294 test. Đã thử trên trình duyệt (sáng và tối): ôn chủ động từ trang Hôm nay (lượt ghi `practice`, lịch ôn không đổi, từ sai được luyện lại, tổng kết “Đã ôn chủ động xong!”); tạm dừng rồi học lại một từ; chọn 4 từ trong bộ → tạm dừng 2 từ, ôn chủ động các từ đã chọn.
- Thiết lập & hồ sơ: R1.4, R1.5, R1.7 (lần đầu dùng: mục tiêu, trình độ, giọng, lịch, bộ từ khởi đầu)
- Tra từ & lưu nhanh: R15.1, R15.2, R15.3, R15.5, R2.8
- Âm thanh: R7.8 (bổ sung âm thanh thiếu: lấy từ điển, tạo TTS, tải lên, nghe thử), R13.8 phần cơ bản
- Hôm nay & lịch học: R9.1, R9.2
- Thống kê: R10.1, R10.2, R10.4, R10.7
- Dữ liệu: R11.3 (xuất), R11.4 (khôi phục bản sao lưu), R11.5 (đồng bộ 2 chiều nhiều thiết bị), R11.7 (xử lý xung đột)
- Hướng dẫn: R14.3
- Nội dung: nạp bộ từ khởi đầu NGSL/TSL có nghĩa tiếng Việt
- **Xong khi:** đủ 64/64 chức năng P1. Học xen kẽ trên điện thoại và máy tính không mất hay nhân đôi lượt học (có test tự động mô phỏng 2 thiết bị).

### Giai đoạn 3 — Điện thoại, nhắc nhở, ngoại tuyến (3–4 tuần, 11 chức năng)
- Nhắc nhở: R9.3, R9.4 (gộp thông báo), R9.5, R9.6 (giờ yên lặng, tần suất). Web Push cho PWA; thông báo cục bộ khi chạy bản Capacitor
- Ngoại tuyến: R11.6, R11.8 (tải/xóa bộ từ và âm thanh, xem dung lượng)
- R14.1 (sáng/tối, cỡ chữ), R14.5 (quyền riêng tư), R1.6 (phiên đăng nhập, xóa tài khoản)
- R7.2 (ghi âm và nghe lại), R10.5 (chuỗi ngày học)
- Build APK Android bằng Capacitor (cài trực tiếp, 0đ)
- **Xong khi:** nhận nhắc ôn đúng giờ trên iPhone và Android; học trọn một buổi khi tắt mạng, có mạng lại thì tự đồng bộ.

### Giai đoạn 4 — Luyện tập nâng cao (4–5 tuần, 17 chức năng)
- Dạng bài: R6.4, R6.5, R6.6, R6.8, R6.9, R6.10, R6.11, R6.13
- Ôn tập: R5.7 (ôn chủ động), R5.8 (tạm dừng/đặt lại), R5.13 (tối ưu tham số FSRS khi đủ lịch sử, khoảng vài trăm lượt ôn trở lên)
- Thống kê & động lực: R10.3 (điểm yếu), R10.6 (điểm kinh nghiệm, huy hiệu)
- Khác: R2.6 (ảnh, âm thanh, mẹo nhớ), R3.5 (sao chép bộ), R15.4 (lịch sử tra), R14.4 (báo lỗi tại chỗ)

### Giai đoạn 5 — Trợ lý AI và phát âm nâng cao (3–4 tuần, 12 chức năng)
- AI: R8.1 → R8.8 (gợi ý thông tin từ, giải thích theo ngữ cảnh, ví dụ cá nhân hóa, mẹo nhớ, tạo bài luyện, sửa câu, hội thoại, quản lý mức dùng)
- R7.3 (chấm phát âm qua dịch vụ như Azure Speech), R7.4 (kết hợp từ), R7.5 (từ dễ nhầm)
- R1.8 (kiểm tra trình độ đầu vào, dựa trên các dải tần suất của NGSL)
- Nếu muốn tra từ có sẵn nghĩa tiếng Việt sớm hơn, có thể kéo riêng R8.1 lên giai đoạn 2.

### Giai đoạn 6 — Khóa học và lộ trình (2–3 tuần, 6 chức năng)
- R16.1 → R16.6. Khóa học dùng lại luồng học R4 và lưu từ qua R2.8; nội dung khóa ban đầu soạn bằng file seed.

### Giai đoạn 7 — Mở rộng cộng đồng (chỉ khi mở cho người khác, 16 chức năng P3)
- R1.1 (đăng ký), R10.8 (bảng xếp hạng), R12.1 → R12.6 (kho chung, chia sẻ), R13.1 → R13.7 (quản trị), R13.8 mở rộng, R16.7 (biên soạn khóa học)
- Cân nhắc đưa lên Google Play và App Store ở giai đoạn này.

**Tổng thời gian ước lượng:** P1 xong sau ~2,5–3 tháng; P1 + P2 xong sau ~5–6 tháng.

---

## 5. Chi phí ước tính

### 5.1 Hạ tầng

| Hạng mục | Cách làm khuyến nghị | Chi phí |
|---|---|---|
| Lưu trữ web | Cloudflare Workers (file tĩnh) | 0đ |
| Máy chủ, CSDL | Supabase gói miễn phí (khoảng 500 MB CSDL, 1 GB file; dự án tạm dừng nếu 7 ngày không dùng — kiểm tra lại khi đăng ký) | 0đ; gói Pro 25 USD/tháng nếu vượt |
| Tên miền | Dùng tên miền phụ miễn phí `*.pages.dev` | 0đ (tên miền riêng khoảng 300 nghìn đồng/năm, tùy chọn) |
| Android | PWA, hoặc file APK cài trực tiếp | 0đ. Google Play: 25 USD một lần; tài khoản cá nhân mới phải thử nghiệm kín với khoảng 12 người trong 14 ngày |
| iPhone | PWA trên màn hình chính | 0đ. App Store: 99 USD/năm, cần máy Mac hoặc dịch vụ build đám mây |
| Giọng đọc TTS | Hạn mức miễn phí của Google/Azure | 0đ ở mức cá nhân |

### 5.2 AI (tùy chọn) — giá tham khảo tháng 10/2026

Giả định dùng cá nhân: khoảng 20 yêu cầu ngắn/ngày (gợi ý nghĩa, ví dụ, mẹo nhớ, sửa câu) và 10 buổi hội thoại/tháng.

| Model | Giá (USD / 1 triệu token vào – ra) | Ước tính / tháng |
|---|---|---|
| Claude Opus 5.5 | 4 – 20 | ~9–10 USD (~250 nghìn đồng) |
| Claude Sonnet 5.5 | 2 – 10 | ~5 USD (~120 nghìn đồng) |
| Claude Haiku 5.5 | 0,10 – 0,50 | ~0,25 USD (~6 nghìn đồng) |

Chi phí một lần: sinh nghĩa tiếng Việt cho ~2.800 từ NGSL bằng Batch API (giảm 50%) tốn khoảng 13 USD với Opus 5.5, hoặc khoảng 0,3 USD với Haiku 5.5. Mọi con số trên chỉ là ước lượng; lượng token thực tế còn tùy độ dài câu trả lời và mức suy luận.

---

## 6. Rủi ro và cách giảm

| Rủi ro | Cách giảm |
|---|---|
| Phạm vi quá lớn (126 chức năng), dễ bỏ dở | Bám chặt giai đoạn. Không làm P2/P3 trước khi giai đoạn 1 được dùng hằng ngày |
| Lỗi đồng bộ làm mất hoặc nhân đôi kết quả | Lượt trả lời chỉ thêm, có mã duy nhất; thống kê tính từ lịch sử; test tự động mô phỏng 2 thiết bị |
| Giới hạn PWA trên iOS: âm thanh không tự phát khi chưa chạm, dữ liệu có thể bị xóa nếu không cài lên màn hình chính, chạy nền hạn chế | Hướng dẫn cài lên màn hình chính; xin quyền lưu trữ bền (`navigator.storage.persist`); dữ liệu luôn có bản trên đám mây; phát âm thanh sau thao tác chạm |
| Phiên âm hoặc âm thanh sai so với loại từ | Lưu âm thanh theo (từ, loại từ, giọng); có nút báo sai và thay thế (R13.8) |
| Bản quyền dữ liệu từ điển/âm thanh | Chỉ dùng nguồn có giấy phép rõ (CC BY-SA); lưu trường "nguồn" và "giấy phép" cho từng bản |
| Chi phí AI tăng ngoài ý muốn | Lưu lại kết quả, giới hạn lượt/ngày, trần ngân sách/tháng, công tắc tắt AI |
| Gói miễn phí Supabase tạm dừng khi không dùng | Học hằng ngày thì không xảy ra. Nếu xảy ra, dữ liệu vẫn còn và bật lại được |

---

## 7. Cấu trúc thư mục dự án

```
EnglishVocab/
├─ docs/                     tài liệu: đặc tả, kế hoạch này, các quyết định
├─ app/                      ứng dụng React + Vite (PWA), cũng là nguồn cho Capacitor
│  ├─ src/
│  │  ├─ core/               logic thuần: FSRS, chấm điểm, 5 cấp, luật đồng bộ (có unit test)
│  │  ├─ db/                 Dexie: bảng cục bộ, hàng đợi đồng bộ
│  │  ├─ features/           theo nhóm: notebook (R2), decks (R3), learn (R4), review (R5),
│  │  │                      exercises (R6), audio (R7), today (R9), stats (R10), dictionary (R15)...
│  │  ├─ components/         giao diện dùng chung
│  │  └─ services/           gọi Supabase, từ điển, TTS, AI
│  ├─ android/  ios/         do Capacitor sinh ra (từ giai đoạn 3)
├─ supabase/
│  ├─ migrations/            schema SQL + Row Level Security
│  ├─ functions/             Edge Functions: ai, tts, push-reminder, dictionary
│  └─ seed/                  bộ từ khởi đầu (NGSL, TSL)
└─ e2e/                      kiểm thử Playwright trên khung điện thoại
```

---

## 8. Các quyết định cần bạn chốt

1. **Phạm vi người dùng:** chỉ bạn (và gia đình), hay mở cho người khác? Quyết định việc có làm giai đoạn 7 và đưa lên kho ứng dụng hay không.
2. **iPhone:** dùng PWA (0đ) có đủ không, hay cần app trên App Store (99 USD/năm)?
3. **AI:** có bật không; nếu có thì model nào và ngân sách tối đa mỗi tháng?
4. **Dữ liệu cũ:** bạn đang có từ vựng ở đâu (Anki, Quizlet, Excel, app khác)? Cần biết để làm mẫu nhập file R11.2 ngay giai đoạn 1.
5. **Giọng mặc định:** Anh–Anh hay Anh–Mỹ?
6. **Bảng quy đổi điểm FSRS và 5 cấp ghi nhớ** (mục 2.3): giữ như đề xuất hay chỉnh?
7. **Thời gian của bạn:** bao nhiêu giờ mỗi tuần, và bạn muốn tự viết mã hay chủ yếu duyệt mã do Claude viết? Câu trả lời sẽ dùng để điều chỉnh tiến độ.

---

## 9. Bước tiếp theo

Bắt đầu **giai đoạn 0**: khởi tạo dự án `app/` và `supabase/`, viết schema, viết `core/` (FSRS + quy đổi điểm + 5 cấp) kèm test, rồi phát hành bản khung đầu tiên để mở thử trên điện thoại.
