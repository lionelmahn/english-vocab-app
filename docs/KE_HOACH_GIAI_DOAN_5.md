# Kế hoạch giai đoạn 5 — Trợ lý AI và phát âm nâng cao

Lập ngày 26/10/2026. **Chưa làm gì tốn phí.** Bạn đã chọn hướng A (0đ). Bản 0.26.0 đã có nền tảng AI; kết quả thử tiếng Việt ở [THU_AI_TIENG_VIET.md](THU_AI_TIENG_VIET.md) (model mặc định: GPT-OSS 120B). Giá lấy từ trang giá chính thức và API bảng giá của từng hãng ngày 26/10/2026 (nguồn ở cuối). Tỷ giá dùng để quy đổi: **1 USD ≈ 26.500đ** (giá bán của Vietcombank khoảng 26.100đ, cộng phí thanh toán thẻ quốc tế).

## 1. Tóm tắt

Giai đoạn 5 gồm 12 chức năng: R8.1–R8.8 (trợ lý AI), R7.3 (chấm phát âm), R7.4 (kết hợp từ), R7.5 (từ dễ nhầm) và R1.8 (kiểm tra trình độ đầu vào). R1.8 không cần AI nên luôn là 0đ.

| Hướng | Chi phí mỗi tháng (mức dùng ở mục 2) | Chất lượng | Rủi ro bị tính tiền |
|---|---|---|---|
| **A. 0đ hoàn toàn**: Cloudflare Workers AI (gói miễn phí) + Whisper để nghe phát âm + nội dung soạn sẵn cho bộ 1.000 từ | **0đ** | Tiếng Việt khá, kém Claude; cần thử trước | Không có: vượt hạn mức thì báo lỗi, không tính tiền |
| B. Claude Haiku 5.5 | ≈ 0,35 USD ≈ **9.400đ** | Tốt, nhanh | Có, nhưng đặt được trần ngân sách |
| C. Claude Sonnet 5.5 | ≈ 7,1 USD ≈ **188.000đ** | Rất tốt | Như trên |
| D. Claude Opus 5.5 | ≈ 14,2 USD ≈ **375.000đ** | Tốt nhất | Như trên |
| Thêm (tùy chọn): chấm phát âm từng âm bằng Azure | 0đ trong 5 giờ miễn phí; nếu tính phí ≈ 2,2 USD ≈ **57.000đ** | Chấm từng âm, độ trôi chảy | Có (gói trả phí) |

**Đề xuất:** làm theo hướng A trước, nhưng viết sẵn lớp chọn nhà cung cấp để sau này chỉ cần đổi một cài đặt là dùng Claude. Nếu thử thấy tiếng Việt của model miễn phí chưa đạt, bật Claude Haiku 5.5 (dưới 10 nghìn đồng/tháng) với trần ngân sách. Chấm phát âm làm bản 0đ (Whisper nghe ra từ gì) trước; Azure chỉ thêm khi bạn đồng ý.

## 2. Giả định mức dùng

Một người dùng, khá chăm: khoảng **1.100 yêu cầu AI mỗi tháng** (gần 37 yêu cầu/ngày), chi tiết ở bảng mục 3. Token ra đã cộng 30% cho phần suy luận của model (Opus 5.5 không tắt được suy luận). Thực tế thường rẻ hơn vì **kết quả được lưu theo từng từ, hỏi một lần dùng lại mãi**.

## 3. Từng chức năng

Chi phí là ước tính mỗi tháng theo số lượt ở cột 2.

| Chức năng | Lượt/tháng | Làm gì | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Lựa chọn 0đ |
|---|---|---|---|---|---|---|
| **R8.1** Gợi ý thông tin từ | 150 | Khi thêm hoặc tra từ: gợi ý nghĩa tiếng Việt, loại từ, 2 câu ví dụ (trả về JSON đúng khuôn) để bạn sửa rồi mới lưu | 1.400đ | 27.000đ | 54.000đ | Workers AI; app đã có sẵn gợi ý dịch từ Wiktionary (một phần) |
| **R8.2** Giải thích theo ngữ cảnh | 90 | Dán một câu hoặc đoạn văn, chọn từ: giải thích nghĩa của từ trong đúng câu đó | 900đ | 17.000đ | 35.000đ | Workers AI |
| **R8.3** Ví dụ cá nhân hóa | 150 | Câu ví dụ theo trình độ, mục đích học trong hồ sơ và chủ đề bạn chọn | 1.000đ | 21.000đ | 42.000đ | Soạn sẵn cho 1.000 từ khởi đầu (mục 5); từ khác dùng Workers AI |
| **R8.4** Mẹo ghi nhớ | 150 | Liên tưởng tiếng Việt, tách từ; bấm nhận thì lưu vào ô “mẹo nhớ” của từ | 900đ | 18.000đ | 36.000đ | Như R8.3 |
| **R8.5** Tạo bài luyện | 30 bộ | Bộ câu hỏi mới (câu có chỗ trống mới, chọn từ hợp nghĩa…) từ các từ đang học hoặc hay sai (dùng danh sách từ hay sai của R10.3) | 1.000đ | 21.000đ | 41.000đ | Workers AI; app tự kiểm đáp án trước khi dùng |
| **R8.6** Sửa câu bạn viết | 150 | Viết câu có từ mục tiêu: nhận xét ngữ pháp, cách dùng từ, đưa câu sửa | 1.700đ | 35.000đ | 69.000đ | Workers AI; thêm LanguageTool (API công khai miễn phí, có giới hạn lượt) để soát ngữ pháp |
| **R8.7** Hội thoại luyện từ | 10 buổi × 10 lượt | Đóng vai một tình huống, nhắc dùng các từ đã chọn, cuối buổi tóm tắt từ đã dùng đúng/sai | 1.000đ | 19.000đ | 38.000đ | Workers AI (Llama 3.3 70B hợp hội thoại hơn); nói bằng bàn phím đọc chính tả của iPhone, app đọc lại bằng giọng đã có |
| **R7.4** Kết hợp từ | 90 | Cụm hay đi cùng, giới từ, mẫu câu | 800đ | 17.000đ | 33.000đ | Soạn sẵn cho 1.000 từ; từ khác dùng Workers AI |
| **R7.5** Từ dễ nhầm | 60 | So sánh nghĩa, cách dùng, ví dụ (affect/effect, borrow/lend…) | 700đ | 13.000đ | 27.000đ | Soạn sẵn danh sách cặp dễ nhầm cho 1.000 từ; từ khác dùng Workers AI |
| **R8.8** Quản lý mức dùng | – | Đếm lượt và token, giới hạn lượt/ngày, trần ngân sách/tháng, công tắc tắt AI | 0đ | 0đ | 0đ | Không gọi AI |
| **R7.3** Chấm phát âm | ~1,7 giờ âm thanh (50 lần/ngày × 4 giây) | Xem mục 4 | – | – | – | Whisper trên Workers AI |
| **R1.8** Kiểm tra trình độ đầu vào | 1 lần | Bài kiểm tra vốn từ khoảng 5 phút: lấy từ theo các dải tần suất của NGSL (bộ 1.000 từ đã có, thêm dải 1.000–2.800 nếu soạn tiếp), ước lượng vốn từ, rồi đề xuất trình độ, số từ mới mỗi ngày và đánh dấu sẵn các từ đã biết | 0đ | 0đ | 0đ | Không gọi AI |
| **Tổng** | | | **≈ 9.400đ** | **≈ 188.000đ** | **≈ 375.000đ** | **0đ** |

Chi phí một lần (tùy chọn): soạn nội dung cho cả bộ 1.000 từ (ví dụ theo 3 trình độ, mẹo nhớ, kết hợp từ, cặp dễ nhầm) bằng Batch API của Claude (giảm 50%): Haiku ≈ 0,4 USD (≈ 10.000đ), Sonnet ≈ 7,9 USD (≈ 210.000đ), Opus ≈ 15,8 USD (≈ 420.000đ). Hoặc **0đ** nếu soạn ngay trong phiên Claude Code như đã làm với nghĩa tiếng Việt của bộ 1.000 từ.

## 4. Chấm phát âm (R7.3)

| Cách | Chấm được gì | Chi phí | Ghi chú |
|---|---|---|---|
| **Whisper trên Cloudflare Workers AI** (0đ) | Nghe ra bạn nói từ gì, so với từ mục tiêu: “máy nghe thành *rice* thay vì *rise*” | 0đ: khoảng 47 neuron/phút âm thanh, 50 lần/ngày × 4 giây ≈ 155 neuron/ngày, trong khi hạn mức miễn phí là 10.000 neuron/ngày | Không chấm từng âm. Chạy được trong app đã cài lên màn hình chính, vì ghi âm bằng micro rồi gửi file đi |
| **Azure Pronunciation Assessment** | Điểm từng âm vị, độ chính xác, độ trôi chảy, độ đầy đủ | Gói F0: 5 giờ nhận dạng giọng nói miễn phí mỗi tháng. Trang giá không ghi rõ phần chấm phát âm có nằm trong 5 giờ này không, cần thử trên tài khoản F0. Gói S0: 1 USD/giờ nhận dạng + 0,3 USD/giờ chấm → 1,7 giờ/tháng ≈ 2,2 USD ≈ 57.000đ | Cần tài khoản Azure (xác minh bằng thẻ). Nếu chỉ dùng gói F0 thì hết hạn mức sẽ báo lỗi, không bị tính tiền |
| Nhận dạng giọng nói có sẵn của Safari (Web Speech API) | Như Whisper | 0đ | **Loại**: không hoạt động trong web app đã cài lên màn hình chính trên iPhone |

## 5. Các lựa chọn 0đ

| Lựa chọn | Dùng cho | Giới hạn | Lưu ý |
|---|---|---|---|
| **Cloudflare Workers AI**, gói miễn phí | Mọi chức năng R8, Whisper cho R7.3 | 10.000 neuron/ngày, tính chung mọi model. Với mức dùng ở mục 2: gpt-oss-120b tốn ≈ 2.000 neuron/ngày, Llama 3.3 70B ≈ 4.600, Gemma 3 12B ≈ 1.600 → còn dư nhiều | Bạn đã có tài khoản Cloudflare, app đang chạy trên Cloudflare Workers, nên chỉ cần thêm một đường dẫn API vào chính Worker đó. Tài khoản miễn phí vượt hạn mức thì yêu cầu báo lỗi, **không phát sinh tiền** |
| **Soạn sẵn trong phiên Claude Code** | R8.3, R8.4, R7.4, R7.5 cho 1.000 từ khởi đầu | Chỉ cho danh sách từ cố định, không làm theo yêu cầu riêng lúc đang dùng app | Không tốn thêm tiền ngoài gói Claude bạn đang dùng; chất lượng của Claude; tôi rà lại như đã làm với nghĩa tiếng Việt |
| Google Gemini API, gói miễn phí | Thay Workers AI nếu cần tiếng Việt tốt hơn | Chỉ model Flash; hạn mức thay đổi thường xuyên (sau tháng 4/2026 có nguồn ghi chỉ còn khoảng 100 yêu cầu/ngày) | Ở gói miễn phí, Google được dùng dữ liệu bạn gửi để cải thiện model và người của họ có thể đọc. Không nên gửi nội dung riêng tư |
| LanguageTool, API công khai | Soát ngữ pháp cho R8.6 | Có giới hạn số lượt mỗi phút | Câu bạn viết được gửi tới máy chủ của LanguageTool |

## 6. Kiến trúc chung

- **Một cửa duy nhất:** app gọi `/api/ai` trên chính Worker đang chạy app. Worker kiểm tra phiên đăng nhập Supabase (chỉ tài khoản của bạn gọi được), rồi chuyển yêu cầu tới nhà cung cấp đang chọn: Workers AI (mặc định, 0đ) hoặc Claude. Khóa API, nếu có, do bạn tự đặt bằng `wrangler secret put` và không bao giờ nằm trong app. Tôi không đọc hay lưu khóa này.
- **Lưu kết quả theo từng từ** (bảng `ai_cache` như kế hoạch gốc): hỏi một lần dùng lại mãi, và đồng bộ giữa các máy.
- **R8.8:** bảng `ai_usage` ghi lượt và token. Có giới hạn lượt/ngày (mặc định 100), trần ngân sách/tháng (mặc định 0đ: chưa bật nhà cung cấp trả phí thì không gọi được) và công tắc tắt AI. AI lỗi hoặc đã tắt thì việc học, ôn vẫn chạy bình thường.
- **Không tự sửa dữ liệu:** mọi gợi ý AI đều phải được bạn xem và bấm nhận rồi mới lưu.
- **Không cần SQL cho phần 0đ:** `ai_cache` và `ai_usage` chỉ cần thêm một file SQL khi muốn đồng bộ chúng lên máy chủ. Trước đó dữ liệu lưu trên máy.

## 7. Thứ tự làm đề xuất

| Bản | Nội dung | Chi phí |
|---|---|---|
| 0.26.0 | Nền tảng AI: `/api/ai` + Workers AI, kiểm tra phiên đăng nhập, lưu kết quả, R8.8 (trang “Trợ lý AI” ở Cá nhân: bật/tắt, giới hạn, lượt đã dùng). Thử chất lượng tiếng Việt của vài model miễn phí trên 20 từ mẫu, báo kết quả để bạn chọn | 0đ |
| 0.27.0 | R8.1 gợi ý thông tin từ (form thêm từ, trang Tra từ), R8.4 mẹo nhớ, R8.3 ví dụ cá nhân hóa | 0đ |
| 0.28.0 | R7.4 kết hợp từ, R7.5 từ dễ nhầm + nội dung soạn sẵn cho 1.000 từ | 0đ |
| 0.29.0 | R8.2 giải thích theo ngữ cảnh, R8.6 sửa câu | 0đ |
| 0.30.0 | R8.5 tạo bài luyện, R8.7 hội thoại | 0đ |
| 0.31.0 | R7.3 chấm phát âm bằng Whisper (0đ). Phần Azure làm sau, nếu bạn đồng ý | 0đ |
| 0.32.0 | R1.8 kiểm tra trình độ đầu vào (thêm vào bước thiết lập lần đầu và Cá nhân) | 0đ |

## 8. Cần bạn quyết định

1. Có đi theo hướng A (0đ trước) không, hay bật Claude ngay từ đầu?
2. Nếu sau này bật Claude: dùng model nào, và trần ngân sách mỗi tháng bao nhiêu? Claude API cần thẻ thanh toán quốc tế và nạp credit trước.
3. Có muốn dùng Azure để chấm phát âm từng âm không (cần tài khoản Azure)?
4. Có cho phép dùng Gemini gói miễn phí, với điều kiện Google được đọc dữ liệu gửi đi, không?

## Nguồn giá

- Claude: bảng giá của Anthropic (Haiku 5.5: 0,10/0,50 USD; Sonnet 5.5: 2/10 USD; Opus 5.5: 4/20 USD; Fable 5.1: 10/50 USD cho mỗi 1 triệu token vào/ra; Batch API giảm 50%), cập nhật 06/10/2026.
- Azure Speech: [trang giá](https://azure.microsoft.com/en-us/pricing/details/speech/) (F0: 5 giờ nhận dạng giọng nói/tháng) và [API bảng giá Azure](https://prices.azure.com/api/retail/prices), vùng Southeast Asia: “S1 Speech To Text” 1,00 USD/giờ, “S1 Speech to Text Enhanced Feature Audio” (tính năng bổ sung như chấm phát âm) 0,30 USD/giờ.
- [Cloudflare Workers AI — giá](https://developers.cloudflare.com/workers-ai/platform/pricing/): 10.000 neuron/ngày miễn phí; vượt thì 0,011 USD/1.000 neuron (chỉ áp dụng với gói Workers trả phí).
- Gemini gói miễn phí: [geotoolbox.ai](https://geotoolbox.ai/blog/gemini-api-pricing), [agentdeals.dev](https://agentdeals.dev/gemini-api-pricing-changes) (nguồn bên thứ ba, cần kiểm tra lại trên Google AI Studio).
- Web Speech API trên iPhone: [WebKit bug 225298](https://bugs.webkit.org/show_bug.cgi?id=225298), [firt.dev](https://firt.dev/ios-14.5/).
- Tỷ giá: [Vietcombank 20/10/2026 qua webgia.com](https://webgia.com/ty-gia/vietcombank/20-10-2026.html).
