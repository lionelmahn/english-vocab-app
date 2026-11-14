import type { PartOfSpeech } from './pos'
import { POS_ORDER } from './pos'
import type { SelfLevel } from './profile'
import { termKey } from './vocab'

/**
 * Khóa học (R16): các bài học có sẵn trong app. Mỗi bài có mục tiêu, 8–14 từ và một đoạn đọc ngắn dùng chính các từ
 * đó. Học một bài = chọn từ, lưu vào sổ tay (R2.8) rồi học bằng buổi học từ mới (R4). Tiến độ không lưu riêng: tính
 * thẳng từ sổ tay và lịch ôn, nên tự đồng bộ giữa các máy và không bao giờ bị đếm hai lần.
 */

export type CourseGroup = 'foundation' | 'communication' | 'career' | 'exam'

export const COURSE_GROUP_LABEL: Record<CourseGroup, string> = {
  foundation: 'Nền tảng',
  communication: 'Giao tiếp',
  career: 'Chuyên ngành',
  exam: 'Thi cử',
}

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1'

export interface CourseWord {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
  example?: { en: string; vi: string }
  ipaUs?: string
  ipaUk?: string
}

export interface Lesson {
  /** Số thứ tự trong cả khóa, tính từ 1 (dùng trên URL). */
  no: number
  title: string
  goal: string
  words: CourseWord[]
  /** Đoạn đọc; từ của bài đánh dấu [chữ] hoặc [chữ trong câu|từ gốc]. */
  passage: string
  passageVi: string
  /** Chỉ số chương (từ 0). */
  chapter: number
}

export interface Chapter {
  title: string
  lessons: Lesson[]
}

export interface Course {
  id: string
  chapters: Chapter[]
  lessons: Lesson[]
}

/**
 * Đọc file khóa học, mỗi dòng một mục, các ô cách nhau bởi `|`:
 * `H|tên chương`, `L|tên bài|mục tiêu`, `W|từ|loại từ|nghĩa|câu ví dụ|dịch câu|phiên âm Mỹ|phiên âm Anh`,
 * `P|đoạn đọc`, `V|bản dịch đoạn đọc`. Dòng trống và dòng bắt đầu bằng `#` bỏ qua.
 */
export function parseCourse(id: string, text: string): Course {
  const chapters: Chapter[] = []
  const lessons: Lesson[] = []
  let lesson: Lesson | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (!line || line.startsWith('#')) continue
    const [kind, ...f] = line.split('|')
    if (kind === 'H') {
      chapters.push({ title: f[0], lessons: [] })
    } else if (kind === 'L' && chapters.length) {
      lesson = { no: lessons.length + 1, title: f[0], goal: f[1] ?? '', words: [], passage: '', passageVi: '', chapter: chapters.length - 1 }
      lessons.push(lesson)
      chapters[chapters.length - 1].lessons.push(lesson)
    } else if (kind === 'W' && lesson) {
      const pos = (POS_ORDER as readonly string[]).includes(f[1]) ? (f[1] as PartOfSpeech) : 'other'
      lesson.words.push({
        term: f[0],
        partOfSpeech: pos,
        meaningVi: f[2] ?? '',
        example: f[3] ? { en: f[3], vi: f[4] ?? '' } : undefined,
        ipaUs: f[5] || undefined,
        ipaUk: f[6] || undefined,
      })
    } else if (kind === 'P' && lesson) {
      lesson.passage = f.join('|')
    } else if (kind === 'V' && lesson) {
      lesson.passageVi = f.join('|')
    }
  }
  return { id, chapters, lessons }
}

export type PassagePart = { text: string; term?: undefined } | { text: string; term: string }

/** Tách đoạn đọc thành chữ thường và từ của bài: `[made|make]` → chữ "made" của từ "make", `[decision]` → chính nó. */
export function passageParts(passage: string): PassagePart[] {
  const parts: PassagePart[] = []
  const re = /\[([^\]|]+)(?:\|([^\]]+))?\]/g
  let last = 0
  for (let m = re.exec(passage); m; m = re.exec(passage)) {
    if (m.index > last) parts.push({ text: passage.slice(last, m.index) })
    parts.push({ text: m[1], term: (m[2] ?? m[1]).trim() })
    last = m.index + m[0].length
  }
  if (last < passage.length) parts.push({ text: passage.slice(last) })
  return parts
}

/** Đoạn đọc không còn dấu đánh dấu (để máy đọc to). */
export function plainPassage(passage: string): string {
  return passageParts(passage)
    .map((p) => p.text)
    .join('')
}

/** Một từ của bài tương ứng mục nào trong sổ tay (cùng từ, cùng loại từ) và đã học chưa. */
export interface WordLookup {
  (term: string, partOfSpeech: PartOfSpeech): { itemId: string; learned: boolean } | undefined
}

export const wordKey = (term: string, partOfSpeech: PartOfSpeech) => `${termKey(term)}|${partOfSpeech}`

export interface LessonProgress {
  learned: number
  /** Có trong sổ tay nhưng chưa học. */
  saved: number
  total: number
  done: boolean
}

/** Tiến độ một bài: bài xong khi mọi từ đã học (hoặc đã đánh dấu đã biết, cũng có lịch ôn). */
export function lessonProgress(lesson: Lesson, lookup: WordLookup): LessonProgress {
  let learned = 0
  let saved = 0
  for (const w of lesson.words) {
    const hit = lookup(w.term, w.partOfSpeech)
    if (hit?.learned) learned++
    else if (hit) saved++
  }
  return { learned, saved, total: lesson.words.length, done: lesson.words.length > 0 && learned === lesson.words.length }
}

export interface CourseProgress {
  lessonsDone: number
  learned: number
  words: number
  /** Bài nên học tiếp: bài đầu tiên chưa xong (mọi bài đều mở). */
  next?: Lesson
  started: boolean
}

export function courseProgress(course: Course, lookup: WordLookup): CourseProgress {
  let lessonsDone = 0
  let learned = 0
  let words = 0
  let next: Lesson | undefined
  for (const lesson of course.lessons) {
    const p = lessonProgress(lesson, lookup)
    learned += p.learned
    words += p.total
    if (p.done) lessonsDone++
    else next ??= lesson
  }
  return { lessonsDone, learned, words, next, started: learned > 0 }
}

/** Trình độ tự chọn trong hồ sơ ứng với bậc CEFR (để gắn nhãn khóa “Hợp với bạn”). */
const LEVEL_CEFR: Record<SelfLevel, Cefr[]> = {
  beginner: ['A1'],
  elementary: ['A1', 'A2'],
  intermediate: ['A2', 'B1'],
  upper_intermediate: ['B1', 'B2'],
  advanced: ['B2', 'C1'],
}

export function fitsLevel(levels: readonly Cefr[], selfLevel: SelfLevel | undefined): boolean {
  return !!selfLevel && levels.some((l) => LEVEL_CEFR[selfLevel].includes(l))
}

/** Lọc khóa theo nhóm, bậc và chữ tìm (không dấu, theo tên, mô tả, chủ đề). */
export function filterCourses<T extends { title: string; description: string; topics: readonly string[]; group: CourseGroup; levels: readonly Cefr[] }>(
  list: readonly T[],
  opts: { group?: CourseGroup; level?: Cefr; query?: string; fold: (s: string) => string },
): T[] {
  const q = opts.fold(opts.query ?? '')
  return list.filter(
    (c) =>
      (!opts.group || c.group === opts.group) &&
      (!opts.level || c.levels.includes(opts.level)) &&
      (!q || [c.title, c.description, ...c.topics].some((s) => opts.fold(s).includes(q))),
  )
}
