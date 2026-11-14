import { useEffect, useMemo, useState } from 'react'
import { wordKey, type Course, type CourseWord, type Lesson, type WordLookup } from '../core/courses'
import { checkExercise } from '../core/exercises'
import { liveCard } from '../core/library'
import { planLearn } from '../core/session'
import { COURSES, type CourseInfo } from '../data/courses'
import { db } from '../db/db'
import type { Library } from '../db/library'
import { repo, type ItemInput } from '../db/repo'
import type { ID } from '../db/types'
import { updateProfile } from './profile'

/** Học theo khóa (R16.3, R16.4, R16.6): lưu từ của bài vào sổ tay, mở buổi học, đánh dấu đã biết. */

export function courseInfo(id: string | undefined): CourseInfo | undefined {
  return COURSES.find((c) => c.id === id)
}

/** Nội dung khóa (tải khi cần). `null`: khóa không có hoặc chưa có nội dung; `undefined`: đang tải. */
export function useCourse(id: string | undefined): Course | null | undefined {
  const info = courseInfo(id)
  const [state, setState] = useState<{ id: string; course: Course | null } | null>(null)
  useEffect(() => {
    if (!info?.load) return
    let cancelled = false
    info
      .load()
      .then((course) => !cancelled && setState({ id: info.id, course }))
      .catch(() => !cancelled && setState({ id: info.id, course: null }))
    return () => {
      cancelled = true
    }
  }, [info])
  if (!info?.load) return null
  return state?.id === info.id ? state.course : undefined
}

/** Từ của bài ứng với mục nào trong sổ tay: cùng từ, cùng loại từ (một mục học = một nghĩa xác định). */
export function useWordLookup(lib: Library | undefined): WordLookup {
  const index = useMemo(() => {
    const m = new Map<string, { itemId: ID; learned: boolean }>()
    for (const item of lib?.items ?? []) {
      const key = wordKey(item.term, item.partOfSpeech)
      const learned = !!liveCard(lib!.cards.get(item.id))
      const prev = m.get(key)
      // Có hai mục cùng từ, cùng loại từ: ưu tiên mục đã học.
      if (!prev || (!prev.learned && learned)) m.set(key, { itemId: item.id, learned })
    }
    return m
  }, [lib])
  return useMemo<WordLookup>(() => (term, pos) => index.get(wordKey(term, pos)), [index])
}

export function wordInput(w: CourseWord, source?: string): ItemInput {
  return {
    term: w.term,
    partOfSpeech: w.partOfSpeech,
    meaningVi: w.meaningVi,
    ipaUs: w.ipaUs,
    ipaUk: w.ipaUk,
    examples: w.example ? [w.example] : [],
    acceptedAnswers: [],
    tags: [],
    favorite: false,
    difficult: false,
    source,
  }
}

/** Bộ từ của khóa (“Khóa: <tên>”), tạo ở lần đầu lưu từ của khóa. */
async function courseDeck(info: CourseInfo): Promise<ID> {
  const name = `Khóa: ${info.title}`
  const found = (await db.decks.toArray()).find((d) => d.name === name && d.deletedAt === null)
  return found?.id ?? repo.createDeck({ name, description: info.description })
}

/**
 * Lưu các từ đã chọn của bài vào sổ tay và vào bộ của khóa. Từ đã có (cùng từ, cùng loại từ) thì dùng mục có sẵn,
 * không tạo bản trùng. Trả về id các mục theo thứ tự của bài.
 */
export async function saveLessonWords(info: CourseInfo, words: readonly CourseWord[], lookup: WordLookup): Promise<ID[]> {
  const deckId = await courseDeck(info)
  const known = words.map((w) => lookup(w.term, w.partOfSpeech)?.itemId)
  const fresh = words.filter((_, i) => !known[i])
  const { created, existing } = await repo.saveFromSource(
    fresh.map((w) => wordInput(w, info.source)),
    [deckId],
  )
  const have = known.filter((id): id is ID => !!id)
  if (have.length) await repo.addToDeck(deckId, have)
  const made = [...created, ...existing]
  let j = 0
  return known.map((id) => id ?? made[j++]).filter((id): id is ID => !!id)
}

/** Ghi khóa đang học và bài đang làm (đồng bộ mọi máy). */
export function setCurrentLesson(info: CourseInfo, lesson: Lesson): Promise<unknown> {
  return updateProfile({ course: { id: info.id, lesson: lesson.no } })
}

/**
 * Học bài (R16.4): lưu từ đã chọn, rồi mở buổi học từ mới chỉ gồm các từ chưa học (thẻ giới thiệu → điền từ…, như học
 * bình thường). Trả về false nếu mọi từ đã chọn đều đã học.
 */
export async function startLesson(info: CourseInfo, lesson: Lesson, words: readonly CourseWord[], lookup: WordLookup): Promise<boolean> {
  const ids = await saveLessonWords(info, words, lookup)
  await setCurrentLesson(info, lesson)
  const cards = await db.cardStates.bulkGet(ids)
  const toLearn = ids.filter((_, i) => !liveCard(cards[i]))
  if (toLearn.length === 0) return false
  await repo.startSession({ ...planLearn(toLearn, () => checkExercise(), Date.now()), origin: { courseId: info.id, lesson: lesson.no } })
  return true
}

/** Đánh dấu đã biết (như ở kiểm tra trình độ): lên lịch như trả lời “Dễ”, không ghi lượt; trả về id để hoàn tác. */
export async function markLessonKnown(info: CourseInfo, lesson: Lesson, words: readonly CourseWord[], lookup: WordLookup): Promise<ID[]> {
  const ids = await saveLessonWords(info, words, lookup)
  await setCurrentLesson(info, lesson)
  return repo.markKnown(ids)
}
