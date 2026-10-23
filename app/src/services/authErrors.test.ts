import { describe, expect, it } from 'vitest'
import { authErrorMessage } from './authErrors'

describe('authErrorMessage', () => {
  it('không có lỗi thì trả null', () => {
    expect(authErrorMessage(null)).toBeNull()
  })

  it('sai mật khẩu', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Email hoặc mật khẩu không đúng.')
  })

  it('mất mạng', () => {
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 })).toMatch('Không kết nối được máy chủ')
  })

  it('lỗi lạ vẫn hiện thông điệp gốc', () => {
    expect(authErrorMessage({ message: 'Something odd' })).toBe('Có lỗi xảy ra: Something odd')
  })
})
