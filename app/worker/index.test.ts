import { describe, expect, it } from 'vitest'
import { verifySupabaseJwt, type Jwk } from './auth'
import { AI_MODELS } from '../src/core/ai'
import { handleAi, handleStt, MODELS, parseRequest, parseSttRequest, STT_MAX_CHARS, STT_MODEL, sttResult, textOf, usageOf, type Env } from './index'

const URL_ = 'https://demo.supabase.co'
const ISS = `${URL_}/auth/v1`

const b64url = (data: Uint8Array | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function keyPair(kid = 'k1') {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const pub = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as Jwk
  return { pair, jwk: { ...pub, kid, alg: 'ES256' } as Jwk, kid }
}

async function sign(pair: CryptoKeyPair, kid: string, claims: Record<string, unknown>) {
  const head = b64url(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }))
  const body = b64url(JSON.stringify(claims))
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(`${head}.${body}`)))
  return `${head}.${body}.${b64url(sig)}`
}

const NOW = Date.parse('2026-10-26T08:00:00Z')
const good = { sub: 'user-1', exp: NOW / 1000 + 3600, iss: ISS, aud: 'authenticated', role: 'authenticated' }

describe('xác thực phiên Supabase trong Worker', () => {
  it('nhận token hợp lệ; từ chối hết hạn, sai nơi cấp, sai vai trò, sai chữ ký, khóa lạ', async () => {
    const { pair, jwk, kid } = await keyPair()
    const other = await keyPair('k2')
    expect(await verifySupabaseJwt(await sign(pair, kid, good), [jwk], ISS, NOW)).toEqual({ ok: true, userId: 'user-1' })
    expect(await verifySupabaseJwt(await sign(pair, kid, { ...good, exp: NOW / 1000 - 1 }), [jwk], ISS, NOW)).toMatchObject({ ok: false, reason: 'expired' })
    expect(await verifySupabaseJwt(await sign(pair, kid, { ...good, iss: 'https://evil.supabase.co/auth/v1' }), [jwk], ISS, NOW)).toMatchObject({ reason: 'issuer' })
    expect(await verifySupabaseJwt(await sign(pair, kid, { ...good, role: 'anon', aud: 'authenticated' }), [jwk], ISS, NOW)).toMatchObject({ reason: 'role' })
    // Ký bằng khóa khác nhưng gắn kid của khóa thật.
    expect(await verifySupabaseJwt(await sign(other.pair, kid, good), [jwk], ISS, NOW)).toMatchObject({ reason: 'signature' })
    expect(await verifySupabaseJwt(await sign(other.pair, 'k2', good), [jwk], ISS, NOW)).toMatchObject({ reason: 'unknown_key' })
    // Sửa nội dung sau khi ký.
    const [h, , s] = (await sign(pair, kid, good)).split('.')
    expect(await verifySupabaseJwt(`${h}.${b64url(JSON.stringify({ ...good, sub: 'admin' }))}.${s}`, [jwk], ISS, NOW)).toMatchObject({ reason: 'signature' })
    expect(await verifySupabaseJwt('abc', [jwk], ISS, NOW)).toMatchObject({ reason: 'malformed' })
  })
})

describe('yêu cầu gửi tới /api/ai', () => {
  it('danh sách model của app khớp với Worker', () => {
    expect(AI_MODELS.map((m) => m.id).sort()).toEqual(Object.keys(MODELS).sort())
  })

  it('chỉ nhận model trong danh sách, câu hỏi hoặc hội thoại có giới hạn độ dài', () => {
    expect(parseRequest({ model: 'gpt-oss-120b', system: 'Bạn là trợ lý.', prompt: 'issue' })).toMatchObject({ model: 'gpt-oss-120b', maxTokens: 1000 })
    expect(parseRequest({ model: '@cf/meta/llama-2', system: 's', prompt: 'p' })).toBe('model')
    expect(parseRequest({ model: 'gpt-oss-120b', system: '', prompt: 'p' })).toBe('system')
    expect(parseRequest({ model: 'gpt-oss-120b', system: 's', prompt: 'x'.repeat(7000) })).toBe('prompt')
    expect(parseRequest({ model: 'gpt-oss-120b', system: 's', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] })).toBe('messages')
    expect(parseRequest({ model: 'gpt-oss-120b', system: 's', messages: [{ role: 'system', content: 'x' }] })).toBe('messages')
    expect(parseRequest({ model: 'gpt-oss-120b', system: 's', prompt: 'p', maxTokens: 99999 })).toMatchObject({ maxTokens: 2000 })
  })

  it('đọc chữ trả lời và lượng dùng từ các kiểu kết quả khác nhau', () => {
    expect(textOf({ response: '<think>hmm</think> {"a":1}' })).toBe('{"a":1}')
    expect(textOf({ response: { a: 1 } })).toBe('{"a":1}')
    expect(textOf({ choices: [{ message: { content: 'xin chào' } }] })).toBe('xin chào')
    expect(textOf({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ text: 'ok' }] }] })).toBe('ok')
    expect(textOf({})).toBeNull()
    expect(usageOf({ usage: { prompt_tokens: 10, completion_tokens: 20, neurons: 3.14159 } })).toEqual({ inputTokens: 10, outputTokens: 20, neurons: 3.14 })
  })
})

describe('handleAi', () => {
  async function setup(run: (model: string, input: Record<string, unknown>) => Promise<unknown>) {
    // Mỗi lần một khóa mới (mã khóa khác), như khi Supabase đổi khóa: Worker phải tải lại danh sách khóa.
    const { pair, jwk, kid } = await keyPair(crypto.randomUUID())
    const calls: { model: string; input: Record<string, unknown> }[] = []
    const env: Env = {
      SUPABASE_URL: URL_,
      ASSETS: { fetch: async () => new Response('asset') },
      AI: {
        run: async (model, input) => {
          calls.push({ model, input })
          return run(model, input)
        },
      },
    }
    const jwks = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch
    const token = await sign(pair, kid, { ...good, exp: Date.now() / 1000 + 3600 })
    const post = (body: unknown, auth = `Bearer ${token}`) =>
      handleAi(new Request('https://app.test/api/ai', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, jwks)
    return { post, calls }
  }

  it('đã đăng nhập: gọi đúng model, trả chữ và lượng dùng; chưa đăng nhập: 401', async () => {
    const { post, calls } = await setup(async () => ({ response: 'vấn đề', usage: { prompt_tokens: 5, completion_tokens: 3, neurons: 1.5 } }))
    const res = await post({ model: 'llama-3.3-70b', system: 'S', prompt: 'issue', schema: { type: 'object' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'vấn đề', model: 'llama-3.3-70b', usage: { inputTokens: 5, outputTokens: 3, neurons: 1.5 } })
    expect(calls[0].model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast')
    expect(calls[0].input).toMatchObject({ messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'issue' }], response_format: { type: 'json_schema' } })
    expect((await post({ model: 'llama-3.3-70b', system: 'S', prompt: 'x' }, '')).status).toBe(401)
    expect((await post({ model: 'llama-3.3-70b', system: 'S', prompt: 'x' }, 'Bearer abc.def.ghi')).status).toBe(401)
    expect((await post({ model: 'nope', system: 'S', prompt: 'x' })).status).toBe(400)
  })

  it('hết hạn mức miễn phí trong ngày thì báo quota (429), lỗi khác thì 502', async () => {
    const quota = await setup(async () => {
      throw new Error('4006: you have used up your daily free allocation of 10,000 neurons')
    })
    const res = await quota.post({ model: 'gpt-oss-120b', system: 'S', prompt: 'x' })
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'quota' })
    const down = await setup(async () => {
      throw new Error('boom')
    })
    expect((await down.post({ model: 'gpt-oss-120b', system: 'S', prompt: 'x' })).status).toBe(502)
  })
})

describe('nhận dạng giọng nói /api/stt (R7.3)', () => {
  const AUDIO = 'UklGR'.padEnd(400, 'A')

  it('chỉ nhận base64 có độ dài hợp lý; đọc chữ, từng chữ, xác suất im lặng, neuron theo thời lượng', () => {
    expect(parseSttRequest({ audio: AUDIO })).toEqual({ audio: AUDIO })
    expect(parseSttRequest({ audio: 'abc' })).toBe('audio')
    expect(parseSttRequest({ audio: 'A'.repeat(STT_MAX_CHARS + 4) })).toBe('audio')
    expect(parseSttRequest({ audio: `${AUDIO}<script>` })).toBe('audio')
    expect(parseSttRequest(null)).toBe('body')
    const r = sttResult({
      text: ' Rice. ',
      transcription_info: { duration: 1.2 },
      segments: [{ no_speech_prob: 0.02, words: [{ word: ' Rice.', start: 0.1, end: 0.6 }] }],
    })
    expect(r).toEqual({ text: 'Rice.', words: [{ word: 'Rice.', start: 0.1, end: 0.6 }], noSpeech: 0.02, duration: 1.2, neurons: 0.93 })
    expect(sttResult({ text: '', segments: [] })).toMatchObject({ text: '', noSpeech: 1, words: [] })
  })

  it('cần đăng nhập; gọi Whisper ép tiếng Anh, có lọc giọng nói, không gợi ý từ mục tiêu', async () => {
    const { pair, jwk, kid } = await keyPair(crypto.randomUUID())
    const calls: { model: string; input: Record<string, unknown> }[] = []
    const env: Env = {
      SUPABASE_URL: URL_,
      ASSETS: { fetch: async () => new Response('asset') },
      AI: {
        run: async (model, input) => {
          calls.push({ model, input })
          return { text: 'Rise.', transcription_info: { duration: 1 }, segments: [{ no_speech_prob: 0, words: [] }] }
        },
      },
    }
    const jwks = (async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch
    const token = await sign(pair, kid, { ...good, exp: Date.now() / 1000 + 3600 })
    const post = (body: unknown, auth = `Bearer ${token}`) =>
      handleStt(new Request('https://app.test/api/stt', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, jwks)
    const res = await post({ audio: AUDIO })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ text: 'Rise.', duration: 1 })
    expect(calls[0]).toEqual({ model: STT_MODEL, input: { audio: AUDIO, language: 'en', task: 'transcribe', vad_filter: true, condition_on_previous_text: false } })
    expect((await post({ audio: AUDIO }, '')).status).toBe(401)
    expect((await post({ audio: 'x' })).status).toBe(400)
  })
})
