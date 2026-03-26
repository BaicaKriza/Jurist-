import api from '@/lib/api'
import type { User } from '@/types'

export const authService = {
  async login(email: string, password: string) {
    const formData = new URLSearchParams()
    formData.append('username', email)
    formData.append('password', password)
    const { data } = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return data
  },

  async logout() {
    await api.post('/auth/logout')
  },

  async getMe(): Promise<User> {
    const { data } = await api.get('/auth/me')
    return data
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data
  },
}
