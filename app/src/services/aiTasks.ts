import {
  CHAT_SUMMARY_SYSTEM,
  chatSummaryPrompt,
  chatSystem,
  COLLOCATIONS_SYSTEM,
  CONFUSABLES_SYSTEM,
  CONTEXT_SYSTEM,
  contextPrompt,
  CORRECTION_SYSTEM,
  correctionPrompt,
  EXAMPLES_SYSTEM,
  examplesPrompt,
  MNEMONIC_SYSTEM,
  mnemonicPrompt,
  PRACTICE_SYSTEM,
  practicePrompt,
  PRONOUNCE_TIP_SYSTEM,
  pronounceTipPrompt,
  SENSE_MEANINGS_SYSTEM,
  senseMeaningsPrompt,
  toChatSummary,
  toChatTurn,
  toCollocations,
  toConfusables,
  toContextExplanation,
  toCorrection,
  toExamples,
  toMnemonics,
  toPracticeSentences,
  toPronounceTip,
  toSenseMeanings,
  toWordInfo,
  WORD_INFO_SCHEMA,
  WORD_INFO_SYSTEM,
  wordPrompt,
  type SenseInput,
} from '../core/ai'
import type { PartOfSpeech } from '../core/pos'
import type { VocabItem } from '../db/types'
import { askJson, peekJson, type AskOptions } from './ai'

/** Các tác vụ AI của app (R8.1–R8.7, R7.4, R7.5). Kết quả được lưu theo nội dung hỏi: hỏi lại y hệt thì có ngay. */

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

export const wordRefOf = (item: VocabItem): WordRef => ({ term: item.term, partOfSpeech: item.partOfSpeech, meaningVi: item.meaningVi, meaningEn: item.meaningEn, ipa: item.ipaUs ?? item.ipaUk })

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

const collocationsAsk = (w: WordRef): AskOptions => ({ task: 'collocations', system: COLLOCATIONS_SYSTEM, prompt: wordPrompt(w.term, w.partOfSpeech, w.meaningVi), maxTokens: 1500 })
const confusablesAsk = (w: WordRef): AskOptions => ({ task: 'confusables', system: CONFUSABLES_SYSTEM, prompt: wordPrompt(w.term, w.partOfSpeech, w.meaningVi), maxTokens: 2000 })

/** R7.4: kết hợp từ cho từ không có trong nội dung soạn sẵn. */
export function suggestCollocations(w: WordRef) {
  return askJson(collocationsAsk(w), (raw) => toCollocations(raw, w.term))
}

/** Kết hợp từ AI đã gợi ý trước đây trên máy này (không gọi AI). */
export function cachedCollocations(w: WordRef) {
  return peekJson(collocationsAsk(w), (raw) => toCollocations(raw, w.term))
}

/** R7.5: nhóm từ dễ nhầm cho từ không có trong danh sách soạn sẵn. Danh sách rỗng: AI không thấy từ nào hay bị nhầm. */
export function suggestConfusables(w: WordRef) {
  return askJson(confusablesAsk(w), (raw) => toConfusables(raw, w.term))
}

export function cachedConfusables(w: WordRef) {
  return peekJson(confusablesAsk(w), (raw) => toConfusables(raw, w.term))
}

/** R8.2: nghĩa của chữ (hoặc cụm) người học chọn, đúng trong câu đang đọc. */
export function explainInContext(passage: string, sentence: string, selection: string) {
  return askJson({ task: 'context', system: CONTEXT_SYSTEM, prompt: contextPrompt(passage, sentence, selection), maxTokens: 1500 }, (raw) => toContextExplanation(raw, selection, sentence))
}

/** R8.6: chấm câu người học viết với từ đang học: lỗi, câu sửa, cách dùng từ. */
export function correctSentence(w: WordRef, sentence: string, level: string) {
  return askJson(
    { task: 'correct', system: CORRECTION_SYSTEM, prompt: correctionPrompt({ term: w.term, partOfSpeech: w.partOfSpeech, meaningVi: w.meaningVi, level, sentence }), maxTokens: 2000 },
    (raw) => toCorrection(raw, sentence),
  )
}

/** R8.5: một câu mới cho mỗi từ (tối đa 10 từ một lần hỏi); câu không chứa đúng chữ cần điền thì null. */
export function freshSentences(words: readonly WordRef[], level: string) {
  const list = words.slice(0, 10)
  return askJson({ task: 'practice', system: PRACTICE_SYSTEM, prompt: practicePrompt(list, level), maxTokens: 2000 }, (raw) => toPracticeSentences(raw, list.map((w) => w.term)))
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** R8.7: lượt trả lời tiếp theo của bạn luyện nói. Không lưu kết quả (mỗi buổi một khác); gửi tối đa 20 lượt gần nhất. */
export function chatTurn(o: { scenario: string; words: string[]; level: string }, turns: readonly ChatTurn[]) {
  return askJson({ task: 'chat', system: chatSystem(o), messages: turns.slice(-20), maxTokens: 1200, useCache: false }, (raw) => toChatTurn(raw, o.words))
}

/** R8.7: nhận xét cuối buổi hội thoại: từ đã dùng đúng, sai, chưa dùng và lời khuyên. */
export function summarizeChat(words: readonly string[], turns: readonly ChatTurn[]) {
  return askJson({ task: 'chat_summary', system: CHAT_SUMMARY_SYSTEM, prompt: chatSummaryPrompt(words, turns), maxTokens: 1500, useCache: false }, (raw) => toChatSummary(raw, words))
}

/** R7.3: đoán âm có thể đọc sai khi máy nghe thành chữ khác, và cách sửa ngắn gọn. */
export function pronounceTip(target: string, heard: string, ipa?: string) {
  return askJson({ task: 'pronounce_tip', system: PRONOUNCE_TIP_SYSTEM, prompt: pronounceTipPrompt(target, heard, ipa), maxTokens: 1000 }, toPronounceTip)
}
