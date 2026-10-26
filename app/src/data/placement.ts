import type { PartOfSpeech } from '../core/pos'

/**
 * Từ dùng cho bài kiểm tra trình độ (R1.8) ở các dải trên 1.000 từ thông dụng: không có trong bộ 1.000 từ khởi đầu,
 * chọn theo mức thường gặp ở trình độ B1, B2, C1 (theo các danh sách từ theo trình độ phổ biến). Nghĩa do app soạn.
 */
export interface ProbeWord {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
}

/** Dải 1.000–2.000 từ (khoảng B1). */
export const PROBE_B1: readonly ProbeWord[] = [
  { term: 'borrow', partOfSpeech: 'verb', meaningVi: 'mượn' },
  { term: 'climate', partOfSpeech: 'noun', meaningVi: 'khí hậu' },
  { term: 'complain', partOfSpeech: 'verb', meaningVi: 'phàn nàn' },
  { term: 'confident', partOfSpeech: 'adjective', meaningVi: 'tự tin' },
  { term: 'disappear', partOfSpeech: 'verb', meaningVi: 'biến mất' },
  { term: 'equipment', partOfSpeech: 'noun', meaningVi: 'thiết bị' },
  { term: 'frighten', partOfSpeech: 'verb', meaningVi: 'làm hoảng sợ' },
  { term: 'grateful', partOfSpeech: 'adjective', meaningVi: 'biết ơn' },
  { term: 'journey', partOfSpeech: 'noun', meaningVi: 'chuyến đi, hành trình' },
  { term: 'neighbor', partOfSpeech: 'noun', meaningVi: 'hàng xóm' },
  { term: 'polite', partOfSpeech: 'adjective', meaningVi: 'lịch sự' },
  { term: 'recipe', partOfSpeech: 'noun', meaningVi: 'công thức nấu ăn' },
  { term: 'shy', partOfSpeech: 'adjective', meaningVi: 'nhút nhát' },
  { term: 'tidy', partOfSpeech: 'adjective', meaningVi: 'gọn gàng' },
  { term: 'wealthy', partOfSpeech: 'adjective', meaningVi: 'giàu có' },
  { term: 'invite', partOfSpeech: 'verb', meaningVi: 'mời' },
  { term: 'luggage', partOfSpeech: 'noun', meaningVi: 'hành lý' },
  { term: 'pollution', partOfSpeech: 'noun', meaningVi: 'sự ô nhiễm' },
]

/** Dải 2.000–3.500 từ (khoảng B2). */
export const PROBE_B2: readonly ProbeWord[] = [
  { term: 'reluctant', partOfSpeech: 'adjective', meaningVi: 'miễn cưỡng, ngần ngại' },
  { term: 'abandon', partOfSpeech: 'verb', meaningVi: 'bỏ rơi, từ bỏ' },
  { term: 'inevitable', partOfSpeech: 'adjective', meaningVi: 'không thể tránh khỏi' },
  { term: 'persuade', partOfSpeech: 'verb', meaningVi: 'thuyết phục' },
  { term: 'shortage', partOfSpeech: 'noun', meaningVi: 'sự thiếu hụt' },
  { term: 'vivid', partOfSpeech: 'adjective', meaningVi: 'sống động, rõ nét' },
  { term: 'negotiate', partOfSpeech: 'verb', meaningVi: 'đàm phán' },
  { term: 'fragile', partOfSpeech: 'adjective', meaningVi: 'dễ vỡ, mong manh' },
  { term: 'grief', partOfSpeech: 'noun', meaningVi: 'nỗi đau buồn' },
  { term: 'hesitate', partOfSpeech: 'verb', meaningVi: 'do dự' },
  { term: 'thrive', partOfSpeech: 'verb', meaningVi: 'phát triển mạnh' },
  { term: 'obstacle', partOfSpeech: 'noun', meaningVi: 'trở ngại' },
  { term: 'reveal', partOfSpeech: 'verb', meaningVi: 'tiết lộ' },
  { term: 'substantial', partOfSpeech: 'adjective', meaningVi: 'đáng kể' },
  { term: 'deliberately', partOfSpeech: 'adverb', meaningVi: 'cố ý' },
  { term: 'reputation', partOfSpeech: 'noun', meaningVi: 'danh tiếng' },
  { term: 'anxious', partOfSpeech: 'adjective', meaningVi: 'lo lắng' },
  { term: 'cope', partOfSpeech: 'verb', meaningVi: 'đối phó, xoay xở' },
]

/** Dải 3.500–6.000 từ (khoảng C1). */
export const PROBE_C1: readonly ProbeWord[] = [
  { term: 'meticulous', partOfSpeech: 'adjective', meaningVi: 'tỉ mỉ, kỹ lưỡng' },
  { term: 'ubiquitous', partOfSpeech: 'adjective', meaningVi: 'có mặt khắp nơi' },
  { term: 'scrutinize', partOfSpeech: 'verb', meaningVi: 'xem xét kỹ lưỡng' },
  { term: 'resilient', partOfSpeech: 'adjective', meaningVi: 'kiên cường, mau phục hồi' },
  { term: 'mitigate', partOfSpeech: 'verb', meaningVi: 'giảm nhẹ' },
  { term: 'candid', partOfSpeech: 'adjective', meaningVi: 'thẳng thắn' },
  { term: 'elusive', partOfSpeech: 'adjective', meaningVi: 'khó nắm bắt' },
  { term: 'tedious', partOfSpeech: 'adjective', meaningVi: 'tẻ nhạt, chán ngắt' },
  { term: 'conspicuous', partOfSpeech: 'adjective', meaningVi: 'dễ thấy, nổi bật' },
  { term: 'reconcile', partOfSpeech: 'verb', meaningVi: 'hòa giải' },
  { term: 'frugal', partOfSpeech: 'adjective', meaningVi: 'tiết kiệm, đạm bạc' },
  { term: 'imminent', partOfSpeech: 'adjective', meaningVi: 'sắp xảy ra' },
  { term: 'lethargic', partOfSpeech: 'adjective', meaningVi: 'uể oải, lờ đờ' },
  { term: 'deter', partOfSpeech: 'verb', meaningVi: 'ngăn cản, làm nản lòng' },
  { term: 'scarcity', partOfSpeech: 'noun', meaningVi: 'sự khan hiếm' },
  { term: 'dilemma', partOfSpeech: 'noun', meaningVi: 'tình thế khó xử' },
  { term: 'feasible', partOfSpeech: 'adjective', meaningVi: 'khả thi' },
  { term: 'undermine', partOfSpeech: 'verb', meaningVi: 'làm suy yếu' },
]
