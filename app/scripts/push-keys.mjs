// Tạo khóa cho nhắc nhở (Web Push): cặp khóa VAPID và khóa bí mật cho lịch chạy.
// - Khóa công khai ghi vào .env.local (app cần khi dựng bản; công khai được).
// - Khóa riêng và khóa lịch chạy ghi vào push-keys.local (không lên git) để bạn dán vào Supabase.
// Không in khóa bí mật ra màn hình. Chạy: npm run push-keys (thêm -- --force để tạo khóa mới).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const out = new URL('../push-keys.local', import.meta.url)
const env = new URL('../.env.local', import.meta.url)

if (existsSync(out) && !process.argv.includes('--force')) {
  console.log('Đã có app/push-keys.local. Muốn tạo khóa mới thì thêm --force (các máy đã bật nhắc nhở sẽ phải bật lại).')
  process.exit(1)
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = b64u(await crypto.subtle.exportKey('raw', pair.publicKey))
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d
const cronSecret = b64u(crypto.getRandomValues(new Uint8Array(32)))

writeFileSync(
  out,
  [
    '# Khóa nhắc nhở (Web Push). KHÔNG đưa lên git, không gửi cho ai.',
    '#',
    '# 1) Supabase → Edge Functions → Secrets: thêm 3 dòng dưới (Key là phần trước dấu =, Value là phần sau).',
    `VAPID_PUBLIC_KEY=${publicKey}`,
    `VAPID_PRIVATE_KEY=${privateKey}`,
    `CRON_SECRET=${cronSecret}`,
    '#',
    '# 2) Supabase → SQL Editor: chạy câu dưới (lưu khóa lịch chạy vào Vault).',
    `select vault.create_secret('${cronSecret}', 'reminders_cron_secret');`,
    '',
  ].join('\n'),
)

let text = existsSync(env) ? readFileSync(env, 'utf8') : ''
const line = `VITE_VAPID_PUBLIC_KEY=${publicKey}`
text = /^VITE_VAPID_PUBLIC_KEY=.*$/m.test(text) ? text.replace(/^VITE_VAPID_PUBLIC_KEY=.*$/m, line) : `${text.replace(/\s*$/, '')}\n${line}\n`
writeFileSync(env, text)

console.log(`Đã tạo khóa. Khóa công khai (đã ghi vào app/.env.local): ${publicKey}`)
console.log('Khóa riêng và khóa lịch chạy nằm trong app/push-keys.local (không lên git).')
