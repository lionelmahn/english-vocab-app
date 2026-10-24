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
> - **Học từ mới:** xem thẻ xong là "Điền từ" ngay cho từ đó (trước đây xem hết 5 thẻ mới kiểm tra).
> - **Điền từ:** lộ sẵn vài chữ (1 chữ với từ 4–6 chữ cái, 2 với 7–12, tối đa 3; từ ≤3 chữ không lộ) ở **vị trí ngẫu nhiên, mỗi lần làm bài một kiểu** để không nhớ theo vị trí. Chữ lộ sẵn không tính là gợi ý; bấm "Gợi ý" lộ thêm chữ ở ô đang gõ và tính mức Khó (R6.9).
> **Giới hạn hiện tại:** sao lưu mới chỉ gửi lên một chiều. Dữ liệu tạo trên máy này chưa hiện trên máy khác; đồng bộ hai chiều thuộc giai đoạn 2 (R11.5, R11.7). Trong lúc chờ, nên học trên một thiết bị chính.
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
