import { describe, expect, it } from 'vitest'
import {
  b64u,
  decideReminder,
  encryptPayload,
  fromB64u,
  handleRequest,
  importPrivateKey,
  inQuietHours,
  localClock,
  REMINDER_DEFAULTS,
  sanitizeReminders,
  sendPush,
  vapidHeader,
  type ReminderTarget,
} from '../../../supabase/functions/send-reminders/index.ts'
import { REMINDER_DEFAULTS as APP_DEFAULTS, sanitizeReminders as appSanitize } from '../core/reminders'

/** Edge Function nhắc nhở (R9.3, R9.4, R9.6): mã hóa Web Push, khóa VAPID, quyết định nhắc và xử lý yêu cầu. */

const bs = (u: Uint8Array) => u as unknown as BufferSource
const utf8 = new TextEncoder()

/** Giải mã như trình duyệt (RFC 8291), để kiểm tra nội dung máy chủ gửi đi. */
async function decrypt(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, auth: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16)
  const idlen = body[20]
  const senderPublic = body.slice(21, 21 + idlen)
  const cipher = body.slice(21 + idlen)
  const hmac = async (key: Uint8Array, data: Uint8Array) => {
    const k = await crypto.subtle.importKey('raw', bs(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, bs(data)))
  }
  const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]))
  const sender = await crypto.subtle.importKey('raw', bs(senderPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: sender }, uaPrivate, 256))
  const ikm = await hmac(await hmac(auth, ecdh), cat(utf8.encode('WebPush: info\x00'), uaPublic, senderPublic, [1] as unknown as Uint8Array))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, cat(utf8.encode('Content-Encoding: aes128gcm\x00'), Uint8Array.of(1)))).slice(0, 16)
  const nonce = (await hmac(prk, cat(utf8.encode('Content-Encoding: nonce\x00'), Uint8Array.of(1)))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(nonce) }, key, bs(cipher)))
  expect(plain[plain.length - 1]).toBe(2)
  return new TextDecoder().decode(plain.slice(0, -1))
}

/** Một trình duyệt giả: cặp khóa nhận thông báo và bí mật xác thực. */
async function browser() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { privateKey: pair.privateKey, publicRaw, auth, p256dh: b64u(publicRaw), authB64: b64u(auth) }
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64u(publicRaw), privateKey: jwk.d!, subject: 'https://example.test' }
}

describe('mã hóa Web Push (RFC 8291)', () => {
  // Ví dụ ở mục 5 và phụ lục A của RFC 8291.
  const rfc = {
    plaintext: 'When I grow up, I want to be a watermelon',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
    uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    cek: 'oIhVW04MRdy2XN9CiKLxTg',
    nonce: '4h_95klXJ5E_qnoN',
  }

  it('khớp khóa nội dung và nonce của ví dụ trong RFC, giải mã ra đúng nội dung', async () => {
    const { body, cek, nonce } = await encryptPayload(utf8.encode(rfc.plaintext), fromB64u(rfc.uaPublic), fromB64u(rfc.auth), {
      senderPrivate: rfc.asPrivate,
      senderPublic: fromB64u(rfc.asPublic),
      salt: fromB64u(rfc.salt),
    })
    expect(b64u(cek)).toBe(rfc.cek)
    expect(b64u(nonce)).toBe(rfc.nonce)
    // Đầu bản tin: salt, cỡ bản ghi 4096, độ dài và khóa công khai của máy chủ (86 byte).
    expect(b64u(body.slice(0, 16))).toBe(rfc.salt)
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096)
    expect(b64u(body.slice(21, 86))).toBe(rfc.asPublic)
    const uaKey = await importPrivateKey(rfc.uaPrivate, fromB64u(rfc.uaPublic), 'ECDH')
    expect(await decrypt(body, uaKey, fromB64u(rfc.uaPublic), fromB64u(rfc.auth))).toBe(rfc.plaintext)
  })

  it('mỗi lần gửi dùng khóa và salt mới', async () => {
    const b = await browser()
    const one = await encryptPayload(utf8.encode('xin chào'), b.publicRaw, b.auth)
    const two = await encryptPayload(utf8.encode('xin chào'), b.publicRaw, b.auth)
    expect(b64u(one.body)).not.toBe(b64u(two.body))
    expect(await decrypt(one.body, b.privateKey, b.publicRaw, b.auth)).toBe('xin chào')
  })
})

describe('khóa VAPID (RFC 8292)', () => {
  it('chữ ký ES256 hợp lệ, aud là gốc của địa chỉ đẩy, hết hạn sau 12 giờ', async () => {
    const keys = await vapidKeys()
    const now = Date.parse('2026-10-26T01:00:00Z')
    const header = await vapidHeader('https://web.push.apple.com/QGuQyavXut', keys, now)
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!
    expect(m[4]).toBe(keys.publicKey)
    const payload = JSON.parse(new TextDecoder().decode(fromB64u(m[2])))
    expect(payload).toEqual({ aud: 'https://web.push.apple.com', exp: now / 1000 + 12 * 3600, sub: 'https://example.test' })
    const pub = await crypto.subtle.importKey('raw', bs(fromB64u(keys.publicKey)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, bs(fromB64u(m[3])), bs(utf8.encode(`${m[1]}.${m[2]}`)))
    expect(ok).toBe(true)
  })

  it('gửi kèm đủ header; trình duyệt giải mã ra đúng thông báo', async () => {
    const b = await browser()
    const keys = await vapidKeys()
    let seen: { url: string; init: RequestInit } | null = null
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    const msg = { title: 'Có từ đến hạn ôn', body: '12 từ đang chờ ôn.', url: '/review' }
    expect(await sendPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: b.p256dh, auth: b.authB64 }, msg, keys, fakeFetch)).toBe(201)
    const headers = seen!.init.headers as Record<string, string>
    expect(headers['Content-Encoding']).toBe('aes128gcm')
    expect(headers.TTL).toBe('14400')
    expect(headers.Authorization).toMatch(/^vapid t=.+, k=/)
    expect(JSON.parse(await decrypt(seen!.init.body as Uint8Array, b.privateKey, b.publicRaw, b.auth))).toEqual(msg)
  })
})

describe('giờ địa phương và giờ yên lặng', () => {
  it('giờ, thứ và ngày học (đổi ngày lúc 4:00 sáng) theo múi giờ', () => {
    expect(localClock(Date.parse('2026-10-25T13:00:00Z'), 'Asia/Ho_Chi_Minh')).toEqual({ minutes: 20 * 60, weekday: 0, studyDay: '2026-10-25' })
    // 3:30 sáng thứ Hai giờ Việt Nam vẫn là ngày học Chủ nhật.
    expect(localClock(Date.parse('2026-10-25T20:30:00Z'), 'Asia/Ho_Chi_Minh')).toMatchObject({ weekday: 1, studyDay: '2026-10-25' })
  })

  it('giờ yên lặng qua nửa đêm và trong ngày', () => {
    const night = { ...REMINDER_DEFAULTS, quietStart: '22:00', quietEnd: '07:00' }
    expect([23 * 60, 6 * 60 + 59, 7 * 60, 12 * 60].map((m) => inQuietHours(m, night))).toEqual([true, true, false, false])
    const noon = { ...REMINDER_DEFAULTS, quietStart: '13:00', quietEnd: '15:00' }
    expect([12 * 60 + 59, 13 * 60, 15 * 60].map((m) => inQuietHours(m, noon))).toEqual([false, true, false])
    expect(inQuietHours(600, { ...REMINDER_DEFAULTS, quietStart: '08:00', quietEnd: '08:00' })).toBe(false)
  })

  it('tùy chọn trong app (lưu trong hồ sơ) khớp với máy chủ', () => {
    expect(APP_DEFAULTS).toEqual(REMINDER_DEFAULTS)
    for (const raw of [null, {}, { dueMin: 0, duePerDay: 99, quietStart: '25:00', study: 'x' }, { study: false, due: false, dueMin: 20, duePerDay: 1, quietStart: '23:30', quietEnd: '06:00' }])
      expect(appSanitize(raw)).toEqual(sanitizeReminders(raw))
  })

  it('tùy chọn sai hoặc thiếu thì về mặc định', () => {
    expect(sanitizeReminders({ dueMin: 0, duePerDay: 99, quietStart: '25:00', study: 'x' })).toEqual({ ...REMINDER_DEFAULTS, dueMin: 1, duePerDay: 6 })
    expect(sanitizeReminders(null)).toEqual(REMINDER_DEFAULTS)
  })
})

describe('quyết định nhắc', () => {
  // 20:05 Chủ nhật 25/10/2026 giờ Việt Nam.
  const now = Date.parse('2026-10-25T13:05:00Z')
  const target = (extra: Partial<ReminderTarget> = {}): ReminderTarget => ({
    user_id: 'u1',
    time_zone: 'Asia/Ho_Chi_Minh',
    study_time: '20:00',
    study_weekdays: [0, 1, 2, 3, 4, 5, 6],
    prefs: {},
    due_count: 12,
    last_review_at: '2026-10-24T13:00:00Z',
    sent_study_today: 0,
    sent_due_today: 0,
    last_sent_at: null,
    subscriptions: [],
    ...extra,
  })

  it('nhắc giờ học trong 2 tiếng kể từ giờ học, khi hôm nay chưa học và chưa nhắc', () => {
    expect(decideReminder(target(), now)).toMatchObject({ kind: 'study', url: '/review', body: '12 từ đang chờ ôn. Mở app học vài phút nhé!' })
    expect(decideReminder(target({ due_count: 0 }), now)).toMatchObject({ kind: 'study', url: '/learn' })
    // Đã học hôm nay (sau 4:00 sáng) hoặc đã nhắc thì thôi nhắc giờ học (vẫn có thể nhắc ôn).
    expect(decideReminder(target({ last_review_at: '2026-10-25T05:00:00Z', due_count: 3 }), now)).toBeNull()
    expect(decideReminder(target({ sent_study_today: 1 }), now)?.kind).toBe('due')
    // Trước giờ học, sau cửa sổ 2 tiếng, hoặc không phải ngày học: không nhắc giờ học.
    expect(decideReminder(target({ study_time: '20:30', due_count: 0 }), now)).toBeNull()
    expect(decideReminder(target({ study_time: '17:00', due_count: 0 }), now)).toBeNull()
    expect(decideReminder(target({ study_weekdays: [1, 2, 3, 4, 5], due_count: 0 }), now)).toBeNull()
    expect(decideReminder(target({ study_time: null }), now)?.kind).toBe('due')
    expect(decideReminder(target({ prefs: { study: false } }), now)?.kind).toBe('due')
  })

  it('nhắc ôn: đủ số từ, chưa quá số lần, cách lần trước 3 tiếng, không vừa học xong', () => {
    const base = { study_time: null }
    expect(decideReminder(target(base), now)).toMatchObject({ kind: 'due', url: '/review', body: '12 từ đang chờ ôn. Ôn lúc này là nhớ lâu nhất.' })
    expect(decideReminder(target({ ...base, due_count: 9 }), now)).toBeNull()
    expect(decideReminder(target({ ...base, prefs: { dueMin: 5 }, due_count: 5 }), now)?.kind).toBe('due')
    expect(decideReminder(target({ ...base, sent_due_today: 2 }), now)).toBeNull()
    expect(decideReminder(target({ ...base, last_sent_at: '2026-10-25T11:00:00Z' }), now)).toBeNull()
    expect(decideReminder(target({ ...base, last_sent_at: '2026-10-25T10:00:00Z' }), now)?.kind).toBe('due')
    expect(decideReminder(target({ ...base, last_review_at: '2026-10-25T12:30:00Z' }), now)).toBeNull()
    expect(decideReminder(target({ ...base, prefs: { due: false } }), now)).toBeNull()
  })

  it('không nhắc gì trong giờ yên lặng', () => {
    expect(decideReminder(target({ prefs: { quietStart: '20:00', quietEnd: '21:00' } }), now)).toBeNull()
    // 23:00 giờ Việt Nam rơi vào giờ yên lặng mặc định 22:00–07:00.
    expect(decideReminder(target({ study_time: null }), Date.parse('2026-10-25T16:00:00Z'))).toBeNull()
  })

  it('múi giờ sai thì dùng giờ Việt Nam', () => {
    expect(decideReminder(target({ time_zone: 'Mars/Base' }), now)?.kind).toBe('study')
  })
})

describe('xử lý yêu cầu', () => {
  const now = Date.parse('2026-10-25T13:05:00Z')
  const env = (extra: Record<string, string> = {}, keys?: { publicKey: string; privateKey: string }) => ({
    get: (k: string) =>
      ({ SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_x' }), CRON_SECRET: 'cron-123', VAPID_PUBLIC_KEY: keys?.publicKey, VAPID_PRIVATE_KEY: keys?.privateKey, ...extra })[k],
  })

  async function server(pushStatus = 201) {
    const b = await browser()
    const keys = await vapidKeys()
    const calls: { url: string; method: string; body?: string; headers: Record<string, string> }[] = []
    const row: ReminderTarget = {
      user_id: 'u1',
      time_zone: 'Asia/Ho_Chi_Minh',
      study_time: '20:00',
      study_weekdays: [0, 1, 2, 3, 4, 5, 6],
      prefs: {},
      due_count: 4,
      last_review_at: null,
      sent_study_today: 0,
      sent_due_today: 0,
      last_sent_at: null,
      subscriptions: [{ id: 's1', endpoint: 'https://web.push.apple.com/abc', p256dh: b.p256dh, auth: b.authB64 }],
    }
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
      const body = typeof init.body === 'string' ? init.body : undefined
      calls.push({ url, method: init.method ?? 'GET', body, headers: (init.headers ?? {}) as Record<string, string> })
      if (url.endsWith('/rest/v1/rpc/reminder_targets')) return Response.json([row])
      if (url.endsWith('/auth/v1/user')) return (init.headers as Record<string, string>).Authorization === 'Bearer user-token' ? Response.json({ id: 'u1' }) : new Response('{}', { status: 401 })
      if (url.startsWith('https://web.push.apple.com')) return new Response(null, { status: pushStatus })
      return new Response(null, { status: 201 })
    }) as unknown as typeof fetch
    return { keys, calls, fetchFn }
  }

  const cron = (secret?: string) => new Request('https://proj.supabase.co/functions/v1/send-reminders', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {}, body: '{}' })

  it('lịch chạy: sai khóa bí mật thì từ chối; đúng thì gửi và ghi nhật ký', async () => {
    const s = await server()
    expect((await handleRequest(cron('sai'), env({}, s.keys), s.fetchFn, now)).status).toBe(403)
    const res = await handleRequest(cron('cron-123'), env({}, s.keys), s.fetchFn, now)
    expect(await res.json()).toEqual({ users: 1, sent: 1 })
    const rpc = s.calls.find((c) => c.url.endsWith('rpc/reminder_targets'))!
    expect(rpc.headers.apikey).toBe('sb_secret_x')
    expect(JSON.parse(rpc.body!)).toEqual({ p_now: new Date(now).toISOString(), p_user: null })
    const log = s.calls.find((c) => c.url.endsWith('/rest/v1/reminder_log'))!
    expect(JSON.parse(log.body!)).toEqual({ user_id: 'u1', kind: 'study', study_day: '2026-10-25' })
  })

  it('đăng ký hết hạn (410) thì xóa, không ghi nhật ký', async () => {
    const s = await server(410)
    const res = await handleRequest(cron('cron-123'), env({}, s.keys), s.fetchFn, now)
    expect(await res.json()).toEqual({ users: 1, sent: 0 })
    expect(s.calls.some((c) => c.method === 'DELETE' && c.url.endsWith('push_subscriptions?id=eq.s1'))).toBe(true)
    expect(s.calls.some((c) => c.url.endsWith('reminder_log'))).toBe(false)
  })

  it('gửi thử: cần phiên đăng nhập, gửi tới máy của chính người đó', async () => {
    const s = await server()
    const test = (token?: string) =>
      new Request('https://proj.supabase.co/functions/v1/send-reminders', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: '{"test":true}' })
    expect((await handleRequest(test(), env({}, s.keys), s.fetchFn, now)).status).toBe(401)
    const res = await handleRequest(test('user-token'), env({}, s.keys), s.fetchFn, now)
    expect(await res.json()).toEqual({ devices: 1, sent: 1 })
    const rpc = s.calls.find((c) => c.url.endsWith('rpc/reminder_targets'))!
    expect(JSON.parse(rpc.body!).p_user).toBe('u1')
  })

  it('thiếu khóa VAPID thì báo rõ', async () => {
    const s = await server()
    const res = await handleRequest(cron('cron-123'), env(), s.fetchFn, now)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/VAPID_PUBLIC_KEY/)
  })
})
