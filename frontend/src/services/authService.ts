import api from '@/lib/api'
import type { User } from '@/types'

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  logout() {
    localStorage.removeItem('access_token')
  },

  async getMe(): Promise<User> {
    const { data } = await api.get('/auth/me')
    return data
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.patch('/auth/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data
  },
}
