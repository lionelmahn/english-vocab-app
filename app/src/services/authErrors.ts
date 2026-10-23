/** Đổi lỗi đăng nhập của Supabase sang câu tiếng Việt dễ hiểu. */
export function authErrorMessage(error: { code?: string; message?: string; name?: string; status?: number } | null | undefined): string | null {
  if (!error) return null
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email hoặc mật khẩu không đúng.'
    case 'email_not_confirmed':
      return 'Email chưa được xác nhận. Trong Supabase, hãy xác nhận tài khoản này (Auto Confirm User).'
    case 'user_not_found':
      return 'Không tìm thấy tài khoản với email này.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Bạn thao tác quá nhiều lần. Hãy thử lại sau ít phút.'
    case 'weak_password':
      return 'Mật khẩu quá yếu. Hãy dùng ít nhất 8 ký tự, có cả chữ và số.'
    case 'same_password':
      return 'Mật khẩu mới phải khác mật khẩu cũ.'
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  }
  return `Có lỗi xảy ra${error.message ? `: ${error.message}` : '.'}`
}
