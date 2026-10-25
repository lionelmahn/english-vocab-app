/**
 * Edge Function "send-reminders" (Supabase): nhắc học theo giờ (R9.3) và nhắc ôn khi có từ đến hạn (R9.4)
 * qua Web Push, tôn trọng giờ yên lặng và giới hạn số lần mỗi ngày (R9.6).
 *
 * - pg_cron gọi hàm này 15 phút một lần (supabase/migrations/20261026000000_reminders.sql), kèm header x-cron-secret.
 * - App gọi với { test: true } và phiên đăng nhập để gửi thử một thông báo tới các máy của chính người đó.
 *
 * File tự chứa, không import gì: dán thẳng vào trình soạn Edge Function trên trang Supabase được.
 * App import các hàm tính toán ở đây để test (mã hóa theo RFC 8291, khóa VAPID theo RFC 8292, quyết định nhắc).
 * Secrets cần đặt: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET (VAPID_SUBJECT không bắt buộc).
 */

// ---- base64url và byte ------------------------------------------------------------------------

export function b64u(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64u(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const utf8 = new TextEncoder()

/** Mảng byte cho WebCrypto (kiểu TypeScript mới đòi ArrayBuffer thuần; ép kiểu để chạy được cả bản cũ trên Supabase). */
const bs = (u: Uint8Array) => u as unknown as BufferSource

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', bs(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, bs(data)))
}

/** Khóa riêng P-256 từ phần bí mật d (base64url, 32 byte) và khóa công khai thô (65 byte). */
export async function importPrivateKey(d: string, publicRaw: Uint8Array, alg: 'ECDH' | 'ECDSA'): Promise<CryptoKey> {
  const jwk = { kty: 'EC', crv: 'P-256', d, x: b64u(publicRaw.slice(1, 33)), y: b64u(publicRaw.slice(33, 65)), ext: true }
  return crypto.subtle.importKey('jwk', jwk, { name: alg, namedCurve: 'P-256' }, false, alg === 'ECDH' ? ['deriveBits'] : ['sign'])
}

// ---- Mã hóa nội dung (RFC 8291, aes128gcm) -----------------------------------------------------

export interface EncryptOptions {
  /** Chỉ dùng khi test với ví dụ trong RFC; bình thường mỗi lần gửi tạo khóa và salt mới. */
  senderPrivate?: string
  senderPublic?: Uint8Array
  salt?: Uint8Array
}

export async function encryptPayload(
  plaintext: Uint8Array,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
  opts: EncryptOptions = {},
): Promise<{ body: Uint8Array; cek: Uint8Array; nonce: Uint8Array }> {
  let senderKey: CryptoKey
  let senderPublic: Uint8Array
  if (opts.senderPrivate && opts.senderPublic) {
    senderKey = await importPrivateKey(opts.senderPrivate, opts.senderPublic, 'ECDH')
    senderPublic = opts.senderPublic
  } else {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    senderKey = pair.privateKey
    senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  }
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const uaKey = await crypto.subtle.importKey('raw', bs(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderKey, 256))
  const one = new Uint8Array([1])
  const prkKey = await hmac(authSecret, ecdh)
  const ikm = await hmac(prkKey, concat(utf8.encode('WebPush: info\x00'), uaPublic, senderPublic, one))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(utf8.encode('Content-Encoding: aes128gcm\x00'), one))).slice(0, 16)
  const nonce = (await hmac(prk, concat(utf8.encode('Content-Encoding: nonce\x00'), one))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt'])
  // Một bản ghi duy nhất: nội dung + byte 0x02 đánh dấu bản ghi cuối.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce) }, key, bs(concat(plaintext, new Uint8Array([2])))))
  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = senderPublic.length
  return { body: concat(header, senderPublic, cipher), cek, nonce }
}

// ---- Khóa VAPID (RFC 8292) ---------------------------------------------------------------------

export interface VapidKeys {
  /** Khóa công khai thô (65 byte) dạng base64url, giống khóa app dùng để đăng ký. */
  publicKey: string
  /** Phần bí mật d (32 byte) dạng base64url. */
  privateKey: string
  /** "mailto:…" hoặc "https://…" để dịch vụ đẩy liên hệ khi cần. */
  subject: string
}

export async function vapidHeader(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const part = (o: object) => b64u(utf8.encode(JSON.stringify(o)))
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })}`
  const key = await importPrivateKey(keys.privateKey, fromB64u(keys.publicKey), 'ECDSA')
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bs(utf8.encode(unsigned))))
  return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`
}

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushMessage {
  title: string
  body: string
  /** Trang mở ra khi chạm vào thông báo. */
  url: string
}

/** Gửi một thông báo; trả về mã HTTP của dịch vụ đẩy (201 là đã nhận, 404/410 là đăng ký đã hết hạn). */
export async function sendPush(target: PushTarget, message: PushMessage, vapid: VapidKeys, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<number> {
  const { body } = await encryptPayload(utf8.encode(JSON.stringify(message)), fromB64u(target.p256dh), fromB64u(target.auth))
  const res = await fetchFn(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(target.endpoint, vapid, now),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // Máy tắt quá 4 giờ thì bỏ lời nhắc cũ; thông báo mới thay thông báo nhắc chưa xem (cùng Topic).
      TTL: '14400',
      Urgency: 'normal',
      Topic: 'vocab-reminder',
    },
    body: bs(body),
  })
  return res.status
}

// ---- Quyết định nhắc gì, lúc nào ---------------------------------------------------------------

export interface ReminderPrefs {
  /** Nhắc vào giờ học (giờ đặt ở "Mục tiêu và lịch học"). */
  study: boolean
  /** Nhắc khi có từ đến hạn ôn. */
  due: boolean
  /** Chỉ nhắc ôn khi có ít nhất chừng này từ đến hạn. */
  dueMin: number
  /** Tối đa số lần nhắc ôn mỗi ngày. */
  duePerDay: number
  /** Giờ yên lặng "HH:MM" (không nhắc từ quietStart đến quietEnd; có thể qua nửa đêm). */
  quietStart: string
  quietEnd: string
}

export const REMINDER_DEFAULTS: ReminderPrefs = { study: true, due: true, dueMin: 10, duePerDay: 2, quietStart: '22:00', quietEnd: '07:00' }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function sanitizeReminders(raw: unknown, base: ReminderPrefs = REMINDER_DEFAULTS): ReminderPrefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback
  return {
    study: typeof r.study === 'boolean' ? r.study : base.study,
    due: typeof r.due === 'boolean' ? r.due : base.due,
    dueMin: int(r.dueMin, 1, 500, base.dueMin),
    duePerDay: int(r.duePerDay, 1, 6, base.duePerDay),
    quietStart: typeof r.quietStart === 'string' && TIME.test(r.quietStart) ? r.quietStart : base.quietStart,
    quietEnd: typeof r.quietEnd === 'string' && TIME.test(r.quietEnd) ? r.quietEnd : base.quietEnd,
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** Ngày học bắt đầu lúc 4:00 sáng, giống app (core/day.ts). */
const DAY_START_HOUR = 4
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function minutesOf(time: string | null | undefined): number | null {
  if (!time || !TIME.test(time)) return null
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Giờ địa phương (phút trong ngày), thứ (0 = Chủ nhật) và ngày học (YYYY-MM-DD, đổi ngày lúc 4:00). */
export function localClock(at: number, timeZone: string): { minutes: number; weekday: number; studyDay: string } {
  const parts = (t: number, opts: Intl.DateTimeFormatOptions) =>
    Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, ...opts }).formatToParts(new Date(t)).map((p) => [p.type, p.value]))
  const now = parts(at, { hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short' })
  const day = parts(at - DAY_START_HOUR * HOUR, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return { minutes: Number(now.hour) * 60 + Number(now.minute), weekday: WEEKDAYS.indexOf(now.weekday), studyDay: `${day.year}-${day.month}-${day.day}` }
}

export function inQuietHours(minutes: number, prefs: ReminderPrefs): boolean {
  const start = minutesOf(prefs.quietStart)
  const end = minutesOf(prefs.quietEnd)
  if (start === null || end === null || start === end) return false
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/** Một dòng của hàm SQL reminder_targets(): người có máy đăng ký nhận thông báo. */
export interface ReminderTarget {
  user_id: string
  time_zone: string | null
  study_time: string | null
  study_weekdays: number[] | null
  prefs: unknown
  due_count: number
  last_review_at: string | null
  sent_study_today: number
  sent_due_today: number
  last_sent_at: string | null
  subscriptions: (PushTarget & { id: string })[] | null
}

export interface Reminder extends PushMessage {
  kind: 'study' | 'due'
}

function validTimeZone(tz: string | null): string {
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz })
      return tz
    } catch {
      // dùng mặc định
    }
  }
  return 'Asia/Ho_Chi_Minh'
}

/** Cửa sổ nhắc giờ học: từ giờ học tới 2 tiếng sau (lịch chạy 15 phút một lần nên không bị lỡ). */
const STUDY_WINDOW = 120
/** Hai lần nhắc cách nhau ít nhất 3 tiếng; vừa học trong 1 tiếng thì không nhắc ôn. */
const MIN_GAP = 3 * HOUR
const RECENT_STUDY = HOUR

/**
 * Mỗi lượt chạy gửi tối đa một thông báo cho mỗi người, theo thứ tự:
 * 1. Nhắc giờ học: vào ngày học, trong 2 tiếng kể từ giờ học, hôm nay chưa học và chưa nhắc.
 * 2. Nhắc ôn: đủ số từ đến hạn, chưa quá số lần trong ngày, cách lần nhắc trước ≥ 3 tiếng, không vừa học trong 1 tiếng.
 * Không nhắc gì trong giờ yên lặng.
 */
export function decideReminder(t: ReminderTarget, now: number): Reminder | null {
  const prefs = sanitizeReminders(t.prefs)
  const tz = validTimeZone(t.time_zone)
  const clock = localClock(now, tz)
  if (inQuietHours(clock.minutes, prefs)) return null
  const lastReview = t.last_review_at ? Date.parse(t.last_review_at) : null
  const studiedToday = lastReview !== null && localClock(lastReview, tz).studyDay === clock.studyDay
  const weekdays = t.study_weekdays ?? [0, 1, 2, 3, 4, 5, 6]
  const studyAt = minutesOf(t.study_time)

  if (
    prefs.study &&
    studyAt !== null &&
    weekdays.includes(clock.weekday) &&
    clock.minutes >= studyAt &&
    clock.minutes < studyAt + STUDY_WINDOW &&
    t.sent_study_today === 0 &&
    !studiedToday
  ) {
    return t.due_count > 0
      ? { kind: 'study', title: 'Đến giờ học rồi', body: `${t.due_count} từ đang chờ ôn. Mở app học vài phút nhé!`, url: '/review' }
      : { kind: 'study', title: 'Đến giờ học rồi', body: 'Học vài từ mới để giữ nhịp mỗi ngày nhé!', url: '/learn' }
  }

  const lastSent = t.last_sent_at ? Date.parse(t.last_sent_at) : null
  if (
    prefs.due &&
    t.due_count >= prefs.dueMin &&
    t.sent_due_today < prefs.duePerDay &&
    (lastSent === null || now - lastSent >= MIN_GAP) &&
    (lastReview === null || now - lastReview >= RECENT_STUDY)
  ) {
    return { kind: 'due', title: 'Có từ đến hạn ôn', body: `${t.due_count} từ đang chờ ôn. Ôn lúc này là nhớ lâu nhất.`, url: '/review' }
  }
  return null
}

// ---- Xử lý yêu cầu (chạy trên Supabase) --------------------------------------------------------

export interface Env {
  get(key: string): string | undefined
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Khóa bí mật của dự án (khóa mới trong SUPABASE_SECRET_KEYS, hoặc khóa service_role cũ). */
function secretKey(env: Env): string {
  const keys = env.get('SUPABASE_SECRET_KEYS')
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, string>
      const key = parsed.default ?? Object.values(parsed)[0]
      if (key) return key
    } catch {
      // thử khóa cũ
    }
  }
  return env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

export async function handleRequest(req: Request, env: Env, fetchFn: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const base = env.get('SUPABASE_URL') ?? ''
  const key = secretKey(env)
  const vapid: VapidKeys = {
    publicKey: env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: env.get('VAPID_SUBJECT') || 'https://english-vocab.lionelmahn.workers.dev',
  }
  if (!vapid.publicKey || !vapid.privateKey) return json({ error: 'Thiếu VAPID_PUBLIC_KEY hoặc VAPID_PRIVATE_KEY trong Edge Function Secrets.' }, 500)

  const rest = (path: string, init: RequestInit = {}) =>
    fetchFn(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: key, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const targets = async (user: string | null): Promise<ReminderTarget[]> => {
    const res = await rest('rpc/reminder_targets', { method: 'POST', body: JSON.stringify({ p_now: new Date(now).toISOString(), p_user: user }) })
    if (!res.ok) throw new Error(`reminder_targets: ${res.status} ${await res.text()}`)
    return (await res.json()) as ReminderTarget[]
  }
  /** Gửi tới mọi máy của một người; đăng ký hết hạn (404/410) thì xóa. Trả về số máy đã nhận. */
  const deliver = async (t: ReminderTarget, message: PushMessage): Promise<number> => {
    let ok = 0
    for (const sub of t.subscriptions ?? []) {
      try {
        const status = await sendPush(sub, message, vapid, fetchFn, now)
        if (status >= 200 && status < 300) ok++
        else if (status === 404 || status === 410) await rest(`push_subscriptions?id=eq.${sub.id}`, { method: 'DELETE' })
      } catch {
        // máy này lỗi thì thử máy khác
      }
    }
    return ok
  }

  let body: { test?: boolean } = {}
  try {
    body = (await req.json()) as { test?: boolean }
  } catch {
    // lịch chạy gửi body rỗng cũng được
  }

  try {
    if (body.test) {
      // Gửi thử cho chính người đang đăng nhập.
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
      const who = token ? await fetchFn(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } }) : null
      const user = who?.ok ? ((await who.json()) as { id?: string }).id : undefined
      if (!user) return json({ error: 'Chưa đăng nhập.' }, 401)
      const [mine] = await targets(user)
      const devices = mine?.subscriptions?.length ?? 0
      const sent = mine ? await deliver(mine, { title: 'Nhắc nhở đã chạy', body: 'Bạn sẽ nhận nhắc học và nhắc ôn như thế này.', url: '/me/reminders' }) : 0
      return json({ devices, sent })
    }

    const secret = env.get('CRON_SECRET')
    if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
    let sent = 0
    const all = await targets(null)
    for (const t of all) {
      const reminder = decideReminder(t, now)
      if (!reminder) continue
      const ok = await deliver(t, reminder)
      if (ok === 0) continue
      sent++
      const studyDay = localClock(now, validTimeZone(t.time_zone)).studyDay
      await rest('reminder_log', { method: 'POST', body: JSON.stringify({ user_id: t.user_id, kind: reminder.kind, study_day: studyDay }) })
    }
    return json({ users: all.length, sent })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
}

// Trên Supabase (Deno) thì chạy máy chủ; khi app import để test thì không.
const deno = (globalThis as { Deno?: { serve(handler: (req: Request) => Promise<Response>): void; env: Env } }).Deno
if (deno) deno.serve((req) => handleRequest(req, deno.env))
