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
    id: 'mua-sam',
    title: 'Mua sắm',
    description:
      'Các loại cửa hàng, chợ và siêu thị, đồ dùng trong nhà, quần áo và giày dép, cỡ, màu và chất liệu, thử đồ, trả tiền, mặc cả và săn giảm giá, đổi trả, mua online, chọn quà: gần 180 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['mua sắm', 'cửa hàng', 'siêu thị', 'quần áo', 'trả tiền', 'mua online'],
    lessons: 14,
    words: 176,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Mua sắm (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('mua-sam', (await import('./mua-sam.txt?raw')).default)),
  },
  {
    id: 'an-uong',
    title: 'Ăn uống và nấu nướng',
    description:
      'Bữa ăn trong ngày, rau củ, trái cây, thịt, cá và hải sản, gia vị và mùi vị, dụng cụ nhà bếp, sơ chế và các cách nấu, làm món theo công thức, ăn ngoài và gọi đồ về, khẩu vị: 170 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['ăn uống', 'nấu ăn', 'món ăn', 'nhà bếp', 'gia vị', 'khẩu vị'],
    lessons: 14,
    words: 170,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Ăn uống và nấu nướng (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('an-uong', (await import('./an-uong.txt?raw')).default)),
  },
  {
    id: 'suc-khoe',
    title: 'Sức khỏe và đi khám',
    description:
      'Bộ phận cơ thể, đau nhức và cảm lạnh, đi khám, ở hiệu thuốc, sơ cứu, xét nghiệm và điều trị, vận động, thói quen lành mạnh, giấc ngủ, căng thẳng và sức khỏe tinh thần: gần 175 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['sức khỏe', 'cơ thể', 'đi khám', 'hiệu thuốc', 'sơ cứu', 'giấc ngủ', 'tinh thần'],
    lessons: 14,
    words: 173,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Sức khỏe và đi khám (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('suc-khoe', (await import('./suc-khoe.txt?raw')).default)),
  },
  {
    id: 'nha-cua',
    title: 'Nhà cửa và đời sống',
    description:
      'Kiểu nhà và các phòng, đồ đạc, dọn dẹp và giặt giũ, vườn nhà và cây cảnh, thú cưng, phòng tắm gặp sự cố, tự sửa đồ, chuyển nhà, hàng xóm, tiết kiệm điện nước, an toàn trong nhà: gần 175 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['nhà cửa', 'đồ đạc', 'việc nhà', 'thú cưng', 'sửa chữa', 'hàng xóm'],
    lessons: 14,
    words: 174,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Nhà cửa và đời sống (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('nha-cua', (await import('./nha-cua.txt?raw')).default)),
  },
  {
    id: 'cam-xuc',
    title: 'Cảm xúc và tính cách',
    description:
      'Niềm vui, háo hức, nỗi buồn, nhớ nhung, bực mình, giận dữ, ghen tị, sợ hãi, ngượng ngùng, miêu tả ngoại hình, nét mặt và cử chỉ, tính cách, bày tỏ cảm xúc, an ủi và làm lành: gần 175 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['cảm xúc', 'tính cách', 'ngoại hình', 'cử chỉ', 'giao tiếp'],
    lessons: 14,
    words: 175,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Cảm xúc và tính cách (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('cam-xuc', (await import('./cam-xuc.txt?raw')).default)),
  },
  {
    id: 'thoi-tiet',
    title: 'Thời tiết và thiên nhiên',
    description:
      'Nắng, mưa, gió, sấm chớp, nắng nóng và trời rét, các mùa, núi rừng và hang động, sông hồ và biển, cây cỏ hoa lá, động vật hoang dã, côn trùng, thiên tai và cách ứng phó, sống xanh: gần 180 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['thời tiết', 'mùa', 'thiên nhiên', 'động vật', 'thiên tai', 'môi trường'],
    lessons: 14,
    words: 179,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Thời tiết và thiên nhiên (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('thoi-tiet', (await import('./thoi-tiet.txt?raw')).default)),
  },
  {
    id: 'giao-thong',
    title: 'Phương tiện và giao thông',
    description:
      'Xe máy, xe đạp, ô tô và xe khách, xe buýt và gọi xe, giờ cao điểm, đường sá, hỏi đường, bộ phận xe, học lái, cây xăng và bãi xe, sửa xe, biển báo và luật giao thông, bị phạt, tai nạn và an toàn: 170 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['giao thông', 'xe cộ', 'đường phố', 'học lái xe', 'luật giao thông', 'an toàn'],
    lessons: 14,
    words: 170,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Phương tiện và giao thông (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('giao-thong', (await import('./giao-thong.txt?raw')).default)),
  },
  {
    id: 'giai-tri',
    title: 'Giải trí, thể thao, sở thích',
    description:
      'Thể loại phim, đi xem phim, phim bộ và truyền hình, ca hát và nhạc cụ, cờ và câu đố, trò chơi điện tử, các môn thể thao, trận đấu và giải đấu, sách và truyện cổ tích, đi chơi cuối tuần, sở thích sáng tạo: gần 180 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['giải trí', 'phim ảnh', 'âm nhạc', 'trò chơi', 'thể thao', 'sở thích'],
    lessons: 14,
    words: 176,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Giải trí, thể thao, sở thích (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('giai-tri', (await import('./giai-tri.txt?raw')).default)),
  },
  {
    id: 'gia-dinh',
    title: 'Gia đình và các mối quan hệ',
    description:
      'Gia đình nhiều thế hệ, họ hàng nội ngoại, Tết và ngày giỗ, hẹn hò và yêu đương, cầu hôn và đám cưới, chuyện vợ chồng, khi gia đình đổi thay, mang thai và chăm con nhỏ, dạy con, tuổi mới lớn, tình bạn: hơn 170 từ và cụm từ ngoài bộ 1.000 từ.',
    group: 'communication',
    levels: ['A2', 'B1'],
    topics: ['gia đình', 'họ hàng', 'hẹn hò', 'cưới hỏi', 'nuôi dạy con', 'tình bạn'],
    lessons: 14,
    words: 171,
    attribution: 'Danh sách từ, cách chia bài, nghĩa, câu ví dụ và đoạn đọc do app soạn, giấy phép CC BY-SA 4.0. Phiên âm: Wiktionary (CC BY-SA 4.0).',
    source: 'Khóa Gia đình và các mối quan hệ (app soạn, CC BY-SA 4.0)',
    load: lazy(async () => parseCourse('gia-dinh', (await import('./gia-dinh.txt?raw')).default)),
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
  { id: 'tai-chinh', title: 'Tài chính và ngân hàng', description: 'Tài khoản, vay và lãi suất, đầu tư, bảo hiểm, thuế, quản lý chi tiêu cá nhân.', group: 'career', levels: ['B1', 'B2'], topics: ['tài chính', 'ngân hàng'], lessons: 14, words: 170 },
  { id: 'y-te', title: 'Y tế và điều dưỡng', description: 'Bệnh viện, khoa phòng, chăm sóc người bệnh, thuốc men, giao tiếp với người bệnh và người nhà.', group: 'career', levels: ['B1', 'B2'], topics: ['y tế', 'điều dưỡng', 'bệnh viện'], lessons: 14, words: 170 },
  { id: 'khach-san', title: 'Khách sạn và nhà hàng', description: 'Lễ tân, buồng phòng, phục vụ bàn, bếp, đặt chỗ, xử lý phàn nàn của khách.', group: 'career', levels: ['B1', 'B2'], topics: ['khách sạn', 'nhà hàng', 'dịch vụ'], lessons: 14, words: 170 },
]
