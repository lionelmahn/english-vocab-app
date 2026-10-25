import type { ExerciseKind, SessionMode } from './grading'
import { studyTimeByLog } from './stats'

/**
 * Lịch sử bài làm (R6.8): các buổi học, ôn, luyện, kiểm tra và kết quả từng câu, dựng lại từ lượt trả lời (đồng bộ
 * giữa các máy), không phụ thuộc buổi học lưu trên máy.
 */

export interface HistoryLog {
  id: string
  itemId: string
  sessionId: string
  reviewedAt: number
  mode: SessionMode
  exercise: ExerciseKind
  correct: boolean | null
  affectsSchedule: boolean
  responseMs: number | null
  hintLevel?: number
}

export interface SessionRecord {
  sessionId: string
  mode: SessionMode
  startedAt: number
  endedAt: number
  /** Số từ khác nhau trong buổi. */
  items: number
  /** Theo câu trả lời đầu tiên của mỗi từ: đúng / sai (không tính từ không chấm, ví dụ thẻ tự đánh giá chưa trả lời). */
  correct: number
  wrong: number
  /** Tổng số lượt trả lời (gồm cả luyện lại). */
  answers: number
  durationMs: number
}

function bySession<T extends HistoryLog>(logs: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const l of logs) {
    const list = out.get(l.sessionId)
    if (list) list.push(l)
    else out.set(l.sessionId, [l])
  }
  for (const list of out.values()) list.sort((a, b) => a.reviewedAt - b.reviewedAt)
  return out
}

/** Các buổi, mới nhất trước. */
export function sessionHistory(logs: readonly HistoryLog[]): SessionRecord[] {
  const time = studyTimeByLog(logs)
  const out: SessionRecord[] = []
  for (const [sessionId, list] of bySession(logs)) {
    const first = new Map<string, boolean>()
    for (const l of list) if (l.correct !== null && !first.has(l.itemId)) first.set(l.itemId, l.correct)
    const results = [...first.values()]
    out.push({
      sessionId,
      mode: list[0].mode,
      startedAt: list[0].reviewedAt,
      endedAt: list[list.length - 1].reviewedAt,
      items: new Set(list.map((l) => l.itemId)).size,
      correct: results.filter(Boolean).length,
      wrong: results.filter((r) => !r).length,
      answers: list.length,
      durationMs: list.reduce((sum, l) => sum + (time.get(l) ?? 0), 0),
    })
  }
  return out.sort((a, b) => b.startedAt - a.startedAt)
}

export interface AnswerRecord<T extends HistoryLog = HistoryLog> {
  log: T
  /** Lượt thứ mấy của từ này trong buổi (0 = lần đầu; từ 1 trở đi là luyện lại). */
  attempt: number
}

/** Các câu trả lời của một buổi theo thứ tự làm. */
export function sessionAnswers<T extends HistoryLog>(logs: readonly T[], sessionId: string): AnswerRecord<T>[] {
  const list = bySession(logs.filter((l) => l.sessionId === sessionId)).get(sessionId) ?? []
  const seen = new Map<string, number>()
  return list.map((log) => {
    const attempt = seen.get(log.itemId) ?? 0
    seen.set(log.itemId, attempt + 1)
    return { log, attempt }
  })
}
