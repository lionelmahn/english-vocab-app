# Thử tiếng Việt của các model AI miễn phí (bản 0.26.0)

Ngày 26/10/2026, trên tài khoản Cloudflare của bạn (gói Workers AI miễn phí). Cả lần thử tốn khoảng **3.000 neuron**, dưới 1/3 hạn mức 10.000 neuron/ngày, **0đ**.

## Cách thử

- Tác vụ giống chức năng gợi ý thông tin từ (R8.1) và mẹo nhớ (R8.4): với mỗi từ, model trả về JSON gồm 1–3 nghĩa thông dụng (loại từ, nghĩa tiếng Việt, câu ví dụ, bản dịch) và một mẹo nhớ. Lời nhắc giống hệt cho mọi model, nhiệt độ 0,3.
- 20 từ: 15 từ nhiều nghĩa trong bộ 1.000 từ (issue, lead, fine, deal, matter, break, charge, figure, present, capital, mean, light, support, raise, cover), so với nghĩa tham chiếu đã soạn; 5 từ ngoài bộ (resilient, procrastinate, take off, look forward to, overwhelm).
- 6 model; Gemma 3 12B không mở cho tài khoản này (lỗi 5018), nên còn 5 model được chấm. Tôi đọc từng câu trả lời và chấm: nghĩa có đúng không, tiếng Việt có tự nhiên không, câu ví dụ và bản dịch có ổn không, mẹo nhớ có dùng được không.

## Kết quả

| Model | Trả đúng JSON | Nghĩa đúng (trên 20 từ) | Tiếng Việt | Mẹo nhớ dùng được | Thời gian trung bình | Neuron mỗi lượt | Số lượt/ngày trong hạn mức |
|---|---|---|---|---|---|---|---|
| **GPT-OSS 120B** | 20/20 | **≈ 19/20** | Tự nhiên nhất, ví dụ hay | ≈ một nửa | 8,2 giây | 55 | ≈ 180 |
| Llama 3.3 70B | 20/20 | ≈ 15/20 | Được, câu ví dụ hơi cụt | Hầu như không | 4,2 giây | 33 | ≈ 300 |
| Llama 4 Scout | 20/20 | ≈ 15/20 | Được | Hầu như không | 4,0 giây | 18 | ≈ 550 |
| Mistral Small 3.1 | 20/20 | ≈ 12/20 | Lủng củng, lặp chữ | Ít | 4,2 giây | 17,5 | ≈ 570 |
| Qwen3 30B | 17/20 | ≈ 13/17 | Được, rất ngắn | Hầu như không (hay trả “None”) | 7,5 giây | 27 | ≈ 370 |

Ví dụ lỗi tiêu biểu:
- **Llama 3.3 70B:** “deal with” dịch là “đàm phán” (đúng là xử lý, giải quyết); “capital letter” thành “chữ cái chính” (đúng là chữ hoa); “take off your shoes” thành “bỏ qua”; “resilient” thành “Cô ấy rất đàn hồi”; mẹo nhớ kiểu “ít sự”, “tắc ông”.
- **Llama 4 Scout:** “issue” (tạp chí) thành “số lượng phát hành”; “charge” ghi loại từ động từ với nghĩa “điện tích”; “capital letter” thành “chữ cái chính”.
- **Mistral Small:** “vấn đề, vấn đề”, “đợi đợi chờ đợi”, “procrastinate” thành “lười biếng làm việc”, “took off his jacket” thành “rút ra áo khoác”.
- **Qwen3 30B:** 3 lần không trả kết quả; “charged with theft” thành “tuyên bố”.
- **GPT-OSS 120B:** chỉ vài lỗi nhỏ, ví dụ “The figure shows…” dịch thành “Hình số cho thấy…” (đúng là “Con số”); mẹo nhớ theo âm đôi khi gượng (“fine” → “cá heo”).

## Kết luận

- **Dùng GPT-OSS 120B làm mặc định.** Nghĩa và câu ví dụ đủ tốt để làm gợi ý (bạn vẫn xem và sửa trước khi lưu). Nhược điểm: chờ khoảng 8 giây mỗi lần; vì kết quả được lưu theo từng từ nên mỗi từ chỉ chờ một lần.
- Giữ Llama 3.3 70B và Llama 4 Scout làm lựa chọn nhanh hơn. Bỏ Mistral Small và Qwen3 30B khỏi app.
- **Mẹo nhớ do AI tạo chưa đáng tin ở mọi model.** Với 1.000 từ khởi đầu, nên soạn sẵn mẹo nhớ trong phiên Claude Code (0đ) như kế hoạch; mẹo nhớ AI chỉ là gợi ý cho từ ngoài bộ.

## Phụ lục: nghĩa từng model đưa ra

| Từ | Tham chiếu (bộ 1.000 từ) | GPT-OSS 120B | Llama 3.3 70B | Llama 4 Scout | Mistral Small | Qwen3 30B |
|---|---|---|---|---|---|---|
| issue | vấn đề | vấn đề; số báo; phát hành | vấn đề; phát hành | vấn đề; phát hành; số lượng phát hành | vấn đề, vấn đề; phát hành, xuất bản; số, kỳ (tạp chí) | vấn đề; phát hành |
| lead | dẫn dắt, lãnh đạo; dẫn đến | dẫn dắt; kim loại chì; manh mối | dẫn dắt; chì | dẫn dắt; chì; sự dẫn đầu | điều khiển, dẫn đầu; dây dẫn, kim dẫn; chì kim loại | (không trả JSON) |
| fine | khỏe; ổn, tốt | tốt, đẹp, mịn; phạt tiền; phạt (tiền) | tốt; tốt; phạt tiền | tinh tế; tuyệt vời; phạt tiền | tốt, đẹp; tiền phạt; phạt tiền | tốt; phạt tiền; phạt |
| deal | thỏa thuận, giao dịch | giao dịch, thỏa thuận; xử lý, giải quyết; vấn đề quan trọng | đàm phán; sự thỏa thuận | sự thỏa thuận; đàm phán; lượng, số lượng | đàm phán, thương lượng; thỏa thuận; phân phối, phân phát | (không trả JSON) |
| matter | quan trọng, có ý nghĩa | chất, vật chất; vấn đề; có quan trọng | vật chất; vấn đề; có tầm quan trọng | chuyện, việc, vấn đề; vật chất, chất liệu; quan trọng, có ý nghĩa | vấn đề, sự việc; có ý nghĩa, quan trọng; chất, vật chất | chất; quan trọng |
| break | giờ nghỉ, sự tạm nghỉ | đập, làm vỡ; khoảng nghỉ; đột nhập, xâm nhập | vỡ; khoảng nghỉ | làm vỡ; ngắt; sự nghỉ | đập vỡ; nghỉ nghơi; khoảnh ngừng | nghỉ giải lao; làm vỡ |
| charge | phí, tiền phải trả | tính phí; phí, tiền thu; buộc tội | yêu cầu trả; sự buộc tội; năng lượng | tấn công; điện tích; phí tổn | trả tiền; sự điều khiển; sự đánh giá | mức phí; tuyên bố; nạp điện |
| figure | con số; hình dáng | số, con số; hình dáng, dáng người; tính toán, tìm ra | hình dạng; tính toán | hình dáng; nhân vật; tính toán | hình dạng; tính toán; con số | hình dáng; tính toán; con số |
| present | món quà | quà tặng; trình bày, đưa ra; hiện tại, có mặt | trình bày; hiện tại; quà tặng | có mặt; hiện tại; tặng | quà tặng; tặng; hiện tại | món quà; trình bày; hiện tại |
| capital | thủ đô; vốn | thủ đô; vốn; viết hoa | thủ đô; vốn; chính | thủ đô; chính; vốn | thủ đô; tiền vốn; chủ yếu | thủ đô; vốn; chính thức |
| mean | có nghĩa là; ý muốn nói | có ý; độc ác; trung bình | có ý định; keo kiệt; có nghĩa là | có ý định; keo kiệt; ác độc | có nghĩa là; tầm thường; trung bình | Keo kiệt; Ý nghĩa; Trung bình |
| light | ánh sáng; đèn | ánh sáng; nhẹ; chiếu sáng | ánh sáng; nhẹ; châm lửa | ánh sáng; thắp sáng; nhẹ | ánh sáng; nhẹ nhàng; đốt sáng | ánh sáng; đốt lửa; nhẹ nhàng |
| support | ủng hộ, hỗ trợ | hỗ trợ, giúp đỡ; sự ủng hộ, giúp đỡ; cấu trúc chịu lực, đỡ | hỗ trợ; sự hỗ trợ; điểm tựa | hỗ trợ, giúp đỡ; sự hỗ trợ; cột trụ | hỗ trợ, ủng hộ; sự hỗ trợ; cột đỡ, cột trụ | sự hỗ trợ; tán thành; khung đỡ |
| raise | nâng lên, giơ lên; nuôi nấng | Nâng lên; Tăng (giá, lương); Tăng lương | nâng lên; nuôi dưỡng; tăng lên | nâng lên; nuôi dưỡng; tăng lên | nâng cao, tăng; nuôi dạy, lớn lên; tạo ra, gây ra | nâng lên; nuôi dạy; tăng |
| cover | che, phủ; bao gồm | che phủ, bọc; tấm bìa, lớp phủ; đề cập, bao gồm | che phủ; bìa | che đậy; bìa sách; đủ để trang trải | bọc, che phủ; bìa, vỏ bọc; báo cáo về | bìa sách; che phủ; báo cáo |
| resilient | — (ngoài bộ) | có khả năng phục hồi; đàn hồi, co dãn | đàn hồi | kiên cường | có khả năng phục hồi; không dễ bị tổn thương | có khả năng phục hồi |
| procrastinate | — (ngoài bộ) | hoãn lại, trì hoãn | trì hoãn | chậm trễ | lười biếng làm việc | trì hoãn |
| take off | — (ngoài bộ) | cất cánh; cởi ra; bùng nổ | cất cánh; bỏ qua | cất cánh; tháo ra; tăng trưởng nhanh | cất cánh; rút ra; bắt đầu thành công | (không trả JSON) |
| look forward to | — (ngoài bộ) | mong chờ, háo hức | mong chờ | mong đợi | đợi đợi chờ đợi | hào hứng chờ đợi |
| overwhelm | — (ngoài bộ) | làm choáng ngợp; đổ ngập, tràn ngập | lấn át; đánh bại | làm choáng ngợp; đánh bại hoàn toàn; lấn át | làm cho ngập ngừng; làm cho quá tải; làm cho cảm động | đổ ập |
