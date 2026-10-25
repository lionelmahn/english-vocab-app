import { LEVEL_LABELS, LEVEL_THRESHOLDS_DAYS } from '../core/levels'
import { LEARNING_DEFAULTS, profileDefaults } from '../core/profile'
import { foldText } from '../core/vocab'
import { REMINDER_DEFAULTS } from '../core/reminders'
import { CLIP_BATCH } from '../core/voiceClips'
import { DEFAULT_NEW_SEC, DEFAULT_REVIEW_SEC, PACE_WINDOW_DAYS } from '../core/workload'

/**
 * Hướng dẫn sử dụng (R14.3): thêm từ, học, ôn và ý nghĩa các con số.
 * Quy ước: chữ trong “…” là tên nút/mục đúng như trên màn hình (in đậm khi hiển thị; test kiểm tra nó có thật trong app).
 * Con số mặc định lấy từ mã nguồn để không lệch khi đổi cài đặt.
 */

export type GuideTopicId = 'start' | 'add-words' | 'learn' | 'review' | 'schedule' | 'levels' | 'today' | 'goals' | 'stats' | 'reminders' | 'audio' | 'sync'

export type GuideBlock =
  | { h: string }
  | { p: string }
  | { tip: string }
  | { steps: string[] }
  | { list: string[] }
  | { terms: { term: string; text: string }[] }

export interface GuideTopic {
  id: GuideTopicId
  title: string
  summary: string
  /** Từ khóa thêm cho ô tìm (cách người học hay gọi). */
  keywords?: string[]
  blocks: GuideBlock[]
}

const NEW_PER_DAY = LEARNING_DEFAULTS.dailyNewWords
const REVIEW_LIMIT = LEARNING_DEFAULTS.reviewLimit
const MINUTES_PER_DAY = profileDefaults('UTC').dailyMinutes
const [L2, L3, L4, L5] = LEVEL_THRESHOLDS_DAYS

export const GUIDE: GuideTopic[] = [
  {
    id: 'start',
    title: 'Bắt đầu nhanh',
    summary: 'Vòng học mỗi ngày, năm tab và cách cài app lên điện thoại',
    keywords: ['cài đặt app', 'màn hình chính', 'iphone', 'android', 'tab'],
    blocks: [
      { p: 'App giúp bạn nhớ từ vựng thật lâu bằng cách tự hẹn lần ôn cho mỗi từ vào đúng lúc bạn sắp quên nó. Mỗi ngày chỉ cần hai việc: học vài từ mới và ôn các từ đến hạn. Muốn được nhắc học và nhắc ôn, bật “Nhắc nhở” ở tab “Cá nhân”.' },
      {
        steps: [
          'Thêm từ vào sổ tay: tự gõ, tra từ, nhập file hoặc chọn bộ “1.000 từ thông dụng nhất”.',
          'Ở trang “Hôm nay”, bấm “Học” trong thẻ “Học từ mới”, chọn số từ rồi bấm “Bắt đầu học”. Mỗi từ: xem thẻ giới thiệu rồi điền từ ngay.',
          'Khi trang Hôm nay báo “Đến giờ ôn tập:”, bấm “Ôn tập ngay” rồi “Bắt đầu ôn”. App tự chọn dạng bài và tự hẹn lần ôn sau cho từng từ.',
          'Xem tiến bộ ở tab “Thống kê”.',
        ],
      },
      { h: 'Năm tab ở đáy màn hình' },
      {
        terms: [
          { term: '“Hôm nay”', text: 'Việc cần làm hôm nay: học từ mới, ôn từ đến hạn, làm tiếp buổi đang dở.' },
          { term: '“Sổ tay”', text: 'Mọi từ và bộ từ của bạn: tìm, lọc, sửa, xếp vào bộ.' },
          { term: '“Tra từ”', text: 'Tra nghĩa và phiên âm trên Wiktionary (một từ điển miễn phí trên mạng) rồi lưu nhanh vào sổ tay.' },
          { term: '“Thống kê”', text: 'Tiến độ, mục tiêu, hoạt động theo ngày và cấp ghi nhớ.' },
          { term: '“Cá nhân”', text: 'Hồ sơ, mục tiêu, cài đặt, đồng bộ, sao lưu và trang hướng dẫn này.' },
        ],
      },
      { h: 'Cài app lên điện thoại' },
      {
        list: [
          'iPhone: mở app bằng Safari, chạm nút Chia sẻ (hình ô vuông có mũi tên chỉ lên), chọn “Thêm vào MH chính”.',
          'Android: mở bằng Chrome, chạm menu ⋮, chọn “Cài đặt ứng dụng” (máy nào không có thì chọn “Thêm vào màn hình chính”).',
        ],
      },
      { p: 'Khi đã cài lên màn hình chính, app mở toàn màn hình, vẫn chạy khi mất mạng và ít bị iPhone tự xóa dữ liệu hơn so với khi chỉ mở trong Safari.' },
      { h: 'Lần đầu dùng' },
      {
        p: 'Lần đầu mở app trên một máy chưa có từ nào, app hỏi trình độ, mục tiêu, giọng đọc, lịch học và mời thêm bộ từ khởi đầu. Màn hình này chỉ hiện một lần. Trình độ, mục tiêu, giọng đọc và lịch học đổi lại lúc nào cũng được trong “Cá nhân”; bộ từ khởi đầu thì thêm sau ở “Sổ tay” → “Bộ từ” → “Thêm bộ có sẵn”.',
      },
      { tip: 'Đăng nhập ở “Cá nhân” để dữ liệu tự đồng bộ giữa các máy và luôn có một bản sao trên máy chủ (nơi lưu dữ liệu của bạn trên mạng). Chưa đăng nhập thì mọi thứ vẫn lưu trên máy này.' },
    ],
  },
  {
    id: 'add-words',
    title: 'Thêm từ vào sổ tay',
    summary: 'Bốn cách thêm từ, từ trùng, bộ từ, lưu trữ và xóa',
    keywords: ['nhập file', 'excel', 'csv', 'anki', 'bộ từ', 'trùng', 'lưu trữ', 'xóa từ', 'sửa từ'],
    blocks: [
      { p: 'Lưu từ vào sổ tay chưa phải là đã học từ đó. Từ mới lưu có trạng thái “Chưa học” và chỉ được lên lịch ôn sau khi bạn học nó trong buổi “Học từ mới”.' },
      { h: 'Bốn cách thêm từ' },
      {
        terms: [
          {
            term: '“Thêm từ”',
            text: 'Ở “Sổ tay”, bấm “Thêm từ”. Chỉ bắt buộc từ và nghĩa tiếng Việt; loại từ mặc định là Danh từ. Bạn có thể thêm phiên âm, tối đa 5 câu ví dụ, chọn bộ từ và gắn nhãn. Trong mục “Thêm chi tiết (nghĩa tiếng Anh, ghi chú, mẹo nhớ…)” còn có ô “Đáp án chấp nhận thêm”: cách viết ghi ở đây cũng được chấm đúng khi gõ (ví dụ colour và color). Bài điền ô chữ có số ô bằng số chữ cái của từ chính, nên hãy để cách viết dài hơn làm từ chính. “Lưu và thêm từ khác” giữ loại từ và bộ đã chọn để nhập tiếp.',
          },
          {
            term: '“Tra từ”',
            text: 'Gõ từ rồi bấm “Tra”. Chạm dấu cộng ở nghĩa muốn học (chọn được nhiều nghĩa), bấm nút lưu ở cuối màn hình, nhập nghĩa tiếng Việt (nếu có dòng “Gợi ý:”, chạm một chữ trong dòng đó để điền sẵn) và chọn bộ. Mỗi nghĩa thành một mục học riêng, kèm phiên âm, nghĩa tiếng Anh và câu ví dụ đầu tiên nếu từ điển có. Nếu không tìm thấy, app gợi ý các từ gần giống hoặc cho bạn tự thêm từ đó.',
          },
          {
            term: '“Nhập từ file”',
            text: 'Ở “Cá nhân” bấm “Nhập từ file Excel/CSV”. App đọc được file CSV, Excel (.xlsx) hoặc file xuất từ Anki (.txt). File cần có cột từ và cột nghĩa; các cột khác không bắt buộc, tên cột tiếng Việt hay tiếng Anh đều được. Bấm “Tải file mẫu” để xem mẫu. Mỗi file đọc tối đa 5.000 dòng.',
          },
          {
            term: '“Bộ từ có sẵn”',
            text: 'Ở “Sổ tay” → “Bộ từ” → “Thêm bộ có sẵn”. Bộ “1.000 từ thông dụng nhất” gồm 1.000 từ hay gặp nhất (lấy từ NGSL, một danh sách từ tiếng Anh thông dụng), mỗi từ có nghĩa, loại từ, phiên âm Anh–Mỹ và Anh–Anh (lấy từ Wiktionary), câu ví dụ và bản dịch; từ phổ biến nhất được học trước. Nếu bạn đã thêm bộ này trước khi có phiên âm, app tự điền phiên âm còn trống cho các từ đó.',
          },
        ],
      },
      { h: 'Trước khi nhập file' },
      {
        p: 'App đếm số dòng mỗi loại và cho xem trước 60 dòng đầu, rồi bạn mới bấm nhập. Dòng “Đã có”, “Lặp” và “Lỗi” bị bỏ qua.',
      },
      {
        terms: [
          { term: '“Mới”', text: 'Từ chưa có trong sổ tay.' },
          {
            term: '“Nghĩa mới”',
            text: 'Từ đã có trong sổ tay nhưng khác nghĩa hoặc khác loại từ; được nhập thành mục riêng (bỏ chọn “Nhập cả các nghĩa mới của từ đã có (thành mục học riêng)” nếu không muốn). File không có cột loại từ thì mọi dòng có loại từ là Khác, nên một từ đã có với nghĩa y hệt vẫn có thể hiện là “Nghĩa mới”; hãy xem nghĩa ở phần xem trước trước khi nhập.',
          },
          { term: '“Đã có”', text: 'Cùng từ, loại từ và nghĩa đã có trong sổ tay.' },
          { term: '“Lặp”', text: 'Trùng với một dòng khác trong cùng file.' },
          { term: '“Lỗi”', text: 'Dòng thiếu từ hoặc thiếu nghĩa.' },
        ],
      },
      { p: 'Trong mỗi bộ, từ được học theo thứ tự trong file.' },
      { h: 'Từ trùng' },
      {
        list: [
          'Khi tự thêm bằng “Thêm từ”: nếu từ có cùng cách viết, cùng loại từ và cùng nghĩa với một từ đã có (không tính chữ hoa hay chữ thường, dấu câu, khoảng trắng thừa), app không lưu thêm mà hiện bảng “Từ này đã có trong sổ tay” để bạn mở từ đã có hoặc đưa nó vào bộ đã chọn. Cùng từ nhưng khác nghĩa thì app nhắc một lần; bấm “Lưu thành mục mới” để học nghĩa đó riêng.',
          'Khi tra từ hoặc thêm bộ có sẵn: nghĩa đã có không bị lưu lại mà chỉ được đưa vào bộ đã chọn; nghĩa mới thì lưu luôn, không hỏi.',
          'Khi nhập file: dòng “Đã có” bị bỏ qua và không được đưa vào bộ.',
        ],
      },
      {
        p: 'Nếu sổ tay lỡ có từ trùng (thường do nhập cùng một danh sách trên hai máy), đầu trang Sổ tay sẽ hiện thông báo. Chạm vào thông báo để mở trang “Sao lưu và khôi phục”, rồi bấm nút gộp ở mục “Từ trùng”. App giữ lại mục có nhiều lượt ôn nhất, đưa mục này vào mọi bộ mà các mục bị gộp từng thuộc, và vẫn giữ lịch sử học.',
      },
      { h: 'Bộ từ' },
      {
        list: [
          'Một từ có thể nằm trong nhiều bộ mà vẫn dùng chung một tiến độ.',
          'Từ không thuộc bộ nào vẫn được học và ôn bình thường; khi học từ mới, chúng được xen kẽ với từ của các bộ.',
          'Nếu tắt “Đưa vào kế hoạch học” ở trang của một bộ, các từ chỉ thuộc bộ đó không còn được đưa vào buổi học và ôn chung từ trang Hôm nay. Từ còn nằm trong bộ khác đang bật thì vẫn học bình thường.',
          'Nút “Học mới” và “Ôn tập” ở trang của một bộ chỉ học và ôn từ trong bộ đó, kể cả khi bộ đang tắt.',
          'Xóa bộ không xóa từ: từ và tiến độ vẫn còn trong sổ tay.',
        ],
      },
      { h: 'Sửa, lưu trữ, xóa' },
      {
        terms: [
          {
            term: '“Sửa từ”',
            text: 'Khi bạn sửa cách viết, loại từ hoặc nghĩa chính của một từ đã học, app hỏi “Giữ tiến độ học?”. Nếu chỉ sửa lỗi gõ, chọn “Giữ tiến độ”; nếu đổi hẳn sang một từ khác, chọn “Học lại từ đầu”.',
          },
          {
            term: '“Lưu trữ”',
            text: 'Tạm cất từ: từ không xuất hiện khi học và ôn, không tính vào số từ, nhưng tiến độ vẫn giữ. Bấm “Khôi phục” để học tiếp như cũ. Muốn xem các từ đã cất, chạm nút lọc “Lưu trữ” trong Sổ tay.',
          },
          {
            term: '“Xóa”',
            text: 'Xóa từ khỏi sổ tay, mọi bộ và lịch ôn; lịch sử trả lời vẫn được giữ cho thống kê. Thêm lại từ đó sau này sẽ học từ đầu.',
          },
        ],
      },
      { tip: '“Yêu thích” và “Từ khó” chỉ để đánh dấu và lọc trong Sổ tay, không làm đổi lịch ôn.' },
    ],
  },
  {
    id: 'learn',
    title: 'Học từ mới',
    summary: 'Một buổi học từ mới diễn ra thế nào',
    keywords: ['điền từ', 'thẻ giới thiệu', 'gợi ý', 'gần đúng', 'đã biết', 'tạm dừng', 'telex', 'bàn phím', 'thứ tự', 'số từ mới', 'tồn đọng', 'quá tải', 'ôn trước'],
    blocks: [
      { p: 'Vào “Hôm nay” → thẻ “Học từ mới” → “Học”. Muốn chỉ học một bộ thì mở bộ đó trong Sổ tay và bấm “Học mới”.' },
      { h: 'Chuẩn bị buổi học' },
      {
        list: [
          '“Phạm vi”: “Tất cả bộ đang học” (gồm cả từ không thuộc bộ nào) hoặc một bộ.',
          `“Số từ mới buổi này”: chọn 5, 10, 15, 20 hoặc 30 từ. App chọn sẵn số từ còn thiếu để đủ mục tiêu từ mới hôm nay (mặc định ${NEW_PER_DAY} từ mỗi ngày), hoặc ít hơn nếu hôm nay còn nhiều từ cần ôn (xem phần gợi ý bên dưới). Mục tiêu không chặn bạn học thêm: xong buổi, bấm “Học thêm từ mới” để học tiếp.`,
          'Bấm “Bắt đầu học”.',
        ],
      },
      { h: 'Gợi ý số từ mới khi còn nhiều từ cần ôn' },
      {
        p: `Mỗi từ mới hôm nay sẽ thành từ cần ôn những ngày sau, nên khi lượng ôn dồn lại, học thêm nhiều từ mới chỉ làm dồn thêm. App lấy số phút cần để ôn hết các từ còn đến hạn hôm nay (tính tới 4:00 sáng mai, gồm cả từ chưa tới giờ ôn), trừ vào “Thời gian học mỗi ngày”; phần còn lại chia cho thời gian học một từ mới, ra số từ gợi ý.`,
      },
      {
        list: [
          `Thời gian ôn một từ và học một từ mới được tính từ chính lịch sử học của bạn trong ${PACE_WINDOW_DAYS} ngày gần nhất. Khi chưa đủ dữ liệu, app tạm tính ${DEFAULT_REVIEW_SEC} giây cho mỗi từ ôn và ${DEFAULT_NEW_SEC} giây cho mỗi từ mới.`,
          'Còn chỗ cho ít từ hơn mục tiêu: số từ đó được chọn sẵn (có chữ gợi ý cạnh số từ), kèm một dòng giải thích có hình bóng đèn.',
          'Từ cần ôn đã chiếm hết thời gian mục tiêu: trang hiện lời khuyên ôn trước và nút “Ôn tập trước”. Ôn xong, gợi ý tự tăng lại.',
          'Đây chỉ là gợi ý: bạn vẫn chọn học bao nhiêu từ cũng được. Đặt thời gian học mỗi ngày là 0 thì app không gợi ý giảm.',
        ],
      },
      { h: 'Từ nào được học trước' },
      {
        p: 'Mỗi bộ đang học là một hàng, theo thứ tự trong bộ (bộ 1.000 từ thì từ phổ biến nhất trước). Các từ không thuộc bộ nào là một hàng nữa, từ lưu trước học trước. App lấy lần lượt một từ ở mỗi hàng, bộ tạo trước đứng trước; từ nằm trong nhiều bộ chỉ học một lần. Ví dụ đang học bộ 1.000 từ mà bạn vừa tra và lưu một từ không chọn bộ, thì buổi học tới đã có từ đó; thêm một bộ mới thì mỗi buổi có từ của cả bộ cũ lẫn bộ mới. Muốn học riêng một bộ thì chọn bộ đó ở “Phạm vi”.',
      },
      { h: 'Mỗi từ có hai bước' },
      {
        steps: [
          'Thẻ giới thiệu: mặt trước là từ tiếng Anh và câu ví dụ có gạch chân từ đó. Chạm thẻ để lật xem phiên âm và nghĩa, rồi bấm “Tiếp tục” (hoặc vuốt thẻ sang bên). Bấm nút hình loa để nghe, nút hình ốc sên để nghe chậm.',
          '“Điền từ”: nhìn nghĩa tiếng Việt và câu ví dụ có chỗ trống, gõ từng chữ cái của từ rồi bấm “Kiểm tra”. Vài chữ cái mờ hiện sẵn làm điểm tựa nhưng vẫn phải gõ đủ; dấu cách, gạch nối, dấu nháy được điền sẵn.',
        ],
      },
      { h: 'Khi bí hoặc gõ sai' },
      {
        terms: [
          { term: '“Gợi ý”', text: 'Hiện thêm một chữ cái. Nếu dùng gợi ý, lần trả lời đó được tính mức “Khó”.' },
          { term: '“Mình không thuộc từ này”', text: 'Xem đáp án ngay; lần trả lời đó được tính là Quên.' },
          {
            term: '“Gần đúng”',
            text: 'Với từ dài từ 5 chữ cái trở lên, nếu bạn gõ lệch đúng một chữ cái (thừa, thiếu, sai một chữ hoặc đảo chỗ hai chữ cạnh nhau), app hỏi bạn muốn “Tính là đúng” (tính mức Khó) hay “Tính là sai”. Với từ ngắn hơn, sai một chữ cái là sai.',
          },
          { term: '“Luyện lại”', text: 'Nếu bạn trả lời sai, từ đó sẽ quay lại sau vài bước để bạn luyện thêm, tối đa 2 lần mỗi buổi.' },
        ],
      },
      {
        p: 'Chỉ câu trả lời đầu tiên của mỗi từ trong buổi mới quyết định lịch ôn; dù lúc luyện lại bạn làm đúng, lần sai đầu tiên vẫn được tính. Đáp án không phân biệt chữ hoa hay chữ thường.',
      },
      {
        p: 'Ô chữ có đúng số chữ cái của từ chính và không nhận thêm chữ, nên hãy gõ cách viết chính. Cách viết khác (ví dụ colour và color) chỉ được chấm đúng khi đã ghi trong “Đáp án chấp nhận thêm” của từ, và ở bài “Điền từ” chỉ gõ được nếu không dài hơn từ chính.',
      },
      { h: 'Từ bạn đã biết' },
      {
        p: 'Ở thẻ giới thiệu, bấm “Mình đã biết từ này”. App cho điền thử ngay: tự điền đúng (không dùng gợi ý) thì từ được hẹn ôn xa (mức “Dễ”) và bỏ qua các bước còn lại. Sai, bấm “Không nhớ ra” hay phải dùng gợi ý thì cũng không sao: không tính là quên, bạn học tiếp từ đó như từ mới.',
      },
      { h: 'Tạm dừng và kết thúc' },
      {
        list: [
          'Bấm nút X ở góc trên để mở bảng “Tạm dừng buổi học?”. Mỗi câu trả lời đều đã được lưu ngay.',
          'Chọn “Tạm dừng, để sau” nếu muốn làm tiếp sau: buổi học được giữ ở trang Hôm nay, trong thẻ buổi học đang dở.',
          'Chọn “Kết thúc và xem kết quả” để dừng hẳn; các từ chưa làm tới vẫn là từ mới.',
          'Lưu ý: bắt đầu một buổi mới thì buổi đang dở bị bỏ.',
        ],
      },
      { tip: 'Bàn phím tiếng Việt (Telex) dễ làm chữ bị thêm dấu. Khi app nhắc, bấm nút 🌐 trên bàn phím để chuyển sang tiếng Anh.' },
    ],
  },
  {
    id: 'review',
    title: 'Ôn tập',
    summary: 'Khi nào cần ôn, các dạng bài, cách chấm và màn tổng kết',
    keywords: ['dạng bài', 'trắc nghiệm', 'nghe viết', 'tự đánh giá', 'chấm điểm', 'tổng kết', 'tỷ lệ nhớ', 'củng cố'],
    blocks: [
      { p: 'Mỗi từ đã học có một thời điểm đến hạn ôn riêng. Khi có từ đến hạn, trang “Hôm nay” hiện “Đến giờ ôn tập:” và nút “Ôn tập ngay”; bấm vào rồi bấm “Bắt đầu ôn”.' },
      {
        p: `Số từ tối đa trong một buổi ôn đặt ở “Tối đa mỗi buổi ôn” (mặc định ${REVIEW_LIMIT}). Nếu số từ đến hạn nhiều hơn, app cho ôn trước những từ bạn dễ quên nhất; các từ còn lại bạn ôn tiếp bằng nút “Ôn tiếp” ở màn tổng kết.`,
      },
      { h: 'Hai kiểu ôn' },
      { p: 'Chọn ở “Cá nhân” → “Kiểu ôn tập”.' },
      {
        terms: [
          {
            term: '“Bài luyện” (mặc định)',
            text: 'App tự chọn dạng bài theo cấp ghi nhớ của từng từ (dạng bài thay đổi dần qua các lần ôn) và tự chấm.',
          },
          {
            term: '“Thẻ tự đánh giá”',
            text: 'Lật thẻ rồi tự chọn “Quên”, “Khó”, “Nhớ” hoặc “Dễ”. Dưới mỗi nút có ghi bao lâu nữa bạn sẽ ôn lại nếu chọn nút đó; riêng thẻ có nhãn “Luyện lại” thì chọn nút nào cũng không đổi lịch. Vuốt phải là Nhớ, vuốt trái là Quên. Muốn đổi mặt trước thẻ, vào “Cá nhân” → “Mặt trước thẻ khi ôn”.',
          },
        ],
      },
      { h: 'Các dạng bài trong “Bài luyện”' },
      {
        list: [
          'Cấp 1: chọn nghĩa đúng của từ, nghe từ rồi chọn nghĩa, và “Điền từ”.',
          'Cấp 2–3: “Điền từ”, nghe các phương án để chọn từ đúng (điền vào chỗ trống trong câu ví dụ, hoặc theo nghĩa nếu từ không có câu ví dụ), chọn nghĩa đúng, và “Nghe và viết lại”.',
          'Cấp 4–5: “Điền từ”, “Nghe và viết lại”, và nghe các phương án để chọn từ đúng.',
          'Các bài phải chọn đáp án cần sổ tay có ít nhất 4 nghĩa khác nhau để làm phương án; chưa đủ thì app cho bài gõ từ thay thế.',
        ],
      },
      { h: 'Cách chấm' },
      {
        terms: [
          { term: '“Nhớ”', text: 'Trả lời đúng, không cần trợ giúp.' },
          { term: '“Khó”', text: 'Đúng nhưng đã dùng “Gợi ý”, hoặc chọn “Tính là đúng” ở bảng “Gần đúng”.' },
          { term: '“Quên”', text: 'Trả lời sai hoặc bấm “Mình không thuộc từ này”. Từ quay lại để học lại sau vài phút (khoảng 1–10 phút).' },
          { term: '“Dễ”', text: 'Chỉ có ở “Thẻ tự đánh giá”, và khi bạn làm đúng bài thử “Mình đã biết từ này” lúc học mới. Ở kiểu “Bài luyện”, app chấm cao nhất là Nhớ.' },
        ],
      },
      { p: 'Như khi học mới, chỉ câu trả lời đầu tiên của mỗi từ trong buổi được tính. Trả lời sai thì từ quay lại ở bước “Luyện lại” để bạn luyện thêm, nhưng kết quả của từ vẫn là Quên.' },
      { h: 'Đang ở nơi không bật tiếng được' },
      {
        p: 'Bấm “Tạm thời không nghe được” ở bài nghe. Bài đó và mọi bài nghe còn lại của buổi đổi sang bài không cần nghe, không bị tính sai. Buổi sau các bài nghe quay lại bình thường.',
      },
      { h: 'Màn tổng kết' },
      {
        terms: [
          { term: '“Nhớ” và “Quên”', text: 'Ở màn này, “Nhớ” là số từ có câu trả lời đầu tiên đúng (gồm cả mức Khó, Nhớ và Dễ), còn “Quên” là số từ có câu trả lời đầu tiên sai.' },
          { term: '“Tỷ lệ nhớ”', text: 'Nhớ chia cho tổng Nhớ và Quên. Từ 80% trở lên có pháo giấy.' },
          {
            term: '“Cần củng cố”',
            text: 'Các từ được chấm Quên hoặc Khó, hoặc từng trả lời sai trong buổi; chạm vào một từ để mở trang của từ đó. Nút “Luyện lại” bên dưới mở một buổi luyện thêm riêng cho các từ này. Buổi đó không làm đổi lịch ôn; màn tổng kết của nó chỉ cho biết từ nào bạn còn trả lời sai.',
          },
          { term: 'Số phút ở đầu màn hình tổng kết', text: 'Thời gian làm bài của buổi, mỗi bước tính tối đa 2 phút.' },
        ],
      },
    ],
  },
  {
    id: 'schedule',
    title: 'Lịch ôn hoạt động thế nào',
    summary: 'Vì sao mỗi từ có ngày ôn khác nhau',
    keywords: ['fsrs', 'thuật toán', 'khoảng cách', 'hạn ôn', 'đến hạn', 'lặp lại ngắt quãng'],
    blocks: [
      {
        p: 'App dùng một thuật toán ôn tập (tên là FSRS) để đoán khi nào bạn sắp quên từng từ và hẹn ôn vào đúng lúc đó: khi đến hạn ôn, khả năng bạn còn nhớ từ đó vẫn vào khoảng 90%. Từ nhớ chắc thì khoảng cách giữa các lần ôn dài dần (vài ngày, vài tuần, vài tháng); từ hay quên thì được ôn dày hơn.',
      },
      { h: 'Câu trả lời của bạn làm gì' },
      {
        terms: [
          { term: '“Quên”', text: 'Từ quay lại học lại sau vài phút, và các lần ôn sau sẽ gần nhau hơn.' },
          { term: '“Khó”', text: 'Vẫn lên lịch, nhưng lần ôn sau gần hơn so với Nhớ.' },
          { term: '“Nhớ”', text: 'Khoảng cách tăng theo mức bình thường.' },
          { term: '“Dễ”', text: 'Khoảng cách tăng nhiều nhất.' },
        ],
      },
      {
        p: 'Mỗi buổi, chỉ câu trả lời đầu tiên của mỗi từ làm đổi lịch. Lượt luyện lại trong buổi và nút “Luyện lại” ở màn tổng kết không đổi lịch. Từ chưa đến hạn thì chưa ôn được.',
      },
      { h: 'Ví dụ' },
      {
        p: 'Với một từ vừa học, nếu lần nào bạn cũng trả lời Nhớ và ôn đúng hẹn: lần ôn đầu khoảng 10 phút sau khi học, các lần sau lần lượt cách lần trước khoảng 2 ngày, 11 ngày, một tháng rưỡi, 5 tháng… Con số thật khác nhau tùy từng từ và tùy lịch sử trả lời.',
      },
      {
        list: [
          'Vừa học xong, từ đến hạn lại sau vài phút: khoảng 10 phút nếu trả lời đúng, sớm hơn nếu dùng gợi ý hoặc trả lời sai. Vì vậy trong ngày có thể thấy “Đến giờ ôn tập:” ngay; đó là lượt củng cố ngắn, rất bình thường.',
          'Hạn ôn tính theo giờ chứ không theo ngày: hẹn 2 ngày nghĩa là khoảng 48 giờ sau lần trả lời.',
          'Ôn trễ hạn không bị phạt; nếu vẫn nhớ, lần sau thường còn được hẹn xa hơn.',
          'Mỗi từ có lịch riêng; một từ nằm trong nhiều bộ vẫn chỉ có một lịch.',
          'Lưu trữ từ thì app không đổi lịch của từ, nhưng thời gian vẫn trôi: khôi phục sau ngày hẹn thì từ đến hạn ôn ngay.',
        ],
      },
      { tip: 'Chỉ cần mở app mỗi ngày và ôn hết các từ đến hạn. Bỏ vài ngày cũng không mất gì: từ đến hạn chờ sẵn, và app ôn từ dễ quên nhất trước.' },
    ],
  },
  {
    id: 'levels',
    title: 'Năm cấp ghi nhớ',
    summary: 'Cấp 1–5 nghĩa là gì, trạng thái của từ và mục Tiến độ',
    keywords: ['cấp', 'độ bền', 'trạng thái', 'tiến độ', 'số lần ôn', 'số lần quên', 'lịch sử'],
    blocks: [
      {
        p: 'Cấp cho biết từ đã bám chắc trong trí nhớ tới đâu. Cấp được tính dựa trên độ bền trí nhớ do thuật toán ôn tập ước tính; độ bền trí nhớ là khoảng thời gian bạn có thể nhớ từ đó mà không cần ôn. Cấp không phải là số lần ôn, cũng không phải một khoảng cách ôn cố định.',
      },
      {
        terms: [
          { term: `“${LEVEL_LABELS[0]}”`, text: 'Đã lưu nhưng chưa học lần nào (cấp 0).' },
          { term: `1 · “${LEVEL_LABELS[1]}”`, text: `Vừa học hoặc vừa quên và đang trong các lượt củng cố ngắn, hoặc độ bền dưới ${L2} ngày.` },
          { term: `2 · “${LEVEL_LABELS[2]}”`, text: `Độ bền từ ${L2} đến dưới ${L3} ngày.` },
          { term: `3 · “${LEVEL_LABELS[3]}”`, text: `Độ bền từ ${L3} đến dưới ${L4} ngày.` },
          { term: `4 · “${LEVEL_LABELS[4]}”`, text: `Độ bền từ ${L4} đến dưới ${L5} ngày.` },
          { term: `5 · “${LEVEL_LABELS[5]}”`, text: `Độ bền từ ${L5} ngày trở lên.` },
        ],
      },
      {
        list: [
          'Cấp có thể giảm: trả lời Quên một từ đang ở cấp cao thì từ về cấp 1 để học lại.',
          'Từ làm đúng bài thử “Mình đã biết từ này” lúc học mới được hẹn ôn xa, nên vào thẳng cấp 3 mà không qua cấp 1.',
        ],
      },
      { h: 'Trạng thái của từ' },
      {
        terms: [
          { term: '“Chưa học”', text: 'Chưa học lần nào.' },
          { term: '“Đang học”', text: 'Đang trong các lượt củng cố ngắn sau khi học mới hoặc sau khi quên.' },
          { term: '“Đã học”', text: 'Đã qua các lượt củng cố ngắn, đang chờ tới hạn ôn lần sau.' },
          { term: '“Đến hạn ôn”', text: 'Đã tới lúc ôn.' },
          { term: '“Đã lưu trữ”', text: 'Đang cất, không học và ôn.' },
        ],
      },
      {
        p: 'Ở trang một từ, trạng thái ghi đầy đủ như trên. Trong Sổ tay, nút lọc và nhãn cạnh từ ghi gọn là “Đến hạn” và “Lưu trữ”.',
      },
      { tip: 'Ô “Đang học” ở tab Thống kê đếm mọi từ đã có lịch ôn, nên thường lớn hơn số từ ở nút lọc “Đang học” trong Sổ tay (nút lọc này chỉ gồm từ đang trong lượt củng cố ngắn).' },
      { h: 'Mục “Tiến độ” ở trang một từ' },
      {
        terms: [
          { term: '“Ôn tiếp theo”', text: 'Thời gian còn lại tới hạn ôn, hoặc “Có thể ôn ngay”.' },
          { term: '“Số lần ôn”', text: 'Số lần câu trả lời được tính vào lịch ôn; mỗi buổi tối đa một lần cho mỗi từ.' },
          { term: '“Số lần quên”', text: 'Số lần bạn trả lời Quên khi từ đã qua các lượt củng cố ngắn (không tính những lần sai lúc mới học).' },
          { term: '“Lần ôn gần nhất”', text: 'Lúc câu trả lời gần nhất được tính vào lịch.' },
        ],
      },
      {
        p: '“Lịch sử gần đây” là một thẻ riêng ở cuối trang, chỉ hiện khi từ đã có câu trả lời. Thẻ ghi 10 câu trả lời mới nhất, gồm cả lượt luyện lại, nên số dòng có thể nhiều hơn “Số lần ôn” và có thể thấy nhiều chữ Quên hơn “Số lần quên”. Tên dạng bài ở đây ghi gọn, ví dụ “Gõ từ theo nghĩa” là bài Điền từ.',
      },
    ],
  },
  {
    id: 'today',
    title: 'Trang Hôm nay',
    summary: 'Các con số và thẻ trên trang đầu tiên',
    keywords: ['ngọn lửa', 'chuỗi', 'biểu đồ cấp', 'đến giờ ôn', 'buổi đang dở', 'ngày nghỉ'],
    blocks: [
      {
        terms: [
          { term: 'Ngọn lửa ở góc trên', text: 'Số ngày học liên tiếp. Xem chi tiết ở bài hướng dẫn về mục tiêu, chuỗi ngày và thời gian học.' },
          { term: '“Sổ tay đã có”', text: 'Số từ trong sổ tay, không tính từ đã lưu trữ. Chạm để mở Sổ tay.' },
          { term: 'Năm cột 1–5', text: 'Số từ ở mỗi cấp ghi nhớ. Dòng bên dưới là số từ đã lưu nhưng chưa học.' },
          {
            term: '“Đến giờ ôn tập:”',
            text: 'Số từ đang đến hạn ôn; bấm “Ôn tập ngay”. Chưa có từ nào đến hạn thì nút này mờ đi và trang ghi “Lượt ôn tiếp theo:” kèm thời gian còn lại; nếu bạn chưa học từ nào, trang chỉ nhắc học vài từ mới. Con số tự cập nhật mỗi 30 giây.',
          },
          {
            term: '“Học từ mới”',
            text: 'Dòng Hôm nay x/y từ cho biết tiến độ từ mới: ví dụ Hôm nay 3/10 từ nghĩa là hôm nay bạn đã học 3 từ mới, mục tiêu là 10 từ mỗi ngày; muốn học thêm lúc nào cũng được. Con số trong dòng còn … từ chưa học chỉ đếm từ trong kế hoạch học, không tính từ chỉ nằm trong bộ đã tắt “Đưa vào kế hoạch học”. Khi hôm nay còn nhiều từ cần ôn so với thời gian học mỗi ngày, thẻ có thêm một dòng gợi ý học ít từ mới hơn hoặc ôn trước (xem bài Học từ mới). Số từ cần ôn trong dòng đó tính cả các từ đến hạn muộn hơn trong ngày, nên có thể lớn hơn số ở dòng Đến giờ ôn tập.',
          },
          {
            term: 'Buổi học hoặc buổi ôn đang dở',
            text: 'Buổi bạn đã tạm dừng; bấm “Tiếp tục” để làm tiếp từ bước đã dừng. Số bước gồm cả thẻ giới thiệu và lượt luyện lại nên tổng có thể tăng trong lúc học.',
          },
        ],
      },
      {
        p: 'Một ngày học bắt đầu lúc 4:00 sáng theo “Múi giờ” đặt ở “Mục tiêu và lịch học”, nên học lúc 1 giờ đêm vẫn được tính cho hôm trước. Nếu hôm nay không phải ngày học trong lịch, dòng ngày tháng dưới lời chào có thêm chữ “ngày nghỉ theo lịch học”; muốn học thì vẫn học bình thường.',
      },
      { p: 'Sổ tay còn trống thì trang hiện “Bắt đầu với từ đầu tiên” với các nút thêm từ, chọn bộ 1.000 từ hoặc nhập file.' },
    ],
  },
  {
    id: 'goals',
    title: 'Mục tiêu, chuỗi ngày và thời gian học',
    summary: 'Mục tiêu mỗi ngày, dải Tuần này và cách app ước tính thời gian',
    keywords: ['mục tiêu', 'chuỗi', 'streak', 'tuần này', 'phút', 'múi giờ', 'lịch học', 'ngày nghỉ'],
    blocks: [
      {
        p: `Đặt mục tiêu ở “Cá nhân” → “Đổi mục tiêu và lịch học”: “Từ mới mỗi ngày” (mặc định ${NEW_PER_DAY}), “Thời gian học mỗi ngày” (mặc định ${MINUTES_PER_DAY} phút, gồm cả ôn tập) và “Ngày học trong tuần”. Mỗi lựa chọn được lưu ngay và dùng chung trên mọi máy đã đăng nhập. Thời gian học mỗi ngày còn dùng để gợi ý học ít từ mới hơn khi còn nhiều từ cần ôn (xem bài Học từ mới).`,
      },
      { h: '“Mục tiêu hôm nay” ở tab Thống kê' },
      {
        terms: [
          {
            term: '“Từ mới”',
            text: 'Số từ mới bắt đầu học hôm nay so với mục tiêu. Một từ được tính là từ mới của ngày mà bạn trả lời nó lần đầu trong buổi “Học từ mới”, kể cả khi bạn trả lời sai hoặc làm đúng bài thử “Mình đã biết từ này”.',
          },
          { term: '“Thời gian học”', text: 'Số phút đã học hôm nay so với mục tiêu số phút mỗi ngày. Học đủ thì có dấu tích.' },
        ],
      },
      { h: '“Tuần này”' },
      {
        p: 'Bảy ô từ T2 đến CN. Một ngày đạt mục tiêu khi học đủ số phút mục tiêu; ô ngày chỉ xét số phút, không xét số từ mới. Học đủ vào ngày nghỉ cũng tính là đạt.',
      },
      {
        list: [
          'Ô tô đậm có dấu tích: “Đạt mục tiêu”.',
          'Ô tô nhạt: “Có học, chưa đủ thời gian”.',
          'Ô viền nét đứt: “Hôm nay, chưa học”.',
          'Ô không tô màu, viền mờ: “Ngày học nhưng chưa học” (ngày học theo lịch đã qua mà không học).',
          'Ô xám không viền: “Ngày nghỉ” (ngày không có trong lịch và bạn không học) hoặc “Chưa tới”.',
        ],
      },
      { p: 'Trên máy tính, rê chuột lên một ô để xem tên trạng thái.' },
      { h: 'App tính thời gian học thế nào' },
      {
        p: 'App không bấm giờ mà ước tính thời gian từ các câu trả lời. Câu đầu tiên của mỗi buổi được tính bằng thời gian bạn làm câu đó (tối đa 2 phút). Mỗi câu sau được tính bằng khoảng thời gian từ câu trước tới câu đó (gồm cả lúc xem thẻ, đọc phản hồi), tối đa 3 phút. Nhờ vậy, nếu bạn để app mở rồi đi làm việc khác, khoảng thời gian đó không bị cộng vào.',
      },
      { p: 'Số phút ở màn tổng kết buổi tính hơi khác (mỗi bước tối đa 2 phút) nên có thể lệch đôi chút.' },
      { h: 'Chuỗi ngày (ngọn lửa ở trang Hôm nay)' },
      {
        p: 'Số ngày liên tiếp có ít nhất một câu trả lời, ở bất kỳ buổi nào. Nếu hôm nay chưa học, chuỗi vẫn được giữ. Nếu bỏ trọn một ngày, kể cả ngày nghỉ theo lịch, chuỗi sẽ đếm lại từ đầu.',
      },
      { tip: 'Muốn giữ chuỗi vào ngày nghỉ, chỉ cần trả lời vài câu: ôn từ đến hạn, hoặc học một từ mới nếu chưa có từ nào đến hạn.' },
      {
        p: 'Ngày học bắt đầu lúc 4:00 sáng theo “Múi giờ” trong trang “Mục tiêu và lịch học”. Khi tới nơi có múi giờ khác, hãy đổi “Múi giờ” ở trang đó, hoặc bấm “Dùng múi giờ của máy này”.',
      },
    ],
  },
  {
    id: 'stats',
    title: 'Tab Thống kê',
    summary: 'Bốn ô tổng quan, hoạt động theo ngày và cấp ghi nhớ',
    keywords: ['thống kê', 'biểu đồ', 'lượt trả lời', 'tỷ lệ đúng', 'tổng quan', 'hoạt động'],
    blocks: [
      { p: 'Các con số được tính lại mỗi lần mở trang, từ sổ tay, lịch ôn và lịch sử câu trả lời, không cộng dồn. Vì vậy học trên nhiều máy cũng không bị đếm trùng.' },
      { h: 'Bốn ô đầu trang' },
      {
        terms: [
          { term: '“Trong sổ tay”', text: 'Số từ, không tính từ đã lưu trữ.' },
          { term: '“Chưa học”', text: 'Đã lưu nhưng chưa học lần nào.' },
          { term: '“Đang học”', text: 'Mọi từ đã có lịch ôn (Trong sổ tay trừ Chưa học).' },
          { term: '“Đến hạn ôn”', text: 'Số từ đang tới lúc ôn. Ô này tính cả từ chỉ nằm trong bộ đang tắt hoặc bộ đã lưu trữ, nên có thể lớn hơn số ở trang Hôm nay.' },
        ],
      },
      { h: 'Hoạt động theo kỳ' },
      { p: 'Chọn “7 ngày”, “30 ngày” hoặc “12 tuần”.' },
      {
        terms: [
          {
            term: '“Lượt trả lời”',
            text: 'Tổng câu trả lời (học mới, ôn, luyện lại) trong kỳ, kèm phần trăm tăng giảm so với kỳ liền trước cùng độ dài. Kỳ hiện tại có tính cả hôm nay dù hôm nay chưa hết, nên vào đầu ngày phần trăm này thường là số âm.',
          },
          { term: '“Từ mới đã học”', text: 'Số từ bắt đầu học trong kỳ.' },
          {
            term: '“Tỷ lệ đúng”',
            text: 'Số câu trả lời đúng chia cho số câu trả lời được chấm điểm; Khó, Nhớ, Dễ đều tính là đúng. Con số này tính theo từng câu, gồm cả lượt luyện lại, nên khác “Tỷ lệ nhớ” ở màn tổng kết (tính theo từ, chỉ câu đầu tiên).',
          },
          { term: '“Thời gian học”', text: 'Tổng thời gian học ước tính trong kỳ (cách tính xem ở bài hướng dẫn về mục tiêu, chuỗi ngày và thời gian học).' },
        ],
      },
      {
        p: 'Biểu đồ chia mỗi cột thành “Ôn tập” và “Học từ mới”. Câu trả lời trong buổi học mới (kể cả lượt luyện lại ngay trong buổi đó) thuộc Học từ mới; còn lại thuộc Ôn tập, gồm cả buổi “Luyện lại” bạn mở từ màn tổng kết.',
      },
      {
        p: 'Chạm một cột để xem số lượt ôn, học mới và thời gian của ngày đó (hoặc tuần đó khi chọn “12 tuần”). Bấm “Bảng” để xem tất cả dạng bảng, mới nhất ở trên, có thêm tỷ lệ đúng; bấm “Biểu đồ” để quay lại.',
      },
      { h: '“Cấp ghi nhớ”' },
      { p: 'Số từ ở mỗi cấp, từ cấp 0 đến cấp 5, kèm một thanh dài ngắn theo tỷ lệ so với tổng số từ. Ý nghĩa từng cấp xem ở bài hướng dẫn về năm cấp ghi nhớ.' },
      { tip: 'Từ đã lưu trữ hoặc đã xóa không còn được đếm ở bốn ô đầu và ở Cấp ghi nhớ, nhưng các câu trả lời trước đây của chúng vẫn nằm trong phần hoạt động.' },
    ],
  },
  {
    id: 'reminders',
    title: 'Nhắc nhở',
    summary: 'Nhắc học đúng giờ và nhắc ôn khi có từ đến hạn',
    keywords: ['thông báo', 'nhắc học', 'nhắc ôn', 'giờ yên lặng', 'push'],
    blocks: [
      {
        p: 'App gửi thông báo lên điện thoại kể cả khi app đang đóng: nhắc học vào giờ học, và nhắc ôn khi có nhiều từ đến hạn. Cần đăng nhập; trên iPhone còn cần cài app lên màn hình chính.',
      },
      { h: 'Bật trên từng máy' },
      {
        steps: [
          'Vào “Cá nhân” → “Nhắc nhở”.',
          'Bấm “Bật nhắc nhở trên máy này”, rồi chọn “Cho phép” khi máy hỏi.',
          'Bấm “Gửi thử” để chắc thông báo đến được máy.',
        ],
      },
      {
        p: 'Mỗi máy bật riêng, còn các tùy chọn bên dưới dùng chung cho mọi máy đã bật. Muốn một máy thôi nhận, bấm “Tắt trên máy này” trên máy đó, hoặc xóa máy đó trong danh sách các máy.',
      },
      { h: 'Nhắc gì, lúc nào' },
      {
        terms: [
          {
            term: '“Nhắc giờ học”',
            text: 'Vào giờ học đặt ở “Mục tiêu và lịch học”, đúng ngày học, nếu hôm đó bạn chưa trả lời câu nào. Mỗi ngày nhắc tối đa một lần; lỡ đúng giờ thì app vẫn nhắc trong 2 tiếng sau đó.',
          },
          {
            term: '“Nhắc khi có từ đến hạn”',
            text: `Khi có từ ${REMINDER_DEFAULTS.dueMin} từ đến hạn trở lên (đổi được), tối đa ${REMINDER_DEFAULTS.duePerDay} lần mỗi ngày (đổi được). Hai lần nhắc cách nhau ít nhất 3 tiếng, và không nhắc nếu bạn vừa học trong 1 tiếng trước đó. Các từ đến hạn được gộp vào một thông báo, không báo từng từ.`,
          },
          { term: '“Giờ yên lặng”', text: `Không nhắc gì trong khoảng này, kể cả giờ học (mặc định ${REMINDER_DEFAULTS.quietStart}–${REMINDER_DEFAULTS.quietEnd}).` },
        ],
      },
      {
        p: 'Máy chủ kiểm tra 15 phút một lần nên thông báo có thể đến trễ vài phút. Chạm vào thông báo để mở thẳng trang ôn tập hoặc học từ mới. Số từ đến hạn trong thông báo tính cả từ chỉ nằm trong bộ đang tắt, nên có thể lớn hơn số ở trang Hôm nay.',
      },
      {
        tip: 'Không thấy thông báo? Kiểm tra trang Nhắc nhở ghi “Đã bật trên máy này.” và “Gửi thử” được; iPhone không ở chế độ Tập trung hay Không làm phiền; trong Cài đặt của iPhone → Thông báo, app đang được phép gửi thông báo.',
      },
    ],
  },
  {
    id: 'audio',
    title: 'Phát âm và âm thanh',
    summary: 'Nguồn phát âm, ghi âm, tải file, báo đọc sai và Giọng iPhone',
    keywords: ['giọng', 'loa', 'ghi âm', 'micro', 'wiktionary', 'giọng iphone', 'phím tắt', 'đọc sai', 'nghe chậm'],
    blocks: [
      { p: 'Bấm nút hình loa để nghe, nút hình ốc sên để nghe chậm. Với mỗi từ, app tìm âm thanh theo thứ tự:' },
      {
        steps: [
          'Bản của bạn: bản tự ghi âm, file tải lên, hoặc bản Wiktionary bạn đã chọn cho từ đó.',
          '“Giọng iPhone” bạn đã tạo bằng app Phím tắt (khi bật “Dùng giọng iPhone khi phát âm”).',
          'Bản ghi giọng người thật trên Wiktionary (khi bật “Ưu tiên giọng người thật”), chỉ cho từ và cụm ngắn tối đa 4 từ; bản bạn đã báo đọc sai bị bỏ qua. Không có bản đúng giọng đang chọn thì app dùng bản giọng khác, ví dụ chọn giọng Anh nhưng Wiktionary chỉ có bản Mỹ.',
          'Giọng đọc của máy (giọng đọc tự động có sẵn trên điện thoại). Câu ví dụ dùng Giọng iPhone nếu bạn đã tạo, nếu không thì dùng giọng máy.',
        ],
      },
      { h: 'Thẻ “Phát âm” ở trang một từ' },
      {
        list: [
          'Dòng trên cùng cho biết đang phát từ nguồn nào; chạm để nghe. Chọn “Mỹ” hoặc “Anh” để xem và đổi âm thanh cho giọng đó (không đổi cài đặt chung).',
          '“Ghi âm”: đọc to một lần, tối đa 15 giây, nghe thử rồi mới lưu. Lần đầu iPhone hỏi quyền dùng micro.',
          '“Tải file lên”: file âm thanh (m4a, mp3, wav…) tối đa 2 MB, nghe thử trước khi lưu.',
          '“Bản khác”: nghe các bản ghi của từ trên Wiktionary. Bấm “Dùng” để chọn bản đó, hoặc bấm biểu tượng lá cờ để báo bản đó đọc sai. Có từ có bản riêng theo loại từ (ví dụ từ record khi là danh từ và khi là động từ được đọc khác nhau); app không tự phát các bản này, muốn dùng thì bấm “Dùng”.',
          '“Báo bản này đọc sai”: từ nay không phát bản đó nữa, trên mọi máy của bạn. Báo nhầm thì mở “Bản khác” và bấm nút cờ gạch ở bản có nhãn “Đã báo sai” để bỏ báo.',
        ],
      },
      {
        p: 'Với mỗi cách viết của từ, app giữ một bản của bạn cho mỗi giọng (Mỹ, Anh). Lưu bản mới hoặc bấm “Dùng” một bản Wiktionary sẽ thay bản cũ của giọng đó. Hai mục viết giống nhau (ví dụ record danh từ và record động từ) dùng chung bản này: chọn bản cho mục này thì mục kia cũng đổi theo. Giọng nào chưa có bản của bạn thì app phát bản của giọng kia, và dòng trên cùng ghi thêm (giọng Mỹ) hoặc (giọng Anh).',
      },
      {
        p: 'Muốn quay về nguồn mặc định thì bấm “Xóa bản của tôi” (với bản Wiktionary đã chọn thì nút có tên “Bỏ chọn bản này”). Nút xóa đúng bản đang ghi ở dòng trên cùng, kể cả khi đó là bản của giọng kia.',
      },
      { h: '“Giọng iPhone”' },
      {
        p: `Safari ẩn các giọng “Nâng cao/Cao cấp” bạn tải trên iPhone nên app không chọn thẳng được. Để “Tự động” thì iPhone có thể đọc bằng giọng chọn trong Cài đặt, nhưng hay bị đổi về giọng mặc định. Cách chắc chắn là trang Giọng iPhone (trong “Cá nhân”): trang này hướng dẫn bạn tạo một phím tắt trong app Phím tắt để đọc sẵn từ và câu ví dụ bằng giọng đó, rồi bạn dán âm thanh vào app, mỗi lượt ${CLIP_BATCH} mục. Muốn đổi giọng thì “Xóa hết” rồi tạo lại.`,
      },
      { h: 'Âm thanh trên nhiều máy' },
      {
        p: 'Khi đã đăng nhập, bản ghi âm, file tải lên và Giọng iPhone được tải lên kho riêng của tài khoản (mỗi lượt đồng bộ tối đa 30 file). Giọng iPhone tự tải về các máy khác khi đồng bộ. Bản ghi âm và file tải lên được tải về ở lần phát đầu tiên trên máy đó, nên lần đầu cần có mạng. Xóa Giọng iPhone ở một máy là xóa trên mọi máy. Bản sao lưu ra file không chứa âm thanh.',
      },
      {
        list: [
          '“Tốc độ giọng máy” chỉ đổi tốc độ giọng đọc của máy, không đổi bản ghi âm, Wiktionary hay Giọng iPhone. Tốc độ Giọng iPhone chỉnh trong phím tắt lúc tạo.',
          'Bật “Tự phát âm” thì app tự đọc to từ vựng mỗi khi thẻ hiện ra và ở bài nghe.',
        ],
      },
      { tip: 'Trên iPhone, âm thanh chỉ phát được sau lần chạm đầu tiên vào app. Nếu thẻ đầu tiên không tự đọc, chạm loa một lần là được.' },
    ],
  },
  {
    id: 'sync',
    title: 'Đồng bộ, sao lưu và khôi phục',
    summary: 'Dùng nhiều máy, đăng nhập và giữ an toàn dữ liệu',
    keywords: ['đăng nhập', 'mật khẩu', 'máy chủ', 'sao lưu', 'khôi phục', 'xuất file', 'csv', 'nhiều máy', 'mất mạng'],
    blocks: [
      {
        p: 'Dữ liệu luôn được lưu trên máy trước nên app dùng được khi mất mạng. Khi đã đăng nhập, app tự đồng bộ với máy chủ: khi mở app, vài giây sau mỗi thay đổi, khi có mạng lại và khoảng 2 phút một lần. Muốn chạy ngay thì bấm “Đồng bộ ngay” ở “Cá nhân”.',
      },
      { p: 'App không có trang đăng ký: tài khoản được tạo sẵn. Quên mật khẩu thì bấm “Quên mật khẩu?” ở trang đăng nhập để nhận link đặt lại qua email. Đăng xuất không xóa dữ liệu trên máy.' },
      { h: 'Học trên nhiều máy' },
      {
        list: [
          'Nếu sửa những chỗ khác nhau trên hai máy, app giữ cả hai thay đổi; nếu cả hai máy cùng sửa một chỗ, app giữ lần sửa sau cùng.',
          'Lượt học không bao giờ bị mất hay tính hai lần; lịch ôn được tính lại từ toàn bộ lượt học khi cần.',
          'Mục tiêu, lịch học và cài đặt học dùng chung. Riêng “Giảm hiệu ứng”, “Âm thanh hiệu ứng”, công tắc “Dùng giọng iPhone khi phát âm”, giọng máy đã chọn và tên phím tắt là của từng máy: đổi ở máy nào chỉ có tác dụng ở máy đó.',
        ],
      },
      { h: 'Trạng thái ở thẻ “Máy chủ và đồng bộ”' },
      {
        terms: [
          { term: '“Đã đồng bộ lúc”', text: 'Máy này đã khớp với máy chủ vào giờ đó.' },
          { term: '“thay đổi chờ gửi”', text: 'Thay đổi trên máy chưa lên máy chủ. Đã đăng nhập thì app tự gửi sau vài giây; chưa đăng nhập thì chờ tới khi bạn đăng nhập.' },
          {
            term: '“Đang mất mạng”',
            text: 'Máy đang không có mạng. Thay đổi vẫn lưu trên máy và tự gửi khi có mạng lại. Nếu mở trang Cá nhân lúc đang mất mạng, thẻ sẽ báo “Không kiểm tra được máy chủ:” thay cho dòng này; dữ liệu vẫn an toàn, có mạng lại thì mở lại trang.',
          },
          {
            term: '“Đồng bộ lỗi:”',
            text: 'Lần đồng bộ vừa rồi chưa xong, thường do mạng chập chờn. Dữ liệu vẫn lưu trên máy và app tự thử lại ở lượt sau. Nếu lỗi cứ lặp lại, hãy tạo bản sao lưu cho chắc.',
          },
        ],
      },
      { h: 'Sao lưu ra file' },
      {
        p: '“Cá nhân” → “Sao lưu, khôi phục, xuất file” → “Tạo bản sao lưu”, rồi “Lưu hoặc chia sẻ file” (trên iPhone chọn Lưu vào Tệp; trên máy tính nút này là “Tải file xuống”). File sao lưu (đuôi .json) gồm từ vựng, bộ từ, tiến độ ôn, lịch sử học và cài đặt học, nhưng không gồm âm thanh. Hãy cất file ở iCloud Drive hoặc Google Drive.',
      },
      { h: 'Khôi phục' },
      {
        terms: [
          { term: '“Gộp” (mặc định)', text: 'Thêm từ còn thiếu, lấy lại từ đã xóa; từ có cả trong file lẫn trong app thì giữ bản được sửa sau cùng. Không xóa gì.' },
          { term: '“Thay thế”', text: 'Từ vựng và bộ từ trở về đúng như bản sao lưu: từ không có trong file bị xóa trên mọi máy đã đồng bộ. Lượt học không bao giờ bị xóa.' },
        ],
      },
      {
        p: 'App luôn cho xem trước nội dung file trước khi thay đổi dữ liệu. Hồ sơ, mục tiêu và cài đặt học trong file chỉ được dùng khi bạn đánh dấu “Dùng cả hồ sơ và cài đặt học trong bản sao lưu” (mặc định không chọn); giọng máy đã chọn trên máy này vẫn được giữ.',
      },
      { h: 'Xuất ra Excel' },
      {
        p: '“Xuất từ vựng ra file” tạo file CSV mở được bằng Excel hoặc Google Sheets và nhập lại được vào app, có thêm cột cấp ghi nhớ và ngày ôn tiếp theo. Muốn chuyển cả tiến độ học sang máy khác thì dùng sao lưu.',
      },
      { tip: 'Máy này thiếu dữ liệu? Ở trang “Sao lưu, khôi phục, xuất file”, bấm “Tải lại toàn bộ từ máy chủ” để tải lại và gộp với dữ liệu đang có (không xóa gì).' },
    ],
  },
]

export const GUIDE_GROUPS: { title: string; topics: GuideTopicId[] }[] = [
  { title: 'Bắt đầu', topics: ['start'] },
  { title: 'Thêm từ, học và ôn', topics: ['add-words', 'learn', 'review', 'schedule'] },
  { title: 'Hiểu các con số', topics: ['levels', 'today', 'goals', 'stats'] },
  { title: 'Nhắc nhở, âm thanh và dữ liệu', topics: ['reminders', 'audio', 'sync'] },
]

export function guideTopic(id: GuideTopicId): GuideTopic {
  return GUIDE.find((t) => t.id === id)!
}

function blockText(b: GuideBlock): string[] {
  if ('h' in b) return [b.h]
  if ('p' in b) return [b.p]
  if ('tip' in b) return [b.tip]
  if ('steps' in b) return b.steps
  if ('list' in b) return b.list
  return b.terms.flatMap((t) => [t.term, t.text])
}

/** Toàn bộ chữ của một mục (để tìm). */
export function guideText(t: GuideTopic): string {
  return [t.title, t.summary, ...(t.keywords ?? []), ...t.blocks.flatMap(blockText)].join('\n')
}

/** Tên nút/mục được nhắc tới trong “…”. */
export function uiLabels(t: GuideTopic): string[] {
  const text = t.blocks.flatMap(blockText).join('\n')
  return [...new Set([...text.matchAll(/“([^”]+)”/g)].map((m) => m[1]))]
}

function count(haystack: string, needle: string): number {
  let n = 0
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++
  return n
}

/**
 * Tìm mục theo chữ, không cần gõ dấu. Có mục chứa nguyên cụm đã gõ thì chỉ lấy các mục đó;
 * không có thì lấy mục chứa đủ các chữ. Mục có tên khớp xếp trước.
 */
export function searchGuide(query: string): GuideTopic[] {
  const q = foldText(query)
  const words = q.split(' ').filter(Boolean)
  if (words.length === 0) return []
  const scored = GUIDE.map((t) => {
    const title = foldText(t.title)
    const head = foldText([t.summary, ...(t.keywords ?? [])].join(' '))
    const all = foldText(guideText(t))
    if (!words.every((w) => all.includes(w))) return null
    const phrase = all.includes(q)
    const score = (title.includes(q) ? 100 : 0) + (head.includes(q) ? 30 : 0) + words.filter((w) => title.includes(w)).length * 10 + count(all, q)
    return { t, score, phrase }
  }).filter((x): x is { t: GuideTopic; score: number; phrase: boolean } => x !== null)
  const exact = scored.filter((x) => x.phrase)
  return (exact.length > 0 ? exact : scored).sort((a, b) => b.score - a.score).map((x) => x.t)
}
