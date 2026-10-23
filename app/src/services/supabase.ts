import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Kết nối Supabase. Khi chưa cấu hình (chưa có file .env.local), ứng dụng vẫn chạy
 * và lưu dữ liệu trên thiết bị; đồng bộ sẽ bật khi có cấu hình.
 * Thư viện chỉ được tải khi thật sự cần, để app mở nhanh hơn.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isCloudConfigured = Boolean(url && key)

let client: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!url || !key) return null
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, key))
  return client
}
