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
  { id: 'giao-tiep', title: 'Giao tiếp hằng ngày', description: 'Chào hỏi, hỏi han, mời mọc, xin lỗi, cảm ơn… những từ hay dùng khi nói chuyện.', group: 'communication', levels: ['A2', 'B1'], topics: ['giao tiếp', 'hội thoại'], lessons: 20, words: 240 },
  { id: 'du-lich', title: 'Du lịch', description: 'Sân bay, khách sạn, ăn uống, hỏi đường, mua sắm khi đi du lịch.', group: 'communication', levels: ['A2', 'B1'], topics: ['du lịch', 'sân bay', 'khách sạn'], lessons: 17, words: 200 },
  { id: 'van-phong', title: 'Công việc văn phòng', description: 'Họp, email, báo cáo, kế hoạch, khách hàng: từ vựng làm việc hằng ngày.', group: 'career', levels: ['B1', 'B2'], topics: ['công việc', 'văn phòng', 'email'], lessons: 20, words: 240 },
  { id: 'cntt', title: 'Công nghệ thông tin', description: 'Phần mềm, dữ liệu, mạng, bảo mật, làm việc nhóm trong ngành công nghệ.', group: 'career', levels: ['B1', 'B2'], topics: ['công nghệ', 'phần mềm'], lessons: 14, words: 170 },
  { id: 'kinh-doanh', title: 'Kinh doanh và marketing', description: 'Thị trường, khách hàng, sản phẩm, quảng cáo, doanh thu.', group: 'career', levels: ['B1', 'B2'], topics: ['kinh doanh', 'marketing'], lessons: 14, words: 170 },
  { id: 'toeic', title: 'Luyện thi TOEIC', description: 'Từ hay gặp trong đề TOEIC: văn phòng, hợp đồng, đi lại công tác, sự kiện.', group: 'exam', levels: ['B1', 'B2'], topics: ['TOEIC', 'thi cử'], lessons: 25, words: 300 },
  { id: 'ielts', title: 'IELTS học thuật', description: 'Từ học thuật cho bài đọc và bài viết IELTS: nghiên cứu, xu hướng, lập luận.', group: 'exam', levels: ['B2', 'C1'], topics: ['IELTS', 'học thuật', 'thi cử'], lessons: 25, words: 300 },
]
