# Kế hoạch giai đoạn 6 — Khóa học và lộ trình

Lập ngày 15/11/2026, sau bản 0.34.0; cập nhật cùng ngày theo quyết định của bạn (mục 7). **Cả giai đoạn 0đ**: không cần dịch vụ trả phí, không thêm bảng trên máy chủ, không phải chạy SQL.

## 1. Tóm tắt

Giai đoạn 6 gồm 6 chức năng P2 trong tài liệu phân rã: R16.1–R16.6. R16.7 (biên soạn khóa học ngay trong app) là P3, để sang giai đoạn 7.

- **Khóa học là các bài học có sẵn trong app.** Mỗi bài có mục tiêu, 8–12 từ và một đoạn đọc ngắn dùng chính các từ đó.
- **Học một bài** gồm ba bước: chọn từ muốn học, lưu vào sổ tay theo cách lưu nhanh (R2.8), rồi học bằng buổi học từ mới quen thuộc (R4).
- **Tiến độ khóa** tính thẳng từ sổ tay và lịch ôn, nên tự đồng bộ giữa các máy và không bao giờ bị đếm hai lần.
- **Nội dung khóa** soạn trong phiên Claude Code như phần nội dung soạn sẵn của bản 0.28.0, có bộ kiểm tra và kiểm tay ngẫu nhiên.

## 2. Các khóa đề xuất

| Khóa | Trình độ | Mục đích | Số từ (bài) | Danh sách từ lấy từ đâu | Công soạn |
|---|---|---|---|---|---|
| 1. **1.000 từ thông dụng theo chủ đề** | A1–A2 | Nền tảng | 1.000 (khoảng 90 bài) | Bộ 1.000 từ đã có trong app (NGSL 1.2); nghĩa, phiên âm, câu ví dụ có sẵn | Thấp: chia chủ đề, viết đoạn đọc |
| 2. Giao tiếp hằng ngày | A2–B1 | Giao tiếp | ~240 (20 bài) | NGSL-Spoken, bỏ các từ đã có trong bộ 1.000 | Trung bình |
| 3. Du lịch | A2–B1 | Du lịch | ~200 (17 bài) | Chọn theo chủ đề trong phiên (sân bay, khách sạn, ăn uống, hỏi đường…) | Trung bình |
| 4. Công việc văn phòng | B1–B2 | Công việc | ~240 (20 bài) | BSL (Business Service List) | Trung bình |
| 5. Luyện thi TOEIC | B1–B2 | Thi cử | ~300 (25 bài) | TSL (TOEIC Service List) | Cao |
| 6. IELTS học thuật | B2–C1 | Thi cử | ~300 (25 bài) | NAWL (New Academic Word List) | Cao |

NGSL-Spoken, BSL, TSL và NAWL cùng nhóm tác giả với NGSL, đăng ở newgeneralservicelist.com. Tôi sẽ kiểm lại giấy phép (NGSL dùng CC BY-SA 4.0) trên trang trước khi dùng. **Tải các file này cần bạn đồng ý.**

**Bạn chọn làm cả sáu khóa trên, và thêm thật nhiều khóa giao tiếp và chuyên ngành cho đa dạng.** Các khóa thêm (mỗi khóa khoảng 150–200 từ, 12–16 bài; từ chọn theo chủ đề trong phiên, kiểm không trùng các khóa khác trừ khi cùng nghĩa):

| Nhóm | Khóa thêm |
|---|---|
| Giao tiếp theo tình huống | Mua sắm; Ăn uống và nấu nướng; Sức khỏe và đi khám; Nhà cửa và đời sống; Cảm xúc và tính cách; Thời tiết và thiên nhiên; Phương tiện và giao thông; Giải trí, thể thao, sở thích; Gia đình và các mối quan hệ |
| Chuyên ngành | Công nghệ thông tin; Kinh doanh và marketing; Tài chính và ngân hàng; Y tế và điều dưỡng; Khách sạn và nhà hàng; Kỹ thuật và sản xuất; Giáo dục; Luật và hành chính; Xây dựng và kiến trúc; Logistics và xuất nhập khẩu |

Thứ tự trong bảng là đề xuất, bạn đổi được bất cứ lúc nào: khóa nào bạn cần trước thì làm trước.

## 3. Từng chức năng

| Mã | Trong app |
|---|---|
| **R16.1** Khám phá khóa học | Trang “Khóa học”, lối vào là một thẻ trên Hôm nay. Có bộ lọc nhóm (nền tảng, giao tiếp, chuyên ngành, thi cử), trình độ và chủ đề, cùng ô tìm. Khóa hợp “Mục đích học” và trình độ trong hồ sơ (hoặc kết quả kiểm tra trình độ) được xếp lên đầu và gắn nhãn “Hợp với bạn”. |
| **R16.2** Xem cấu trúc khóa | Trang một khóa gồm phần giới thiệu, trình độ, số bài, số từ và danh sách chương → bài. Mỗi bài ghi tên, mục tiêu, số từ và trạng thái. |
| **R16.3** Bắt đầu hoặc tiếp tục | Nút “Bắt đầu khóa” hoặc “Tiếp tục: Bài 4 — Ở nhà hàng”. Khóa đang học và bài đang làm lưu trong hồ sơ (ô `settings`, như cài đặt Trợ lý AI), nên máy nào cũng tiếp tục đúng chỗ. Hôm nay có thẻ “Tiếp tục khóa học”. |
| **R16.4** Học theo bài | Trang bài gồm mục tiêu, đoạn đọc và danh sách từ. Trong đoạn đọc, từ của bài được tô đậm và chạm vào là thấy nghĩa; có bản dịch và nút nghe. Bấm “Học bài này” thì app lưu các từ đã chọn vào sổ tay và vào bộ “Khóa: <tên khóa>”, rồi mở buổi học từ mới chỉ gồm các từ đó (thẻ giới thiệu → điền từ…, như học bình thường). Từ đã học rồi thì không học lại. |
| **R16.5** Theo dõi tiến độ | Mỗi bài hiện số từ đã học trên tổng số từ. Bài “Hoàn thành” khi mọi từ đã học hoặc được đánh dấu đã biết. Khóa hiện phần trăm và số bài đã xong. Mọi bài đều mở; bài nên học tiếp (bài đầu tiên chưa xong) có nhãn “Học tiếp”. |
| **R16.6** Chọn từ đưa vào sổ tay | Mỗi từ có ô chọn. Mặc định chọn hết, trừ từ đã có trong sổ tay (hiện “Đã có”). Nút “Mình đã biết từ này” đánh dấu đã biết giống ở kiểm tra trình độ, không phải học lại. Lưu qua `repo.saveFromSource` (R2.8), kèm nghĩa, loại từ, phiên âm và câu ví dụ có bản dịch. |

## 4. Nội dung và cách soạn

- **Nơi lưu:** dữ liệu nằm ở `app/src/data/courses/`, mỗi khóa một file, tải khi mở và có sẵn khi mất mạng. Thêm một mục lục nhỏ cho trang danh sách khóa.
- **Mỗi từ có:** từ, loại từ, nghĩa tiếng Việt, phiên âm Anh–Mỹ và Anh–Anh (lấy từ Wiktionary bằng script, như bộ 1.000 từ), một câu ví dụ kèm bản dịch.
- **Mỗi bài có:** tên, mục tiêu (“Sau bài này bạn nói được…”) và một đoạn đọc 60–120 chữ hợp trình độ của khóa, kèm bản dịch.
- **Cách soạn:**
  - Soạn bằng các tác tử chạy song song, theo một khuôn file.
  - Bộ kiểm tra dò định dạng, đoạn đọc có chứa đủ các từ của bài, một từ không nằm ở hai bài, và từ trùng bộ 1.000 phải cùng loại từ, cùng nghĩa.
  - Sau đó thêm một vòng rà nội dung và kiểm tay ngẫu nhiên.

## 5. Dữ liệu và đồng bộ

- **Không thêm bảng, không phải chạy SQL.** Tiến độ suy ra từ từ vựng và thẻ ôn, vốn đã đồng bộ. Khóa đang học lưu trong ô `settings` của hồ sơ, cũng đã đồng bộ.
- **Nhận ra từ của bài đã có trong sổ tay:** cùng từ và cùng loại từ, theo quy tắc “một mục học = một nghĩa xác định” của tài liệu phân rã.
- **Bộ từ của khóa:** từ của khóa được thêm vào bộ “Khóa: <tên khóa>”, tạo ở lần học bài đầu tiên. Nhờ vậy ôn chủ động, kiểm tra hay lọc trong Sổ tay đều theo khóa được. Mỗi từ ghi nguồn theo giấy phép.
- **Tiến độ ôn dùng chung:** một từ vừa thuộc khóa vừa thuộc bộ 1.000 từ vẫn chỉ là một mục học. Học ở đâu cũng tính tiến độ cho cả hai.

## 6. Lộ trình các bản

| Bản | Nội dung | Thử thế nào |
|---|---|---|
| 0.35.0 | Khung khóa học R16.1–R16.6 và khóa 1 “1.000 từ thông dụng theo chủ đề”; bộ công cụ soạn khóa (khuôn file, bộ kiểm, script phiên âm) dùng lại cho mọi khóa sau | Test cho phần tính tiến độ, chọn và lưu từ; trên trình duyệt: tìm khóa, mở bài, học bài, tiến độ đổi theo, tiếp tục từ Hôm nay |
| 0.36.0 | Giao tiếp hằng ngày, Du lịch | Bộ kiểm nội dung, kiểm tay ngẫu nhiên |
| 0.37.0 | Công việc văn phòng và 2 khóa chuyên ngành đầu (Công nghệ thông tin, Kinh doanh và marketing) | Như trên |
| 0.38.0 | Luyện thi TOEIC, IELTS học thuật | Như trên |
| 0.39.0 trở đi | Mỗi bản 3–4 khóa giao tiếp theo tình huống hoặc chuyên ngành trong bảng mục 2, cho tới hết | Như trên |

Khung khóa học làm một lần ở 0.35.0; các bản sau chủ yếu là nội dung, nên mỗi bản thêm được vài khóa. Trang “Khóa học” có bộ lọc theo nhóm (nền tảng, giao tiếp, chuyên ngành, thi cử), nên nhiều khóa vẫn dễ tìm.

Tùy chọn để sau: “Tạo bài học bằng AI” theo chủ đề bạn gõ (Workers AI, 0đ). App tự kiểm từ và đoạn đọc trước khi dùng. Chỉ nên làm sau khi các khóa soạn sẵn đã chạy ổn.

## 7. Quyết định của bạn (15/11/2026)

1. **Khóa:** làm cả sáu khóa ở mục 2, và thêm thật nhiều khóa giao tiếp, chuyên ngành (bảng khóa thêm ở mục 2).
2. **Mở bài:** mở hết, gợi ý bài nên học tiếp.
3. **Đoạn đọc:** mỗi bài có đoạn đọc ngắn kèm bản dịch.
4. **Tải dữ liệu:** đồng ý tải NGSL-Spoken, BSL, TSL, NAWL từ newgeneralservicelist.com; tôi kiểm giấy phép trên trang trước khi dùng và ghi nguồn trong app.

## 8. Kết quả (16/11/2026)

Đã làm xong mọi khóa trong mục 2, qua các bản 0.35.0–0.44.0: 25 khóa, 5.615 từ và cụm từ (gồm cả 1.000 từ của khóa nền tảng), mỗi bài một đoạn đọc kèm bản dịch, phiên âm hai giọng.

| Nhóm | Khóa |
|---|---|
| Nền tảng | 1.000 từ thông dụng theo chủ đề |
| Giao tiếp | Giao tiếp hằng ngày; Du lịch; Mua sắm; Ăn uống và nấu nướng; Sức khỏe và đi khám; Nhà cửa và đời sống; Cảm xúc và tính cách; Thời tiết và thiên nhiên; Phương tiện và giao thông; Giải trí, thể thao, sở thích; Gia đình và các mối quan hệ |
| Chuyên ngành | Công việc văn phòng; Công nghệ thông tin; Kinh doanh và marketing; Tài chính và ngân hàng; Y tế và điều dưỡng; Khách sạn và nhà hàng; Kỹ thuật và sản xuất; Giáo dục; Luật và hành chính; Xây dựng và kiến trúc; Logistics và xuất nhập khẩu |
| Thi cử | Luyện thi TOEIC; IELTS học thuật |

Từ bản 0.39.0, mỗi khóa được soạn bằng hai quy trình nhiều tác tử: chọn từ theo mảng chia sẵn, đối chiếu trùng với mọi khóa, rà soát độc lập danh sách từ, lấy phiên âm; rồi viết đoạn đọc và rà soát độc lập cả khóa (kiểm cả nghiệp vụ, phép tính, an toàn). Còn để sau: “Tạo bài học bằng AI” (mục 6) và R16.7 biên soạn khóa trong app (giai đoạn 7).
