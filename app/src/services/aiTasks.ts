import {
  EXAMPLES_SYSTEM,
  examplesPrompt,
  MNEMONIC_SYSTEM,
  mnemonicPrompt,
  SENSE_MEANINGS_SYSTEM,
  senseMeaningsPrompt,
  toExamples,
  toMnemonics,
  toSenseMeanings,
  toWordInfo,
  WORD_INFO_SCHEMA,
  WORD_INFO_SYSTEM,
  type SenseInput,
} from '../core/ai'
import type { PartOfSpeech } from '../core/pos'
import { askJson } from './ai'

/** Các tác vụ AI của app (R8.1, R8.3, R8.4). Kết quả được lưu theo nội dung hỏi: hỏi lại y hệt thì có ngay. */

/** R8.1: nghĩa, loại từ, câu ví dụ và mẹo nhớ cho một từ (form thêm từ, ô "Thử trợ lý"). */
export function suggestWordInfo(term: string) {
  const q = term.trim()
  return askJson(
    { task: 'word_info', system: WORD_INFO_SYSTEM, prompt: `Từ cần tra: "${q}"`, schema: WORD_INFO_SCHEMA as unknown as Record<string, unknown>, maxTokens: 1500 },
    (raw) => toWordInfo(raw, q),
  )
}

/** R8.1: nghĩa tiếng Việt và bản dịch câu ví dụ cho các nghĩa tiếng Anh đã chọn khi tra từ. */
export function suggestSenseMeanings(term: string, senses: readonly SenseInput[]) {
  return askJson({ task: 'sense_meanings', system: SENSE_MEANINGS_SYSTEM, prompt: senseMeaningsPrompt(term, senses), maxTokens: 1500 }, (raw) => toSenseMeanings(raw, senses.length))
}

export interface WordRef {
  term: string
  partOfSpeech: PartOfSpeech
  meaningVi: string
  meaningEn?: string
  ipa?: string
}

/** R8.4: ba mẹo nhớ (theo âm, hình ảnh, tách từ). `attempt` > 1: xin mẹo khác. */
export function suggestMnemonics(w: WordRef, attempt = 1) {
  const prompt = mnemonicPrompt(w.term, w.partOfSpeech, w.meaningVi, w.ipa) + (attempt > 1 ? `\nHãy đưa ra 3 mẹo mới, khác các mẹo trước (lần ${attempt}).` : '')
  return askJson({ task: 'mnemonic', system: MNEMONIC_SYSTEM, prompt, maxTokens: 2000 }, toMnemonics)
}

/** R8.3: ba câu ví dụ theo trình độ, chủ đề và mục đích học. */
export function suggestExamples(w: WordRef, o: { level: string; topic: string; purpose?: string; attempt?: number }) {
  return askJson(
    { task: 'examples', system: EXAMPLES_SYSTEM, prompt: examplesPrompt({ term: w.term, partOfSpeech: w.partOfSpeech, meaningVi: w.meaningVi, meaningEn: w.meaningEn, ...o }), maxTokens: 1500 },
    (raw) => toExamples(raw, w.term),
  )
}
