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
  { id: 'van-phong', title: 'Công việc văn phòng', description: 'Họp, email, báo cáo, kế hoạch, khách hàng: từ vựng làm việc hằng ngày.', group: 'career', levels: ['B1', 'B2'], topics: ['công việc', 'văn phòng', 'email'], lessons: 20, words: 240 },
  { id: 'cntt', title: 'Công nghệ thông tin', description: 'Phần mềm, dữ liệu, mạng, bảo mật, làm việc nhóm trong ngành công nghệ.', group: 'career', levels: ['B1', 'B2'], topics: ['công nghệ', 'phần mềm'], lessons: 14, words: 170 },
  { id: 'kinh-doanh', title: 'Kinh doanh và marketing', description: 'Thị trường, khách hàng, sản phẩm, quảng cáo, doanh thu.', group: 'career', levels: ['B1', 'B2'], topics: ['kinh doanh', 'marketing'], lessons: 14, words: 170 },
  { id: 'toeic', title: 'Luyện thi TOEIC', description: 'Từ hay gặp trong đề TOEIC: văn phòng, hợp đồng, đi lại công tác, sự kiện.', group: 'exam', levels: ['B1', 'B2'], topics: ['TOEIC', 'thi cử'], lessons: 25, words: 300 },
  { id: 'ielts', title: 'IELTS học thuật', description: 'Từ học thuật cho bài đọc và bài viết IELTS: nghiên cứu, xu hướng, lập luận.', group: 'exam', levels: ['B2', 'C1'], topics: ['IELTS', 'học thuật', 'thi cử'], lessons: 25, words: 300 },
]
