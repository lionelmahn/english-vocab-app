/**
 * Kiểm tra phiên đăng nhập Supabase trong Worker (R8, mục 3.7 của kế hoạch): JWT ký bằng ES256, khóa công khai lấy
 * từ JWKS của dự án. Chỉ dùng WebCrypto có sẵn, không cần khóa bí mật hay thư viện ngoài.
 */

export interface Jwk {
  kty: string
  kid?: string
  alg?: string
  crv?: string
  x?: string
  y?: string
}

export interface Claims {
  sub: string
  exp: number
  iss?: string
  aud?: string | string[]
  role?: string
}

export type AuthResult = { ok: true; userId: string } | { ok: false; reason: string }

function b64urlBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJson<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlBytes(part))) as T
  } catch {
    return null
  }
}

/**
 * Xác thực một access token của Supabase: chữ ký ES256 khớp một khóa trong `keys`, còn hạn, đúng nơi cấp
 * (`<SUPABASE_URL>/auth/v1`) và là người dùng đã đăng nhập (role/aud "authenticated").
 */
export async function verifySupabaseJwt(token: string, keys: readonly Jwk[], issuer: string, now = Date.now()): Promise<AuthResult> {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0])
  const claims = decodeJson<Claims>(parts[1])
  if (!header || !claims) return { ok: false, reason: 'malformed' }
  if (header.alg !== 'ES256') return { ok: false, reason: 'alg' }
  const jwk = keys.find((k) => k.kty === 'EC' && k.crv === 'P-256' && (!header.kid || k.kid === header.kid))
  if (!jwk) return { ok: false, reason: 'unknown_key' }
  let valid = false
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  } catch {
    return { ok: false, reason: 'bad_key' }
  }
  if (!valid) return { ok: false, reason: 'signature' }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return { ok: false, reason: 'expired' }
  if (claims.iss !== issuer) return { ok: false, reason: 'issuer' }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.role !== 'authenticated' || !aud.includes('authenticated')) return { ok: false, reason: 'role' }
  if (!claims.sub) return { ok: false, reason: 'subject' }
  return { ok: true, userId: claims.sub }
}

let cached: { url: string; keys: Jwk[]; at: number } | null = null
const JWKS_TTL = 10 * 60_000

/** Khóa công khai của dự án, giữ 10 phút trong mỗi phiên bản Worker (`force`: tải lại ngay, ví dụ khi Supabase đổi khóa). */
export async function projectKeys(supabaseUrl: string, fetcher: typeof fetch = fetch, force = false, now = Date.now()): Promise<Jwk[]> {
  if (!force && cached && cached.url === supabaseUrl && now - cached.at < JWKS_TTL) return cached.keys
  const res = await fetcher(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
  if (!res.ok) throw new Error(`jwks ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  cached = { url: supabaseUrl, keys: body.keys ?? [], at: now }
  return cached.keys
}
