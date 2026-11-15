import { parseCourse, type Cefr, type Course, type CourseGroup } from '../../core/courses'

/**
 * Danh mục khóa học (R16.1). Mỗi khóa là một file dữ liệu riêng, chỉ tải khi mở (có trong bộ nhớ ngoại tuyến sau lần
 * đầu). Khóa chưa có `load` là khóa sắp có, theo kế hoạch giai đoạn 6.
 */

export interface CourseInfo {
  id: string
  title: string
  description: string
  group: CourseGroup
  levels: Cefr[]
  topics: string[]
  /** Số bài và số từ (test kiểm khớp với file dữ liệu). */
  lessons: number
  words: number
  attribution?: string
  /** Nguồn ghi trên từng từ lưu vào sổ tay từ khóa này. */
  source?: string
  load?: () => Promise<Course>
}

function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined
  return () =>
    (p ??= load().catch((e: unknown) => {
      p = undefined
      throw e
    }))
}

const BSL_CREDIT =
  'Một phần danh sách từ: Business Service List 1.2 của C. Browne và B. Culligan (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0). Phần còn lại của danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, cùng giấy phép.'

export const COURSES: readonly CourseInfo[] = [
  {
    id: 'ngsl-chu-de',
    title: '1.000 từ thông dụng theo chủ đề',
    description:
      '1.000 từ xuất hiện nhiều nhất trong tiếng Anh, chia theo chủ đề đời thường. Mỗi bài khoảng 11 từ và một đoạn đọc ngắn dùng chính các từ đó.',
    group: 'foundation',
    levels: ['A1', 'A2'],
    topics: ['gia đình', 'nhà cửa', 'ăn uống', 'thời gian', 'trường học', 'công việc', 'mua bán', 'đi lại', 'cảm xúc', 'xã hội'],
    lessons: 96,
    words: 1000,
    attribution:
      'Danh sách từ: New General Service List 1.2 của C. Browne, B. Culligan và J. Phillips (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0). Cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, cùng giấy phép.',
    source: 'NGSL 1.2 (CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('ngsl-chu-de', (await import('./ngsl-chu-de.txt?raw')).default)),
  },
  {
    id: 'giao-tiep',
    title: 'Giao tiếp hằng ngày',
    description:
      'Số đếm, chào hỏi, cảm ơn và xin lỗi, mời và hẹn gặp, gọi điện, nhắn tin, cảm xúc, ý kiến: gần 250 từ và cụm từ hay dùng khi nói chuyện, ngoài bộ 1.000 từ. Mỗi bài là một đoạn hội thoại ngắn.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['giao tiếp', 'hội thoại', 'số đếm', 'chào hỏi', 'mời mọc', 'gọi điện', 'cảm xúc', 'ý kiến'],
    lessons: 21,
    words: 247,
    attribution:
      'Một phần danh sách từ: New General Service List – Spoken 1.2 của C. Browne, B. Culligan và J. Phillips (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0). Phần còn lại của danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, cùng giấy phép.',
    source: 'Khóa Giao tiếp hằng ngày (NGSL-Spoken 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('giao-tiep', (await import('./giao-tiep.txt?raw')).default)),
  },
  {
    id: 'du-lich',
    title: 'Du lịch',
    description:
      'Theo một chuyến đi: chuẩn bị, sân bay, khách sạn, đi lại ở nơi mới, ăn uống, hỏi đường và tham quan, đổi tiền và mua sắm, xử lý sự cố. Hơn 200 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['du lịch', 'sân bay', 'khách sạn', 'đi lại', 'nhà hàng', 'hỏi đường', 'mua sắm'],
    lessons: 18,
    words: 206,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Du lịch (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('du-lich', (await import('./du-lich.txt?raw')).default)),
  },
  {
    id: 'van-phong',
    title: 'Công việc văn phòng',
    description:
      'Đồng nghiệp và giờ làm, đồ dùng văn phòng, lịch họp, email, gọi điện và họp trực tuyến, giao việc, thuyết trình, biểu đồ, tuyển dụng, lương và nghỉ phép: gần 250 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'career',
    levels: ['B1', 'B2'],
    topics: ['công việc', 'văn phòng', 'cuộc họp', 'email', 'thuyết trình', 'nhân sự'],
    lessons: 20,
    words: 248,
    attribution: BSL_CREDIT,
    source: 'Khóa Công việc văn phòng (BSL 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('van-phong', (await import('./van-phong.txt?raw')).default)),
  },
  {
    id: 'cntt',
    title: 'Công nghệ thông tin',
    description:
      'Thiết bị, phần mềm, internet và mạng, lưu trữ, hỗ trợ người dùng, viết mã và kiểm thử, bảo mật, trí tuệ nhân tạo: gần 180 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'career',
    levels: ['B1', 'B2'],
    topics: ['công nghệ', 'phần mềm', 'internet', 'lập trình', 'bảo mật', 'trí tuệ nhân tạo'],
    lessons: 14,
    words: 176,
    attribution: BSL_CREDIT,
    source: 'Khóa Công nghệ thông tin (BSL 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('cntt', (await import('./cntt.txt?raw')).default)),
  },
  {
    id: 'kinh-doanh',
    title: 'Kinh doanh và marketing',
    description:
      'Bán lẻ và giá cả, khách hàng, sản phẩm và thương hiệu, quảng cáo, mạng xã hội, doanh thu và vốn, đàm phán, kho hàng, đối thủ, khởi nghiệp: 170 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'career',
    levels: ['B1', 'B2'],
    topics: ['kinh doanh', 'marketing', 'bán hàng', 'thương hiệu', 'quảng cáo', 'tài chính', 'khởi nghiệp'],
    lessons: 14,
    words: 170,
    attribution: BSL_CREDIT,
    source: 'Khóa Kinh doanh và marketing (BSL 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('kinh-doanh', (await import('./kinh-doanh.txt?raw')).default)),
  },
  {
    id: 'toeic',
    title: 'Luyện thi TOEIC',
    description:
      'Từ hay gặp trong đề TOEIC: hội thảo và sự kiện, đặt tiệc, thuê nhà và văn phòng, sửa chữa, đặt hàng và giao nhận, ngân hàng, nhà máy, khám bệnh, công tác, quy định, thư từ, hoạt động cộng đồng. Hơn 300 từ và cụm từ ngoài các khóa khác.',
    group: 'exam',
    levels: ['B1', 'B2'],
    topics: ['TOEIC', 'thi cử', 'sự kiện', 'nhà cửa', 'ngân hàng', 'sản xuất', 'thư từ'],
    lessons: 25,
    words: 303,
    attribution:
      'Một phần danh sách từ: TOEIC Service List 1.2 của C. Browne và B. Culligan (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0). Phần còn lại của danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, cùng giấy phép. TOEIC là nhãn hiệu của ETS; khóa này không do ETS soạn hay xác nhận.',
    source: 'Khóa Luyện thi TOEIC (TSL 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('toeic', (await import('./toeic.txt?raw')).default)),
  },
  {
    id: 'ielts',
    title: 'IELTS học thuật',
    description:
      'Từ học thuật cho bài đọc và bài viết IELTS: đại học và nghiên cứu, mô tả biểu đồ, lập luận và từ nối, môi trường, sức khỏe, xã hội, lịch sử và khảo cổ, ngôn ngữ, tâm lý, khoa học tự nhiên. Hơn 300 từ.',
    group: 'exam',
    levels: ['B2', 'C1'],
    topics: ['IELTS', 'học thuật', 'thi cử', 'nghiên cứu', 'biểu đồ', 'môi trường', 'xã hội'],
    lessons: 25,
    words: 302,
    attribution:
      'Một phần danh sách từ: New Academic Word List 1.2 của C. Browne, B. Culligan và J. Phillips (newgeneralservicelist.com), giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0). Phần còn lại của danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, cùng giấy phép. IELTS là nhãn hiệu của các đơn vị tổ chức kỳ thi; khóa này không do họ soạn hay xác nhận.',
    source: 'Khóa IELTS học thuật (NAWL 1.2, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('ielts', (await import('./ielts.txt?raw')).default)),
  },
  { id: 'mua-sam', title: 'Mua sắm', description: 'Đi chợ, siêu thị, cửa hàng quần áo, mua online, đổi trả hàng.', group: 'communication', levels: ['A2', 'B1'], topics: ['mua sắm', 'giao tiếp'], lessons: 14, words: 170 },
  { id: 'an-uong', title: 'Ăn uống và nấu nướng', description: 'Món ăn, nguyên liệu, cách nấu, gọi món, nói về khẩu vị.', group: 'communication', levels: ['A2', 'B1'], topics: ['ăn uống', 'nấu ăn', 'giao tiếp'], lessons: 14, words: 170 },
  { id: 'suc-khoe', title: 'Sức khỏe và đi khám', description: 'Cơ thể, triệu chứng, đi khám, hiệu thuốc, giữ gìn sức khỏe.', group: 'communication', levels: ['A2', 'B1'], topics: ['sức khỏe', 'giao tiếp'], lessons: 14, words: 170 },
]
